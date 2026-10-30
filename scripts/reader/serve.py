# Serves a trained reader (train.py) behind the reader's OpenAI-style API, so the brain's model
# reader (src/server/ai/brain/modelReader.ts) and the benchmark (bench/run.ts --reader-url) can use
# it as they would any model: the menu is read from the system prompt's "D1 | name | zh | groups"
# lines, the message from "Message: …", and the reading comes back as the JSON content.
#
#   python serve.py <model dir> [--port 8082]
import argparse, json, re, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from train import load_reader

PRICE = re.compile(r"\s*\(\+[^)]*\)$")

def menu_of(system):
    """The menu lines of the reader's system prompt, as the training data writes menus."""
    menu = []
    for line in system.split("The menu:\n", 1)[-1].splitlines():
        parts = [p.strip() for p in line.split(" | ")]
        if len(parts) < 3 or not re.fullmatch(r"D\d+", parts[0]):
            continue
        groups = []
        for g in filter(None, (x.strip() for x in (parts[3] if len(parts) > 3 else "").split("; "))):
            name, _, opts = g.partition(": ")
            groups.append({"name": name, "options": [{"name": PRICE.sub("", o.strip())} for o in opts.split(", ") if o.strip()]})
        menu.append({"key": parts[0], "name": parts[1], "zh": parts[2] or None, "groups": groups})
    return menu

def main():
    p = argparse.ArgumentParser()
    p.add_argument("model")
    p.add_argument("--port", type=int, default=8082)
    a = p.parse_args()
    inf = load_reader(a.model)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"ok"}')

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            msgs = body.get("messages", [])
            system = next((m["content"] for m in msgs if m["role"] == "system"), "")
            user = next((m["content"] for m in reversed(msgs) if m["role"] == "user"), "")
            message = re.sub(r"\nJSON:\s*$", "", user.split("Message: ", 1)[-1])
            t = time.time()
            out = inf.read(menu_of(system), message)
            res = {"choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": json.dumps(out, ensure_ascii=False)}}], "usage": {"ms": round(1000 * (time.time() - t))}}
            data = json.dumps(res).encode()
            self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(data))); self.end_headers()
            self.wfile.write(data)

    print(f"reader on :{a.port}", file=sys.stderr, flush=True)
    ThreadingHTTPServer(("127.0.0.1", a.port), Handler).serve_forever()

if __name__ == "__main__":
    main()
