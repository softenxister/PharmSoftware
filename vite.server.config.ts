import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
