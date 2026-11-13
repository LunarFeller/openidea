from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import threading

BASE = Path(__file__).parent
BODY = '{"id":9007199254740993,"amount":1.0000000000000000002,"tiny":1e-400}'
LOCK = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def respond(self, text):
        content = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        self.respond(BODY)

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0"))).decode("utf-8")
        with LOCK:
            with (BASE / "received.jsonl").open("a") as output:
                output.write(json.dumps({"path": self.path, "body": body}) + "\n")
        self.respond('{"data":' + BODY + '}' if self.path == "/graphql" else body)


server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
host = "http://127.0.0.1:" + str(server.server_port)
(BASE / "server.json").write_text(json.dumps({"pid": os.getpid(), "port": server.server_port, "host": host}))
(BASE / "requests.http").write_text(
    "### Exact response\nGET " + host + "/exact\n\n### Exact environment\nPOST " + host +
    '/env\nContent-Type: application/json\n\n{"id":{{id}},"amount":{{amount}},"tiny":{{tiny}}}\n'
)
(BASE / "http-client.env.json").write_text(
    '{"dev":{"id":123456789012345678901234567890,"amount":1.0000000000000000002,"tiny":1e-400}}'
)
(BASE / ".graphqlrc.json").write_text(json.dumps({
    "schema": "schema.graphql", "documents": "query.graphql",
    "extensions": {"endpoints": {"local": {"url": host + "/graphql"}}}
}))
(BASE / "schema.graphql").write_text(
    "scalar BigInt\nscalar Decimal\ntype Query { exact(id: BigInt, amount: Decimal, tiny: Decimal): Result! }\n"
    "type Result { id: BigInt!, amount: Decimal!, tiny: Decimal! }\n"
)
(BASE / "query.graphql").write_text(
    "query Exact($id: BigInt, $amount: Decimal, $tiny: Decimal) { "
    "exact(id: $id, amount: $amount, tiny: $tiny) { id amount tiny } }\n"
)
print(json.dumps({"pid": os.getpid(), "port": server.server_port}), flush=True)
try:
    server.serve_forever()
finally:
    server.server_close()
