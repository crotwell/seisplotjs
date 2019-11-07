#!/Users/crotwell/opt/miniconda3/envs/obspy/bin/python


import asyncio
import websockets
import io
import http.server
import threading
import json
from obspy.io.quakeml.core import Pickler
from obspy.core.event.catalog import Catalog
from obspy.core.event.base import ResourceIdentifier

class ServeSeis():
    def __init__(self):
        self.dataset = self.initEmptyDataset()
    def initEmptyDataset(self):
        return {
            "stream": [],
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
    def serveData(self, host='localhost', port=8000):
        print("before http server")
        background = ObsPyServer(self.__createRequestHandlerClass(), host=host, port=port)
        background.start()
        print("http server started")

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
