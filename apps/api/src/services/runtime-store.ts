import { createHash } from "node:crypto";
import Redis from "ioredis";

interface MemoryEntry<T> {
  value: T;
  expiresAt: number;
}

export class RuntimeStore {
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();
  private readonly values = new Map<string, MemoryEntry<string>>();
  private readonly leases = new Map<string, MemoryEntry<string>>();
  private readonly generations = new Map<string, number>();

  constructor(private readonly redis: Redis | null = null) {}

  private key(scope: string, value: string): string {
    const digest = createHash("sha256").update(value).digest("hex");
    return `vaani:${scope}:${digest}`;
  }

  async allow(scope: string, identity: string, limit: number, windowSeconds: number): Promise<boolean> {
    const key = this.key(`rate:${scope}`, identity);
    if (this.redis) {
      try {
        const count = await this.redis.incr(key);
        if (count === 1) await this.redis.expire(key, windowSeconds);
        return count <= limit;
      } catch {
        return this.allowMemory(key, limit, windowSeconds);
      }
    }
    return this.allowMemory(key, limit, windowSeconds);
  }

  private allowMemory(key: string, limit: number, windowSeconds: number): boolean {
    const now = Date.now();
    const prior = this.counters.get(key);
    const entry = !prior || prior.expiresAt <= now
      ? { count: 0, expiresAt: now + windowSeconds * 1_000 }
      : prior;
    entry.count += 1;
    this.counters.set(key, entry);
    return entry.count <= limit;
  }

  async acquireLease(scope: string, identity: string, owner: string, ttlSeconds: number): Promise<boolean> {
    const key = this.key(`lease:${scope}`, identity);
    if (this.redis) {
      try { return (await this.redis.set(key, owner, "EX", ttlSeconds, "NX")) === "OK"; }
      catch { return this.acquireLeaseMemory(key, owner, ttlSeconds); }
    }
    return this.acquireLeaseMemory(key, owner, ttlSeconds);
  }

  private acquireLeaseMemory(key: string, owner: string, ttlSeconds: number): boolean {
    const current = this.leases.get(key);
    if (current && current.expiresAt > Date.now()) return false;
    this.leases.set(key, { value: owner, expiresAt: Date.now() + ttlSeconds * 1_000 });
    return true;
  }

  async releaseLease(scope: string, identity: string, owner: string): Promise<void> {
    const key = this.key(`lease:${scope}`, identity);
    if (this.redis) {
      try {
        await this.redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          key,
          owner,
        );
        return;
      } catch { /* Fall through to the process-local lease map. */ }
    }
    if (this.leases.get(key)?.value === owner) this.leases.delete(key);
  }

  async setJson(scope: string, identity: string, value: unknown, ttlSeconds: number): Promise<void> {
    const key = this.key(`state:${scope}`, identity);
    const json = JSON.stringify(value);
    if (this.redis) {
      try { await this.redis.set(key, json, "EX", ttlSeconds); return; }
      catch { /* Use a local cache if the optional Redis service is unavailable. */ }
    }
    this.values.set(key, { value: json, expiresAt: Date.now() + ttlSeconds * 1_000 });
  }

  async getJson<T>(scope: string, identity: string): Promise<T | null> {
    const key = this.key(`state:${scope}`, identity);
    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) as T : null;
      } catch { /* Fall through to the local cache. */ }
    }
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async bumpGeneration(identity: string): Promise<number> {
    const key = this.key("generation", identity);
    if (this.redis) {
      try { return await this.redis.incr(key); }
      catch { /* Fall through to the process-local counter. */ }
    }
    const next = (this.generations.get(key) ?? 0) + 1;
    this.generations.set(key, next);
    return next;
  }

  async publish(topic: string, payload: unknown): Promise<void> {
    if (!this.redis) return;
    try { await this.redis.publish(this.key("event", topic), JSON.stringify(payload)); }
    catch { /* Pub/sub is an optional multi-instance enhancement. */ }
  }

  async close(): Promise<void> {
    if (this.redis) await this.redis.quit().catch(() => this.redis?.disconnect());
  }

  get redisEnabled(): boolean { return Boolean(this.redis); }
}

export async function createRuntimeStore(url = process.env.REDIS_URL): Promise<RuntimeStore> {
  if (!url) return new RuntimeStore();
  const client = new Redis(url, { lazyConnect: true, connectTimeout: 1_500, maxRetriesPerRequest: 1 });
  try {
    await client.connect();
    await client.ping();
    return new RuntimeStore(client);
  } catch {
    client.disconnect();
    return new RuntimeStore();
  }
}
