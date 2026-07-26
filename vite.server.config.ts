import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@server": fileURLToPath(new URL("./server", import.meta.url)),
    },
  },
  build: {
    ssr: "server/index.ts",
    outDir: "dist-server",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
});
