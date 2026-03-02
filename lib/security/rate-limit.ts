const USER_LIMIT = { max: 10, windowSeconds: 60 * 60 };
const IP_LIMIT = { max: 3, windowSeconds: 60 };

type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

async function incrementWithWindow(key: string, windowSeconds: number) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) throw new Error("Rate limiting is not configured");

  const baseUrl = redisUrl.replace(/\/$/, "");
  const countRes = await fetch(`${baseUrl}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}` }
  });

  if (!countRes.ok) throw new Error("Rate limiting is unavailable");
  const countJson = (await countRes.json()) as { result?: number };
  const count = Number(countJson.result ?? 0);

  if (count === 1) {
    await fetch(`${baseUrl}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisToken}` }
    });
  }

  const ttlRes = await fetch(`${baseUrl}/ttl/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}` }
  });
  const ttlJson = (await ttlRes.json()) as { result?: number };
  const ttl = Number(ttlJson.result ?? windowSeconds);

  return { count, ttl: ttl > 0 ? ttl : windowSeconds };
}

async function enforceLimit(key: string, limit: { max: number; windowSeconds: number }): Promise<LimitResult> {
  const { count, ttl } = await incrementWithWindow(key, limit.windowSeconds);
  const remaining = Math.max(0, limit.max - count);
  return {
    allowed: count <= limit.max,
    remaining,
    retryAfter: ttl
  };
}

export async function enforceImportRateLimits(userId: string, ip: string) {
  const [userLimit, ipLimit] = await Promise.all([
    enforceLimit(`import:user:${userId}`, USER_LIMIT),
    enforceLimit(`import:ip:${ip}`, IP_LIMIT)
  ]);

  if (!userLimit.allowed || !ipLimit.allowed) {
    return {
      allowed: false,
      retryAfter: Math.max(userLimit.retryAfter, ipLimit.retryAfter)
    };
  }

  return {
    allowed: true,
    retryAfter: 0
  };
}
