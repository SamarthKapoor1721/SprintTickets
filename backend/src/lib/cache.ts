import { getRedis } from "./redis.js"

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis()
    if (!redis) return null
    const val = await redis.get(key)
    if (!val) return null
    return JSON.parse(val) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds)
  } catch {
    // ignore cache write failures
  }
}

export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    const keys = await redis.keys(pattern)
    if (keys.length > 0) await redis.del(...keys)
  } catch {
    // ignore
  }
}
