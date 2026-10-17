#!/usr/bin/env bash
# Build the Rust domain core to WASM and generate JS bindings for both the
# Worker and the browser (wasm-bindgen --target web works in both).
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --manifest-path crates/core/Cargo.toml --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir src/core/wasm crates/core/target/wasm32-unknown-unknown/release/bf_core.wasm
echo "core built: $(du -h src/core/wasm/bf_core_bg.wasm | cut -f1)"
