import Redis from "ioredis"
import { env } from "../env.js"

let _redis: Redis | null = null

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null
  if (_redis) return _redis
  _redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  _redis.on("error", (err) => {
    console.warn("[redis] connection error:", err.message)
  })
  return _redis
}
