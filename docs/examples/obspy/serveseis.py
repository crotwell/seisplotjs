#!/Users/crotwell/opt/miniconda3/envs/obspy/bin/python


import asyncio
import io
import http.server
import json
import queue
import sys
import threading
import websockets
from obspy.io.quakeml.core import Pickler
from obspy.core.event.catalog import Catalog
from obspy.core.event.base import ResourceIdentifier

import logging
logger = logging.getLogger('websockets.server')
logger.setLevel(logging.INFO)
logger.addHandler(logging.StreamHandler())

class ServeSeis():
    def __init__(self):
        self.dataset = self.initEmptyDataset()
        self.httpServer = None
        self.wsServer = None
    def initEmptyDataset(self):
        return {
            "stream": None,
            "title": "tytle",
            "quake": None
        }
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
                    }
                }
            }
        }
        jsonapi['data']['attributes']['title'] = self.dataset['title']
        if self.dataset['quake']:
            id_num = self.dataset['quake'].resource_id.id.split('=')[1]
            jsonapi['data']['relationships']['quake']['data'] = {
                  'type': 'quake',
                  'id': id_num
                }
        if self.dataset['stream']:
            seisjson = jsonapi['data']['relationships']['seismograms']['data']
            for i, sdd in enumerate(self.dataset['stream']):
                seisjson.append({
                  'type': 'seismogram',
                  'id': i
                })
        return jsonapi
    def serveData(self, host='localhost', port=8000, wsport=8001):
        print("before http server")
        if self.httpServer:
            print("already serving...")
            return
        self.httpServer = ObsPyServer(self.__createRequestHandlerClass(), host=host, port=port)
        self.httpServer.start()
        print("http server started at http://{}:{:d}".format(host, port))
        self.wsServer = ObsPyWebSocket(host=host, port=wsport)
        self.wsServer.start()
        print("websocket server started ws://{}:{:d}".format(host, wsport))

    def setStream(self, stream, title=None):
        self.dataset["stream"] = stream
        if title:
            self.setTitle(title)

    def getStream(self):
        return self.dataset["stream"]

    def clear(self):
        self.dataset = self.initEmptyDataset()

    def setTitle(self, title):
        self.dataset["title"] = title;

    def getTitle(self):
        return self.dataset["title"];

    def setQuake(self, quake):
        self.dataset["quake"] = quake;

    def getQuake(self):
        return self.dataset["quake"];

    def __createRequestHandlerClass(self):
        class ObsPyRequestHandler(http.server.SimpleHTTPRequestHandler):
            serveSeis = self # class variable to access
            def __init__(self,request, client_address, server):
                super().__init__(request, client_address, server)
            def end_headers (self):
                self.send_header('Access-Control-Allow-Origin', '*')
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
                elif self.path == '/favicon.ico':
                    super().do_GET()
                elif self.path.startswith('/www'):
                    super().do_GET()
                else:
                    content = "IT WORKS!"
                    self.send_response(200)
                    self.send_header("Content-Length", len(content))
                    self.send_header("Content-Type", "text/html")
                    self.end_headers()
                    self.wfile.write(content.encode())

            def sendDataset(self):
                content = json.dumps(ObsPyRequestHandler.serveSeis.datasetAsJsonApi())
                self.send_response(200)
                self.send_header("Content-Length", len(content))
                self.send_header("Content-Type", "application/vnd.api+json")
                self.end_headers()
                self.wfile.write(content.encode())
            def sendSeismogram(self):
                splitPath = self.path.split('/')
                id = int(splitPath[2])
                buf = io.BytesIO()
                ObsPyRequestHandler.serveSeis.dataset['stream'][id].write(buf, format='MSEED')
                self.send_header("Content-Length", buf.getbuffer().nbytes)
                self.send_header("Content-Type", "application/vnd.fdsn.mseed")
                self.wfile.write(buf.getbuffer())

            def sendQuake(self):
                splitPath = self.path.split('/')
                id = int(splitPath[2])
                resource_id = ResourceIdentifier(str(id))
                catalog = Catalog([ObsPyRequestHandler.serveSeis.dataset['quake']],resource_id=resource_id)
                buf = io.BytesIO()
                catalog.write(buf, format="QUAKEML")
                self.send_header("Content-Length", buf.getbuffer().nbytes)
                self.send_header("Content-Type", "application/xml")
                self.wfile.write(buf.getbuffer())


        return ObsPyRequestHandler

class ObsPyServer(threading.Thread):
    def __init__(self, handler_class, host='localhost', port=8000):
        threading.Thread.__init__(self)
        self.daemon=True
        self.handler_class = handler_class
        self.host = host
        self.port = port
    def run(self, server_class=http.server.ThreadingHTTPServer):
        server_address = (self.host, self.port)
        httpd = server_class(server_address, self.handler_class)
        httpd.serve_forever()

class ObsPyWebSocket(threading.Thread):
    def __init__(self, host, port):
        threading.Thread.__init__(self)
        self.daemon=True
        self.host = host
        self.port = port
        self.users = set()
    def hello(self):
        return json.dumps({'msg': "hi"})
    def send_message(self, message):
        future = asyncio.run_coroutine_threadsafe(
              self.dataQueue.put({'msg': message}),
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
                    await asyncio.wait([self.sendOneUser(user, json.dumps(message)) for user in self.users])
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


                #await self.consumer_handler(websocket, path)


                # consumer_task = asyncio.ensure_future(
                #     self.consumer_handler(websocket, path))
                # producer_task = asyncio.ensure_future(
                #     self.producer_handler(websocket, path))
                #
                # done, pending = await asyncio.wait(
                #     [consumer_task, producer_task],
                #     return_when=asyncio.FIRST_COMPLETED,
                # )
                # print("handler past await tasks")
                # exc = done.exception()
                # if exc:
                #     print("oops, something bad "+str(exc))
                #     self.users.remove(websocket)
                # for task in pending:
                #     task.cancel()
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
        #start_server = websockets.serve(self.handler, self.host, self.port)
        asyncio.get_event_loop().run_until_complete(asyncio.ensure_future(self.initWS()))
        print("ws server started at {}:{:d}".format(self.host, self.port))
        asyncio.get_event_loop().run_forever()
        print("end run")
