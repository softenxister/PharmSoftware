import { serveStatic } from "@hono/node-server/serve-static";
import { bodyLimit } from "hono/body-limit";
import { Hono, type Context } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { runWithRequest } from "@/server/auth/requestContext";
import { MAX_CW_STOCK_REQUEST_BYTES } from "@/server/import/cwStockUpload";
import { apiRoutes, type ApiHandler } from "./apiRegistry";

const isProduction = process.env.NODE_ENV === "production";
const API_BODY_LIMIT_BYTES = 2 * 1024 * 1024;
const STOCK_MIGRATION_PATH = "/api/stock/migrations/cw";

const defaultApiBodyLimit = bodyLimit({
  maxSize: API_BODY_LIMIT_BYTES,
  onError: (context) => context.json({ error: "Request body is too large." }, 413),
});
const stockMigrationBodyLimit = bodyLimit({
  maxSize: MAX_CW_STOCK_REQUEST_BYTES,
  onError: (context) => context.json({ error: "Request body is too large." }, 413),
});

const securityOptions = isProduction ? {
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    imgSrc: ["'self'", "data:", "https:"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  },
  permissionsPolicy: {
    camera: [],
    geolocation: [],
    microphone: [],
  },
  referrerPolicy: "strict-origin-when-cross-origin" as const,
  xFrameOptions: "DENY" as const,
} : {};

export function createServerApp() {
  const app = new Hono();

  app.use("*", secureHeaders(securityOptions));
  app.use("/api/*", async (context, next) => {
    await next();
    if (!context.res.headers.has("cache-control")) context.header("Cache-Control", "no-store");
  });
  app.use("/api/*", (context, next) => (
    context.req.path === STOCK_MIGRATION_PATH
      ? stockMigrationBodyLimit(context, next)
      : defaultApiBodyLimit(context, next)
  ));

  const invoke = (apiHandler: ApiHandler) => (context: Context) => (
    runWithRequest(context.req.raw, () => apiHandler(context.req.raw))
  );

  for (const route of apiRoutes) {
    app.on(route.method, route.path, invoke(route.handler));
  }

  app.all("/api/*", (context) => context.json({ error: "API route not found." }, 404));

  if (isProduction) {
    app.use("/assets/*", async (context, next) => {
      await next();
      if (context.res.status === 200) {
        context.header("Cache-Control", "public, max-age=31536000, immutable");
      }
    });
    app.use("*", serveStatic({ root: "./dist" }));
    app.get("*", serveStatic({ path: "./dist/index.html" }));
  }

  app.onError((error, context) => {
    console.error("Unhandled server request error", error);
    return context.json({ error: "Internal server error." }, 500);
  });

  return app;
}
