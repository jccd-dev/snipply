import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 1. Define configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(poolConfig),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
