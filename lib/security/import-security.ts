import dns from "node:dns/promises";
import net from "node:net";

const MAX_IMPORT_BYTES = 1_500_000;
const CONNECT_TIMEOUT_MS = 4_000;
const READ_TIMEOUT_MS = 8_000;

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

const isIPv4PrivateOrReserved = (ip: string) => {
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;

  if (octets[0] === 0 || octets[0] === 10 || octets[0] === 127) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] >= 224) return true;

  return false;
};

const isIPv6Blocked = (ip: string) => {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("ff")
  );
};

const isBlockedIp = (ip: string) => {
  const ipVersion = net.isIP(ip);
  if (!ipVersion) return true;
  if (ipVersion === 4) return isIPv4PrivateOrReserved(ip);
  return isIPv6Blocked(ip);
};

async function ensurePublicHostname(hostname: string) {
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length || records.some((entry: { address: string }) => isBlockedIp(entry.address))) {
    throw new Error("Blocked URL");
  }
}

export async function validateUrlForFetch(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Blocked URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Blocked URL");
  if (parsed.username || parsed.password) throw new Error("Blocked URL");

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) throw new Error("Blocked URL");
  if (hostname === "169.254.169.254") throw new Error("Blocked URL");

  const ipVersion = net.isIP(hostname);
  if (ipVersion && isBlockedIp(hostname)) throw new Error("Blocked URL");
  if (!ipVersion) await ensurePublicHostname(hostname);

  return parsed;
}

export async function safeFetchHtml(url: string) {
  const parsed = await validateUrlForFetch(url);

  const connectController = new AbortController();
  const connectTimer = setTimeout(() => connectController.abort(), CONNECT_TIMEOUT_MS);
  const firstResponse = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": "Mozilla/5.0 MyHireBot/1.0" },
    signal: connectController.signal
  }).finally(() => clearTimeout(connectTimer));

  let response = firstResponse;
  if (response.status >= 300 && response.status < 400) {
    const nextLocation = response.headers.get("location");
    if (!nextLocation) throw new Error("Blocked URL");
    const redirectTarget = new URL(nextLocation, parsed).toString();
    await validateUrlForFetch(redirectTarget);

    const redirectController = new AbortController();
    const redirectTimer = setTimeout(() => redirectController.abort(), CONNECT_TIMEOUT_MS);
    response = await fetch(redirectTarget, {
      method: "GET",
      redirect: "error",
      headers: { "User-Agent": "Mozilla/5.0 MyHireBot/1.0" },
      signal: redirectController.signal
    }).finally(() => clearTimeout(redirectTimer));
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const readStart = Date.now();

  try {
    let total = 0;
    const chunks: Buffer[] = [];
    while (true) {
      if (Date.now() - readStart > READ_TIMEOUT_MS) throw new Error("Timed out");
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_IMPORT_BYTES) throw new Error("Response too large");
      chunks.push(Buffer.from(value));
    }

    return new TextDecoder().decode(Buffer.concat(chunks));
  } finally {
    reader.releaseLock();
  }
}
