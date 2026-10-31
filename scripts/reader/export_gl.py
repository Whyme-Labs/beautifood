# Exports the browser reader (train_gl.py) for onnxruntime-web, and times it.
# Two graphs:
#   reader.onnx: token ids, the label markers and the candidate spans in → span × label logits, span
#     states and the [CLS] state out (one encoder pass);
#   heads.onnx: dish-span and part-span states in → attach, change and acts logits (tiny).
# Spans are listed outside the graph (every span of up to MAX_W tokens starting and ending on a token
# with text), as decode() does, so the graph has no data-dependent shapes. Checks the exported graphs
# give the PyTorch numbers, quantises the encoder to 8-bit, and times a typical turn on 4 CPU threads.
#
#   python export_gl.py <model dir> [--quantize]
import argparse, json, os, statistics, time

import numpy as np
import torch
import torch.nn as nn

import train_gl as T


class ReaderGraph(nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, ids, mask, markers, span_a, span_b, span_w):
        hs = self.m.encoder(input_ids=ids, attention_mask=mask).last_hidden_state[0]
        S = self.m.span(torch.cat([hs[span_a], hs[span_b], self.m.width(span_w)], -1))
        L = self.m.label(hs[markers])
        return S @ L.T, S, hs[0]


class HeadsGraph(nn.Module):
    def __init__(self, m):
        super().__init__()
        self.m = m

    def forward(self, dish, part, cls):
        # every dish span against every part span: attach logits [dishes, parts, 3]; change [dishes, changes]; acts [acts]
        n, k = dish.shape[0], part.shape[0]
        d = dish.unsqueeze(1).expand(n, k, -1)
        p = part.unsqueeze(0).expand(n, k, -1)
        attach = self.m.attach(torch.cat([d, p, d * p], -1))
        change = self.m.change(torch.cat([dish, cls.unsqueeze(0).expand(n, -1)], -1))
        return attach, change, self.m.acts(cls)


def spans_of(valid, start):
    ok = set(valid)
    idx = [(i, j) for i in valid for j in range(i, min(max(valid) + 1, i + T.MAX_W)) if j in ok]
    return idx, np.array([start + i for i, _ in idx]), np.array([start + j for _, j in idx]), np.array([j - i for i, j in idx])


def compress(src, dst, kind):
    """Weights stored small, computed in fp32: each large float weight becomes fp16 (kind "fp16") or
    int8 with one scale per row/column (kind "int8w"), turned back to fp32 by a Cast/DequantizeLinear
    node when the session loads. Halves (or quarters) the download without quantising activations,
    which is what moved the dynamic int8 graph's decisions."""
    import onnx
    from onnx import helper, numpy_helper
    g = onnx.load(src)
    graph_nodes = list(g.graph.node)
    users = {}
    for at, n in enumerate(graph_nodes):
        for k, i in enumerate(n.input):
            users.setdefault(i, []).append((at, k))
    keep, nodes, gathered = [], [], {}
    for init in g.graph.initializer:
        w = numpy_helper.to_array(init)
        if w.dtype != np.float32 or w.ndim != 2 or w.size < 4096:
            keep.append(init)
            continue
        name = init.name
        if kind == "fp16":
            # (fp16: every big weight, gathered or not, stored at half size and cast back on load)
            keep.append(numpy_helper.from_array(w.astype(np.float16), name + "_h"))
            nodes.append(helper.make_node("Cast", [name + "_h"], [name], to=onnx.TensorProto.FLOAT))
            continue
        uses = [(graph_nodes[at], k, at) for at, k in users.get(name, [])]
        if uses and all(n.op_type == "Gather" and k == 0 and not any(a.name == "axis" and a.i != 0 for a in n.attribute) for n, k, _ in uses):
            # a table only ever gathered by rows (the word embeddings): gather the int8 rows and their
            # scales, then scale just those, instead of turning the whole table back each call
            scale = np.abs(w).max(axis=1) / 127.0
            scale[scale == 0] = 1.0
            keep += [numpy_helper.from_array(np.clip(np.round(w / scale[:, None]), -127, 127).astype(np.int8), name + "_q"), numpy_helper.from_array(scale.astype(np.float32)[:, None], name + "_s")]
            for n, _, at in uses:
                out_, ids_ = n.output[0], n.input[1]
                n.input[0] = name + "_q"
                n.output[0] = f"{out_}_q"
                gathered[at] = ([
                    helper.make_node("Gather", [name + "_s", ids_], [f"{out_}_s"], axis=0),
                    helper.make_node("Cast", [f"{out_}_q"], [f"{out_}_f"], to=onnx.TensorProto.FLOAT),
                    helper.make_node("Mul", [f"{out_}_f", f"{out_}_s"], [out_]),
                ])
            continue
        # the output channel: rows for a Gemm with transB, columns for a MatMul's B
        axis = 1 if any(n.op_type == "MatMul" and k == 1 for n, k, _ in uses) else 0
        scale = np.abs(w).max(axis=1 - axis) / 127.0
        scale[scale == 0] = 1.0
        q = np.clip(np.round(w / (scale[None, :] if axis == 1 else scale[:, None])), -127, 127).astype(np.int8)
        keep += [numpy_helper.from_array(q, name + "_q"), numpy_helper.from_array(scale.astype(np.float32), name + "_s"), numpy_helper.from_array(np.zeros(len(scale), np.int8), name + "_z")]
        nodes.append(helper.make_node("DequantizeLinear", [name + "_q", name + "_s", name + "_z"], [name], axis=axis))
    del g.graph.initializer[:]
    g.graph.initializer.extend(keep)
    old = []
    for n in graph_nodes:
        c = onnx.NodeProto()
        c.CopyFrom(n)
        old.append(c)
    del g.graph.node[:]
    g.graph.node.extend(nodes + [x for at, n in enumerate(old) for x in [n] + gathered.get(at, [])])
    onnx.save(g, dst, save_as_external_data=True, location=os.path.basename(dst) + ".data", size_threshold=1024)


def session(path, threads=4):
    import onnxruntime as ort
    o = ort.SessionOptions()
    o.intra_op_num_threads = threads
    return ort.InferenceSession(path, o)


def onnx_decode(reader, heads, x):
    """decode() on the exported graphs."""
    idx, sa, sb, sw = spans_of(x["valid"], x["start"])
    ids = np.array([x["ids"]])
    logits, S, cls = reader.run(None, {"ids": ids, "mask": np.ones_like(ids), "markers": np.array(x["markers"]), "span_a": sa, "span_b": sb, "span_w": sw})

    def run_heads(dish, part, c):
        d, p = np.asarray(dish, np.float32), np.asarray(part, np.float32)
        nd, np_ = len(d), len(p)
        # (the graph wants at least one of each: pad, then cut back)
        a, ch, acts = heads.run(None, {"dish": d if nd else np.zeros((1, S.shape[1]), np.float32), "part": p if np_ else np.zeros((1, S.shape[1]), np.float32), "cls": np.asarray(c, np.float32)})
        return a[:nd, :np_], ch[:nd], acts
    return T.decode_from(idx, logits, S, cls, run_heads, x["labels"])


def same(r):
    return sorted((i["label"], tuple(i["span"]), i["change"], tuple(sorted((l, tuple(s), k) for l, s, k in i["parts"]))) for i in r["items"]), sorted(r["acts"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("--quantize", action="store_true", help="also the dynamic int8 graph (activations quantised too)")
    ap.add_argument("--check", help="validation examples (train.valid.jsonl): decisions of each graph vs PyTorch, and vs gold")
    ap.add_argument("--menus", help="train.menus.json, with --check")
    ap.add_argument("--n", type=int, default=300)
    a = ap.parse_args()
    from transformers import AutoTokenizer
    import onnxruntime as ort

    tok, m = T.load_reader(a.model)
    menu = [{"name": f"Dish {k}", "zh": "炒面", "groups": [{"name": "Size", "options": ["Small", "Large"]}, {"name": "Add-ons", "options": [f"Extra {w}" for w in ("egg", "prawns", "tofu", "noodles")]}]} for k in range(30)]
    text = "boss 2 dish 3 large tambah telur, and one dish 7 iced kurang manis. total brapa"
    _, labels = T.select_labels(tok, menu, text)
    ids, markers, start, offs = T.encode(tok, text, labels)
    idx, sa, sb, sw = spans_of(T.text_tokens(text, offs), start)
    inputs = (torch.tensor([ids]), torch.ones(1, len(ids), dtype=torch.long), torch.tensor(markers), torch.tensor(sa), torch.tensor(sb), torch.tensor(sw))
    out = f"{a.model}/onnx"
    os.makedirs(out, exist_ok=True)
    with torch.no_grad():
        torch.onnx.export(ReaderGraph(m).eval(), inputs, f"{out}/reader.onnx", input_names=["ids", "mask", "markers", "span_a", "span_b", "span_w"], output_names=["logits", "spans", "cls"],
                          dynamic_axes={"ids": {1: "n"}, "mask": {1: "n"}, "markers": {0: "labels"}, "span_a": {0: "s"}, "span_b": {0: "s"}, "span_w": {0: "s"}, "logits": {0: "s", 1: "labels"}, "spans": {0: "s"}}, opset_version=18, dynamo=True)
        logits, S, cls = ReaderGraph(m)(*inputs)
        hd = (S[:3], S[3:9], cls)
        torch.onnx.export(HeadsGraph(m).eval(), hd, f"{out}/heads.onnx", input_names=["dish", "part", "cls"], output_names=["attach", "change", "acts"],
                          dynamic_axes={"dish": {0: "n"}, "part": {0: "k"}, "attach": {0: "n", 1: "k"}, "change": {0: "n"}}, opset_version=18, dynamo=True)
        ref_heads = HeadsGraph(m)(*hd)
    feed = {"ids": inputs[0].numpy(), "mask": inputs[1].numpy(), "markers": inputs[2].numpy(), "span_a": sa, "span_b": sb, "span_w": sw}
    opts_ = ort.SessionOptions()
    opts_.intra_op_num_threads = 4
    sess = ort.InferenceSession(f"{out}/reader.onnx", opts_)
    got = sess.run(None, feed)
    print("reader.onnx max |diff| vs PyTorch:", float(np.abs(got[0] - logits.numpy()).max()))
    # (and on a message of another length: DeBERTa's relative positions must not be fixed at the traced length)
    text2 = "dua dish 5 small, satu dish 9"
    ids2, markers2, start2, offs2 = T.encode(tok, text2, T.select_labels(tok, menu, text2)[1])
    _, sa2, sb2, sw2 = spans_of(T.text_tokens(text2, offs2), start2)
    with torch.no_grad():
        ref2 = ReaderGraph(m)(torch.tensor([ids2]), torch.ones(1, len(ids2), dtype=torch.long), torch.tensor(markers2), torch.tensor(sa2), torch.tensor(sb2), torch.tensor(sw2))[0].numpy()
    got2 = sess.run(None, {"ids": np.array([ids2]), "mask": np.ones((1, len(ids2)), dtype=np.int64), "markers": np.array(markers2), "span_a": sa2, "span_b": sb2, "span_w": sw2})[0]
    print("reader.onnx max |diff| at another length:", float(np.abs(got2 - ref2).max()))
    hs_ = ort.InferenceSession(f"{out}/heads.onnx", opts_).run(None, {"dish": hd[0].numpy(), "part": hd[1].numpy(), "cls": hd[2].numpy()})
    print("heads.onnx max |diff|:", max(float(np.abs(x - y.numpy()).max()) for x, y in zip(hs_, ref_heads)))
    path = f"{out}/reader.onnx"
    if a.quantize:
        import onnx
        from onnxruntime.quantization import QuantType, quantize_dynamic
        # (the exporter's own shape notes trip the quantiser's shape inference: drop them, it infers its own)
        g = onnx.load(path)
        del g.graph.value_info[:]
        onnx.save(g, f"{out}/reader.noshapes.onnx", save_as_external_data=True, location="reader.noshapes.data")
        # (per channel, and only the MatMuls: the embedding table stays out of the activation-quantised path)
        quantize_dynamic(f"{out}/reader.noshapes.onnx", f"{out}/reader.int8.onnx", weight_type=QuantType.QInt8, per_channel=True, op_types_to_quantize=["MatMul"], use_external_data_format=True)
        path = f"{out}/reader.int8.onnx"
        q = ort.InferenceSession(path, opts_).run(None, feed)
        print("int8 max |diff| in logits:", float(np.abs(q[0] - logits.numpy()).max()), "| same spans above 0:", bool(((q[0] > 0) == (logits.numpy() > 0)).all()))
    sess = ort.InferenceSession(path, opts_)
    times = []
    for _ in range(20):
        t = time.time(); sess.run(None, feed); times.append(1000 * (time.time() - t))
    print(f"{os.path.basename(path)}: {os.path.getsize(path) / 1e6:.0f} MB; {len(ids)} tokens, {len(idx)} spans, {len(markers)} labels; median {statistics.median(times[5:]):.0f} ms on 4 threads")
    variants = {"fp32": f"{out}/reader.onnx"} | ({"int8dyn": path} if a.quantize else {})
    for kind in ("fp16", "int8w"):
        compress(f"{out}/reader.onnx", f"{out}/reader.{kind}.onnx", kind)
        variants[kind] = f"{out}/reader.{kind}.onnx"
    if a.quantize:
        # dynamic int8 MatMuls, and the embedding table int8 by rows
        compress(path, f"{out}/reader.int8all.onnx", "int8w")
        variants["int8all"] = f"{out}/reader.int8all.onnx"
    for kind, p in variants.items():
        size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out) if f.startswith(os.path.basename(p)))
        r = session(p)
        times = []
        for _ in range(15):
            t = time.time(); r.run(None, feed); times.append(1000 * (time.time() - t))
        print(f"{kind}: {size / 1e6:.0f} MB, median {statistics.median(times[5:]):.0f} ms, max |diff| in logits {float(np.abs(r.run(None, feed)[0] - logits.numpy()).max()):.4f}")
    if a.check:
        menus = json.load(open(a.menus, encoding="utf-8"))
        rows = [json.loads(l) for l in open(a.check, encoding="utf-8") if l.strip()][: a.n]
        xs = [T.example_targets(e, menus[e["menu"]], tok) for e in rows]
        heads = session(f"{out}/heads.onnx")
        with torch.no_grad():
            ref = [same(T.decode(m, x, "cpu")) for x in xs]
        gold = [(T.gold_view(x)[0], T.gold_view(x)[1]) for x in xs]
        print(f"PyTorch: {sum(r == g for r, g in zip(ref, gold))}/{len(xs)} exact")
        for kind, p in variants.items():
            r = session(p)
            got = [same(onnx_decode(r, heads, x)) for x in xs]
            print(f"{kind}: same reading as PyTorch {sum(g == f for g, f in zip(got, ref))}/{len(xs)}, exact {sum(g == w for g, w in zip(got, gold))}/{len(xs)}")
    json.dump({"labels_max": T.MAX_LEN, "max_w": T.MAX_W, "changes": T.CHANGES, "acts": T.ACTS, "generic": T.GENERIC}, open(f"{out}/reader.json", "w"))


if __name__ == "__main__":
    main()
