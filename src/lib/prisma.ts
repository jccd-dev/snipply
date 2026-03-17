import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Neon serverless pool
const neonPool = new Pool({ connectionString: process.env.DATABASE_URL });

// In Prisma 7, the adapter is passed to the PrismaClient constructor.
// Using 'any' for neonPool to resolve type mismatch between @neondatabase/serverless and @prisma/adapter-neon
const adapter = new PrismaNeon(neonPool as any);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;