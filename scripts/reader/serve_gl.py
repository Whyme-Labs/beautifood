# Serves the browser reader (train_gl.py) over HTTP for the benchmark replay (gl-replay.ts), the same
# model and decoding the browser runs. POST {"text", "menu": [{name, zh, groups: [{name, options: [names]}]}],
# "order": [dish names]} → {"acts", "items": [{"dish" | "pointer", "text", "change", "count", "owner",
# "options", "removeOptions"}], "ms"}: spans as the guest's own words, names as the menu's.
#
#   python serve_gl.py <model dir> [--port 8084]
import argparse, json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from transformers import AutoTokenizer

import train_gl as T


def load(model_dir):
    tok = AutoTokenizer.from_pretrained(model_dir)
    model = T.Reader(T.load_encoder())
    model.load_state_dict(torch.load(f"{model_dir}/reader.pt", map_location="cpu"))
    model.eval()
    torch.set_num_threads(4)
    return tok, model


def read(tok, model, text, menu, order):
    dishes, opts = T.menu_labels(menu, text, set(order))
    ids, markers, labels, start, offs = T.encode(tok, text, dishes, opts)
    x = {"ids": ids, "markers": markers, "start": start, "valid": T.text_tokens(text, offs), "labels": labels}
    if not x["valid"]:
        return {"acts": [], "items": []}
    r = T.decode(model, x, "cpu")
    chars = lambda span: (offs[span[0]][0], offs[span[1]][1])
    names = {f"dish: {d['name']} {d.get('zh') or ''}".strip(): d["name"] for d in dishes}
    items = []
    for it in r["items"]:
        a, b = chars(it["span"])
        out = {"text": text[a:b], "change": it["change"], "options": [], "removeOptions": []}
        if it["label"] == "pointer":
            out["pointer"] = True
        else:
            out["dish"] = names.get(it["label"])
        for label, span, kind in it["parts"]:
            pa, pb = chars(span)
            said = text[pa:pb]
            if label == "count":
                out["count"] = said
            elif label == "person":
                out["owner"] = said
            elif label.startswith("add-on: "):
                (out["removeOptions"] if kind == "off" else out["options"]).append(label[len("add-on: "):])
        items.append(out)
    return {"acts": r["acts"], "items": items}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("--port", type=int, default=8084)
    a = ap.parse_args()
    tok, model = load(a.model)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"ok"}')

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            t = time.time()
            with torch.no_grad():
                out = read(tok, model, body.get("text", ""), body.get("menu", []), body.get("order", []))
            out["ms"] = round(1000 * (time.time() - t))
            data = json.dumps(out, ensure_ascii=False).encode()
            self.send_response(200); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(data))); self.end_headers()
            self.wfile.write(data)

    print(f"browser reader on :{a.port}", file=sys.stderr, flush=True)
    ThreadingHTTPServer(("127.0.0.1", a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
