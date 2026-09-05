import { createClient, type RedisClientType } from 'redis';
import { randomUUID } from 'node:crypto';

type RedisClient = RedisClientType;

let clientPromise: Promise<RedisClient | null> | undefined;

/** Return the shared Redis client, or null when Redis is not configured. */
async function getClient(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) return null;
  if (!clientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (error) => console.error('Redis error:', error));
    clientPromise = client.connect().then(() => client).catch((error) => {
      console.error('Redis connection failed; using local cache:', error);
      clientPromise = undefined;
      return null;
    });
  }
  return clientPromise;
}

/** Read and JSON-decode a cached value from Redis. */
export async function getCachedValue<T>(key: string): Promise<T | null> {
  const client = await getClient();
  if (!client) return null;
  const value = await client.get(key);
  return value ? JSON.parse(value) as T : null;
}

/** Store a JSON-serializable value in Redis for the requested number of seconds. */
export async function setCachedValue(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = await getClient();
  if (!client) return;
  await client.set(key, JSON.stringify(value), { EX: Math.max(1, ttlSeconds) });
}

/** Run work under a Redis-backed lock, falling back to the local process when Redis is disabled. */
export async function withRedisLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const client = await getClient();
  if (!client) return work();

  const lockValue = randomUUID();
  const deadline = Date.now() + 5_000;
  let acquired = false;

  while (!acquired && Date.now() < deadline) {
    acquired = (await client.set(key, lockValue, { NX: true, PX: 10_000 })) === 'OK';
    if (!acquired) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!acquired) throw new Error('Timed out waiting for Redis lock');

  try {
    return await work();
  } finally {
    await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: [key], arguments: [lockValue] },
    );
  }
}