// Browser-side loader: fetch + instantiate the same WASM the server runs.
import init, * as raw from "./wasm/bf_core.js";
import url from "./wasm/bf_core_bg.wasm?url";
import { makeCore, type Core } from "./api";

let ready: Promise<Core> | null = null;

export function loadCore(): Promise<Core> {
  ready ??= init({ module_or_path: url }).then(() => makeCore(raw));
  return ready;
}
