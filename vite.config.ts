import { defineConfig, type Plugin } from "vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Void writes `.wasm?module` assets to the client output only, while the Worker
// bundle (dist/ssr) imports them relatively. Mirror them once every build
// environment has finished.
function wasmToWorker(): Plugin {
  return {
    name: "beautifood:wasm-to-worker",
    apply: "build",
    buildApp: {
      order: "post",
      handler() {
        const from = join(process.cwd(), "dist/client/assets");
        const to = join(process.cwd(), "dist/ssr/assets");
        if (!existsSync(from) || !existsSync(to)) return;
        for (const f of readdirSync(from)) if (f.endsWith(".wasm")) copyFileSync(join(from, f), join(to, f));
      },
    },
  };
}

export default defineConfig({
  plugins: [voidPlugin(), voidReact(), wasmToWorker()],
});
