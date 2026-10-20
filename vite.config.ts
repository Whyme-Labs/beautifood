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
      async handler() {
        const from = join(process.cwd(), "dist/client/assets");
        const to = join(process.cwd(), "dist/ssr/assets");
        if (!existsSync(from) || !existsSync(to)) return;
        for (const f of readdirSync(from)) if (f.endsWith(".wasm")) copyFileSync(join(from, f), join(to, f));
      },
    },
  };
}

// Pre-bundle React for both the browser and the Worker environment so the dev
// server never re-optimizes mid-session (which leaves two React copies loaded).
const REACT_DEPS = ["react", "react-dom", "react-dom/client", "react-dom/server", "react/jsx-runtime", "react/jsx-dev-runtime"];

export default defineConfig({
  plugins: [voidPlugin(), voidReact(), wasmToWorker()],
  // Sender address for Cloudflare Email Sending (see src/shared/mail.ts); empty = email off.
  define: { __MAIL_FROM__: JSON.stringify(process.env.MAIL_FROM?.trim() ?? "") },
  resolve: { dedupe: ["react", "react-dom"] },
  // End-to-end runs ask for restaurants' storefront hosts (src/shared/domains.ts) by Host header.
  // Local dev needs nothing: <slug>.localhost is allowed already (set STOREFRONT_DOMAIN=localhost).
  ...(process.env.APP_ENV === "test" ? { preview: { allowedHosts: true as const } } : {}),
  optimizeDeps: { include: [...REACT_DEPS, "qrcode"] },
  environments: {
    void_worker: { optimizeDeps: { include: REACT_DEPS } },
  },
});
