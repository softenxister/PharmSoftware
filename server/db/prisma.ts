import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@server/generated/prisma/client";
import { normalizePostgresConnectionString } from "./postgresConnection";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: normalizePostgresConnectionString(connectionString) }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
