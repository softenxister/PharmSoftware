import "dotenv/config";
import { serve } from "@hono/node-server";
import { createServerApp } from "./app";
import { startProductCompositionWorker } from "@/server/composition/productCompositionEnrichment";
import { startProductImageWorker } from "@/server/product-images/worker";

const defaultPort = process.env.NODE_ENV === "production" ? 3000 : 3001;
const parsedPort = Number(process.env.PORT ?? defaultPort);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : defaultPort;
const hostname = process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const app = createServerApp();
const stopProductCompositionWorker = startProductCompositionWorker();
const stopProductImageWorker = startProductImageWorker();

const server = serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(`Pharm server listening on http://${hostname}:${info.port}`);
});

const shutdown = () => {
  stopProductCompositionWorker();
  stopProductImageWorker();
  server.close((error) => {
    if (error) {
      console.error("Unable to close the Pharm server cleanly", error);
      process.exitCode = 1;
    }
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
