import { defineConfig } from "vitest/config";
export default defineConfig({
  define: { __MAIL_FROM__: JSON.stringify("Beautifood Test <receipts@mail.example.test>") },
  test: { include: ["test/unit/**/*.test.ts"], environment: "node" },
});
