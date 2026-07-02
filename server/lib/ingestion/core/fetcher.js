const axios = require("axios");

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const parseRobots = (body) => {
  const rules = [];
  let applies = false;

  for (const rawLine of String(body || "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      applies = value === "*";
    } else if (applies && (key === "allow" || key === "disallow")) {
      if (value) rules.push({ type: key, path: value });
    }
  }
  return rules;
};

const isPathAllowed = (pathname, rules) => {
  const matches = rules
    .filter((rule) => pathname.startsWith(rule.path))
    .sort((left, right) => right.path.length - left.path.length);
  return !matches.length || matches[0].type === "allow";
};

class PoliteFetcher {
  constructor(options = {}) {
    this.delayMs = Number(options.delayMs ?? 750);
    this.timeoutMs = Number(options.timeoutMs ?? 30_000);
    this.retries = Number(options.retries ?? 3);
    this.respectRobots = options.respectRobots !== false;
    this.userAgent =
      options.userAgent ||
      "RashtramAI-Catalog/1.0";
    this.client =
      options.client ||
      axios.create({
        timeout: this.timeoutMs,
        maxRedirects: 5,
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });
    this.lastRequestAt = new Map();
    this.hostQueues = new Map();
    this.robotsCache = new Map();
  }

  async waitForHost(hostname) {
    const previousQueue = this.hostQueues.get(hostname) || Promise.resolve();
    const queued = previousQueue
      .catch(() => {})
      .then(async () => {
        const previous = this.lastRequestAt.get(hostname) || 0;
        const waitMs = Math.max(
          0,
          this.delayMs - (Date.now() - previous),
        );
        if (waitMs) await sleep(waitMs);
        this.lastRequestAt.set(hostname, Date.now());
      });
    this.hostQueues.set(hostname, queued);
    await queued;
    if (this.hostQueues.get(hostname) === queued) {
      this.hostQueues.delete(hostname);
    }
  }

  async robotsRules(url) {
    const parsed = new URL(url);
    const origin = parsed.origin;
    if (this.robotsCache.has(origin)) return this.robotsCache.get(origin);

    try {
      await this.waitForHost(parsed.hostname);
      const response = await this.client.get(`${origin}/robots.txt`, {
        validateStatus: (status) => status >= 200 && status < 500,
      });
      const rules = response.status === 200 ? parseRobots(response.data) : [];
      this.robotsCache.set(origin, rules);
      return rules;
    } catch {
      this.robotsCache.set(origin, []);
      return [];
    }
  }

  async assertAllowed(url) {
    if (!this.respectRobots) return;
    const parsed = new URL(url);
    const rules = await this.robotsRules(url);
    if (!isPathAllowed(`${parsed.pathname}${parsed.search}`, rules)) {
      throw new Error(`robots.txt disallows catalog fetch: ${url}`);
    }
  }

  async get(url, options = {}) {
    await this.assertAllowed(url);
    const parsed = new URL(url);
    let lastError;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        await this.waitForHost(parsed.hostname);
        return await this.client.get(url, options);
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        if (
          attempt >= this.retries ||
          (status && status < 500 && status !== 429)
        ) {
          break;
        }
        await sleep(Math.min(8_000, 500 * 2 ** attempt));
      }
    }
    throw lastError;
  }

  async getText(url, options = {}) {
    const response = await this.get(url, {
      ...options,
      responseType: "text",
    });
    return {
      body: String(response.data || ""),
      status: response.status,
      headers: response.headers,
      url: response.request?.res?.responseUrl || url,
    };
  }

  async getBuffer(url, options = {}) {
    const response = await this.get(url, {
      ...options,
      responseType: "arraybuffer",
    });
    return {
      body: Buffer.from(response.data),
      status: response.status,
      headers: response.headers,
      url: response.request?.res?.responseUrl || url,
    };
  }
}

const fetchWithRetry = (
  url,
  { fetcher, requestOptions = {}, ...fetcherOptions } = {},
) =>
  (fetcher || new PoliteFetcher(fetcherOptions)).get(url, requestOptions);

const politeFetch = fetchWithRetry;

module.exports = {
  PoliteFetcher,
  fetchWithRetry,
  isPathAllowed,
  parseRobots,
  politeFetch,
  sleep,
};
