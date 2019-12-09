#!/usr/bin/env python


import asyncio
import io
import http.server
import json
import queue
import sys
import threading
import websockets
from obspy.io.quakeml.core import Pickler
from obspy.core.stream import Stream
from obspy.core.event.catalog import Catalog
from obspy.core.event.base import ResourceIdentifier

import logging
logger = logging.getLogger('websockets.server')
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())


class ServeObsPy():
    FAKE_EMPTY_XML = '<?xml version="1.0" encoding="ISO-8859-1"?> <FDSNStationXML xmlns="http://www.fdsn.org/xml/station/1" schemaVersion="1.0" xsi:schemaLocation="http://www.fdsn.org/xml/station/1 http://www.fdsn.org/xml/station/fdsn-station-1.0.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:iris="http://www.fdsn.org/xml/station/1/iris"> </FDSNStationXML>'
    LOCALHOST = '127.0.0.1'
    DEFAULT_HTTP = 8000
    DEFAULT_WS = 8001
    def __init__(self, webdir, host=None, port=None, wsport=None):
        self.webdir = webdir
        self.__host=host
        self.__port=port
        self.__wsport=wsport
        self.dataset = self.initEmptyDataset()
        self.httpServer = None
        self.wsServer = None
    def initEmptyDataset(self):
        return {
            "stream": None,
            "bychan": {},
            "title": "tytle",
            "quake": None,
            "inventory": None
        }
    @property
    def host(self):
        if self.__host is None:
            return ServeObsPy.LOCALHOST
        else:
            return self.__host
    @property
    def port(self):
        if self.__port is None:
            return ServeObsPy.DEFAULT_HTTP
        else:
            return self.__port
    @property
    def wsport(self):
        if self.__wsport is None:
            return ServeObsPy.DEFAULT_WS
        else:
            return self.__wsport
    def datasetAsJsonApi(self):
        jsonapi = {
            'data': {
                "type": "seisdata",
                "id": "1",
                "attributes": {
                  "title": "JSON:API paints my bikeshed!"
                },
                "relationships": {
                    "seismograms": {
                        "data": [
                        ]
                    },
                    "quake": {
                        "data": {}
                    },
                    "inventory": {
                        "data": {}
                    }
                }
            }
        }
        jsonapi['data']['attributes']['title'] = self.dataset['title']
        if 'quake' in self.dataset and self.dataset['quake'] is not None:
            id_num = self.dataset['quake'].resource_id.id.split('=')[1]
            jsonapi['data']['relationships']['quake']['data'] = {
                  'type': 'quake',
                  'id': id_num
                }

        if 'inventory' in self.dataset and self.dataset['inventory'] is not None:
            id_num = 1; #should do something more, maybe break out by channel?
            jsonapi['data']['relationships']['inventory']['data'] = {
                  'type': 'inventory',
                  'id': id_num
                }
        if 'bychan' in self.dataset and self.dataset['bychan'] is not None:
            # stream split by channel to group segments into a single js seismogram
            seisjson = jsonapi['data']['relationships']['seismograms']['data']
            for st in self.dataset['bychan']:
                seisjson.append({
                  'type': 'seismogram',
                  'id': id(st)
                })
        return jsonapi
    def __streamToSeismogramMap(self, stream):
        byChan = {}
        for tr in stream:
            if not tr.id in byChan:
                byChan[tr.id] = []
            byChan[tr.id].append(tr)
        out = []
        for id, trlist in byChan.items():
            out.append(Stream(traces=trlist))
        return out
    def serveData(self):
        print("before http server")
        if self.httpServer:
            print("already serving...")
            return
        self.httpServer = ObsPyServer(self.__createRequestHandlerClass(), host=self.host, port=self.port)
        self.httpServer.start()
        print("http server started at http://{}:{:d}".format(self.host, self.port))
        self.wsServer = ObsPyWebSocket(host=self.host, port=self.wsport)
        self.wsServer.start()
        print("websocket server started ws://{}:{:d}".format(self.host, self.wsport))

    @property
    def stream(self):
        return self.dataset["stream"]
    @stream.setter
    def stream(self, stream):
        self.dataset["stream"] = stream
        self.dataset["bychan"] = self.__streamToSeismogramMap(stream)
        self.wsServer.notifyUpdate('stream');
    @stream.deleter
    def stream(self):
        self.dataset["stream"] = None
        self.dataset["bychan"] = []
        self.wsServer.notifyUpdate('dataset');

    @property
    def title(self):
        return self.dataset["title"];
    @title.setter
    def title(self, title):
        self.dataset["title"] = title;
        self.wsServer.notifyUpdate('title');
    @title.deleter
    def title(self):
        self.title = "";

    @property
    def quake(self):
        return self.dataset["quake"];
    @quake.setter
    def quake(self, quake):
        self.dataset["quake"] = quake;
        self.wsServer.notifyUpdate('quake');
    @quake.deleter
    def quake(self):
        self.quake = None

    @property
    def inventory(self):
        return self.dataset["inventory"];
    @inventory.setter
    def inventory(self, inventory):
        self.dataset["inventory"] = inventory;
        self.wsServer.notifyUpdate('inventory');
    @inventory.deleter
    def inventory(self):
        self.inventory = None

    def refreshAll(self):
        self.dataset["bychan"] = self.__streamToSeismogramMap(self.stream)
        self.wsServer.notifyUpdate('refreshAll');

    def __createRequestHandlerClass(self):
        class ObsPyRequestHandler(http.server.SimpleHTTPRequestHandler):
            serveSeis = self # class variable to access
            def __init__(self,request, client_address, server):
                super().__init__(request, client_address, server, directory=ObsPyRequestHandler.serveSeis.webdir)
            def end_headers (self):
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Headers', "X-Requested-With, Content-Type, Origin, Authorization, Accept, Client-Security-Token, Accept-Encoding")
                self.send_header('Access-Control-Allow-Methods', "POST, GET, OPTIONS, DELETE, PUT")
                http.server.SimpleHTTPRequestHandler.end_headers(self)
            def do_GET(self):
                print("do_GET {}".format(self.path))
                #for h, v in self.headers.items():
                #    print("{} = {}".format(h, v))
                if self.path == '/dataset':
                    self.sendDataset()
                elif self.path.startswith('/seismograms/'):
                    self.sendSeismogram()
                elif self.path.startswith('/quake/'):
                    self.sendQuake()
                elif self.path.startswith('/inventory'):
                    self.sendInventory()
                elif self.path == '/favicon.ico':
                    super().do_GET()
                else:
                    super().do_GET()

            def sendDataset(self):
                content = json.dumps(ObsPyRequestHandler.serveSeis.datasetAsJsonApi())
                self.send_response(200)
                self.send_header("Content-Length", len(content))
                self.send_header("Content-Type", "application/vnd.api+json")
                self.end_headers()
                self.wfile.write(content.encode())
            def sendSeismogram(self):
                splitPath = self.path.split('/')
                seisid = int(splitPath[2])
                bychan = ObsPyRequestHandler.serveSeis.dataset['bychan']
                try:
                    seis = next(s for s in bychan if id(s) == seisid)
                    buf = io.BytesIO()
                    seis.write(buf, format='MSEED')
                    self.send_response(200)
                    self.send_header("Content-Length", buf.getbuffer().nbytes)
                    self.send_header("Content-Type", "application/vnd.fdsn.mseed")
                    self.end_headers()
                    self.wfile.write(buf.getbuffer())
                except StopIteration:
                    self.send_error(404, "seismogram not found")

            def sendQuake(self):
                splitPath = self.path.split('/')
                id = int(splitPath[2])
                resource_id = ResourceIdentifier(str(id))
                catalog = Catalog([ObsPyRequestHandler.serveSeis.dataset['quake']],resource_id=resource_id)
                buf = io.BytesIO()
                catalog.write(buf, format="QUAKEML")
                self.send_response(200)
                self.send_header("Content-Length", buf.getbuffer().nbytes)
                self.send_header("Content-Type", "application/xml")
                self.end_headers()
                self.wfile.write(buf.getbuffer())

            def sendInventory(self):
                buf = io.BytesIO()
                inventory = ObsPyRequestHandler.serveSeis.dataset['inventory']
                if inventory is not None:
                    inventory.write(buf,format="STATIONXML")
                else:
                    buf.write(FAKE_EMPTY_XML)
                self.send_response(200)
                self.send_header("Content-Length", buf.getbuffer().nbytes)
                self.send_header("Content-Type", "application/xml")
                self.end_headers()
                self.wfile.write(buf.getbuffer())
        http.server.SimpleHTTPRequestHandler.extensions_map['.js'] = 'text/javascript'
        return ObsPyRequestHandler

class ObsPyServer(threading.Thread):
    def __init__(self, handler_class, host=None, port=None):
        threading.Thread.__init__(self)
        self.daemon=True
        self.handler_class = handler_class
        self.__host = host
        self.__port = port
    @property
    def host(self):
        if self.__host is None:
            return ServeObsPy.LOCALHOST
        else:
            return self.__host
    @property
    def port(self):
        if self.__port is None:
            return ServeObsPy.DEFAULT_HTTP
        else:
            return self.__port
    def run(self, server_class=http.server.ThreadingHTTPServer):
        server_address = (self.host, self.port)
        httpd = server_class(server_address, self.handler_class)
        httpd.serve_forever()

class ObsPyWebSocket(threading.Thread):
    def __init__(self, host=None, port=None):
        threading.Thread.__init__(self)
        self.daemon=True
        self.__host = host
        self.__port = port
        self.users = set()
    @property
    def host(self):
        if self.__host is None:
            return ServeObsPy.LOCALHOST
        else:
            return self.__host
    @property
    def port(self):
        if self.__port is None:
            return ServeObsPy.DEFAULT_WS
        else:
            return self.__port
    def hello(self):
        return json.dumps({'msg': "hi"})
    def notifyUpdate(self, type):
        self.send_json_message({'update': type})
    def send_json_message(self, jsonMessage):
        if isinstance(jsonMessage, str):
            jsonMessage = {'msg': jsonMessage};
        if not isinstance(jsonMessage, dict):
            raise ValueError("jsonMessage must be string or dict")
        jsonAsStr = json.dumps(jsonMessage)
        print("sending '{}'".format(jsonAsStr))
        future = asyncio.run_coroutine_threadsafe(
              self.dataQueue.put(jsonAsStr),
              self.loop
        )
        result = future.result()
        print('result of send msg {}'.format(result))
    async def consumer_handler(self, websocket, path):
        print("in consumer_handler", flush=True)
        try:
            while True:
                print("before recv")
                message = await websocket.recv()
                print("got message from ws "+message, flush=True)
        except Exception as e:
            print("consumer_handler exception ", flush=True)
            print(e, flush=True)
        except:
            print('consumer_handler something bad happened  ', flush=True)
            e = sys.exc_info()[0]
            print(e, flush=True)
    async def producer_handler(self, websocket, path):
        print("in producer_handler", flush=True)
        try:
            while True:
                print('begin of producer while True:')
                message = await self.dataQueue.get()
                print("dataqueue had message {}".format(message), flush=True)
                if message is None:
                    continue
                if self.users:  # asyncio.wait doesn't accept an empty list
                    await asyncio.wait([self.sendOneUser(user, message) for user in self.users])
                    print("done sending", flush=True)
                else:
                    print("no users to send to...", flush=True)
        except:
            print('producer_handler something bad happened  ', flush=True)
            e = sys.exc_info()[0]
            print(e, flush=True)
    async def sendOneUser(self, user, message):
        try:
            await user.send(message)
        except websockets.exceptions.ConnectionClosedError as ee:
            print("ws conn was closed, removing user ", flush=True)
            print(ee)
            self.users.remove(user)
    async def initWS(self):
        print("in initWS", flush=True)
        self.dataQueue = asyncio.Queue()
        async def handler(websocket, path):
            print("in handler", flush=True)
            self.users.add(websocket)
            try:
                await websocket.send(self.hello())
                done, pending = await asyncio.wait([
                     self.consumer_handler(websocket, path),
                     self.producer_handler(websocket, path)
                     ],
                     return_when=asyncio.FIRST_COMPLETED,
                )
                print("handler past await tasks")

                print("end handler", flush=True)
            except:
                print('handler something bad happened  ')
                e = sys.exc_info()[0]
                print(e)
            finally:
                self.users.remove(websocket)
            print('exit handler')
            print("done, remove websocket user", flush=True)

        self.server = await websockets.serve(handler, self.host, self.port)

    def run(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        asyncio.get_event_loop().run_until_complete(asyncio.ensure_future(self.initWS()))
        print("ws server started at {}:{:d}".format(self.host, self.port))
        asyncio.get_event_loop().run_forever()
        print("ws end run")
