import {PrismaBetterSqlite3} from "@prisma/adapter-better-sqlite3";
import {PrismaClient} from "@@/prisma/generated/client";

const prismaClientSingleton = () => {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./mhost.db";
  const pool = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter: pool });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Get an option value by key.
 */
export async function getOption<T = string>(key: string, defaultValue: T | null = null): Promise<T | null> {
  const option = await prisma.option.findUnique({
    where: { key },
  });

  if (!option) {
    return defaultValue;
  }

  try {
    return JSON.parse(option.value) as T;
  } catch {
    return option.value as unknown as T;
  }
}

/**
 * Set an option value by key.
 */
export async function setOption(key: string, value: any): Promise<void> {
  const valueToString = typeof value === "string" ? value : JSON.stringify(value);

  await prisma.option.upsert({
    where: { key },
    update: { value: valueToString },
    create: { key, value: valueToString },
  });
}
