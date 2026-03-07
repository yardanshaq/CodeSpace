/**
 * Redis helper menggunakan Upstash Redis
 * Upstash menggunakan HTTP — cocok untuk Vercel serverless (tidak perlu persistent TCP connection)
 *
 * Setup:
 * 1. Buat akun di https://upstash.com
 * 2. Buat database Redis baru
 * 3. Copy UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN ke .env
 *
 * Cara pakai di snippet:
 *   const { redis } = require('@/lib/redis')
 *   await redis.set('key', 'value')
 *   await redis.set('key', 'value', { ex: 60 }) // expire 60 detik
 *   const val = await redis.get('key')
 *   await redis.del('key')
 *   await redis.exists('key')
 */

import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error("UPSTASH_REDIS_REST_URL is not set in environment variables");
}
if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    "UPSTASH_REDIS_REST_TOKEN is not set in environment variables"
  );
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Helper: simpan data dengan prefix namespace supaya tidak bentrok
 * @example
 *   const cache = createRedisCache('spotify')
 *   await cache.set('token', value, 3600) // expire 1 jam
 *   const token = await cache.get('token')
 */
export function createRedisCache(namespace: string) {
  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      return redis.get<T>(`${namespace}:${key}`);
    },
    async set(key: string, value: unknown, exSeconds?: number): Promise<void> {
      if (exSeconds) {
        await redis.set(`${namespace}:${key}`, value, { ex: exSeconds });
      } else {
        await redis.set(`${namespace}:${key}`, value);
      }
    },
    async del(key: string): Promise<void> {
      await redis.del(`${namespace}:${key}`);
    },
    async exists(key: string): Promise<boolean> {
      const result = await redis.exists(`${namespace}:${key}`);
      return result === 1;
    },
    async ttl(key: string): Promise<number> {
      return redis.ttl(`${namespace}:${key}`);
    },
  };
}
