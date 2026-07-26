# Server

This is the only backend source tree.

- `routes/` translates HTTP requests and responses.
- `auth/` owns authentication, sessions, and authorization.
- `db/` owns Prisma access, repositories, persistence validation, and database mapping.
- `import/` parses and normalizes uploaded migration data.
- `composition/`, `product-images/`, and `receipts/` own focused backend workflows.
- `generated/prisma/` is generated from `prisma/schema.prisma` and is not committed.
- `apiRegistry.ts`, `app.ts`, and `index.ts` compose and start the Hono server.

Use `@server/*` for imports within this tree. Keep browser runtime code in `src/`.
