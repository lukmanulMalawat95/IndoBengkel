import { randomUUID } from "node:crypto";
import {
  RedisRateLimitStore,
  rateLimitKey,
} from "../src/common/security/rate-limit-store";

const redisUrl = process.env.REDIS_URL;
const describeWithRedis = redisUrl ? describe : describe.skip;

describeWithRedis("Redis rate-limit store", () => {
  let store: RedisRateLimitStore;

  beforeAll(() => {
    store = new RedisRateLimitStore(redisUrl!, { onError: () => undefined });
  });

  afterAll(async () => {
    await store?.quit();
  });

  it("increments atomically and keeps the window TTL", async () => {
    await store.ready(2_000);

    const key = rateLimitKey("store.test", randomUUID());
    const first = await store.increment(key, 60_000);
    const second = await store.increment(key, 60_000);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    expect(second.resetAt).toBeGreaterThan(Date.now());
    expect(second.resetAt - Date.now()).toBeLessThanOrEqual(60_000);
  });
});
