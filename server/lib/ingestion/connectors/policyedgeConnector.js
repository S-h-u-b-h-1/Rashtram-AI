/**
 * PolicyEdge Connector — Strapi API-based (not HTML scraping)
 *
 * The PolicyEdge website uses a Strapi backend. Listing pages 2+ are
 * client-side rendered and not scrapable via plain HTTP. Instead, we
 * discover the public read-token from the Next.js /api/token route and
 * call the Strapi API directly.
 */

const cheerio = require("cheerio");

const API_BASE = "https://api.policyedge.in";
const TOKEN_URL = "https://www.policyedge.in/api/token";
const ARTICLE_BASE = "https://www.policyedge.in/p/";
const CATEGORY_SLUG = "reports-data-releases";
const ALLOWED_HOSTS = new Set(["www.policyedge.in", "api.policyedge.in"]);
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assertPolicyEdgeUrl = (value) => {
  const parsed = new URL(String(value || ""));
  if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
      !ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    const error = new Error("PolicyEdge fetch rejected an invalid or unrelated URL.");
    error.failureCode = "HTML_REDIRECT_INVALID";
    error.status = 422;
    throw error;
  }
  return parsed;
};

const boundedFetch = async (initialUrl, { accept, retries = 2 } = {}) => {
  let current = assertPolicyEdgeUrl(initialUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      timeout.unref?.();
      try {
        const response = await fetch(current.href, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "RashtramAI-PolicyEdge/2.0 (+https://rashtram-ai.vercel.app)",
            Accept: accept || "text/html,application/json;q=0.9",
          },
        });
        clearTimeout(timeout);
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location || redirect === 3) {
            const error = new Error("PolicyEdge returned an invalid redirect.");
            error.failureCode = "HTML_REDIRECT_INVALID";
            error.status = 422;
            throw error;
          }
          current = assertPolicyEdgeUrl(new URL(location, current).href);
          lastError = null;
          break;
        }
        if (!response.ok) {
          const error = new Error(`PolicyEdge returned HTTP ${response.status}.`);
          error.status = response.status;
          error.failureCode = response.status === 401 || response.status === 403
            ? "HTML_ACCESS_DENIED"
            : "HTML_FETCH_FAILED";
          if (attempt < retries && (response.status === 429 || response.status >= 500)) {
            lastError = error;
            await delay(Math.min(4_000, 400 * 2 ** attempt));
            continue;
          }
          throw error;
        }
        const declaredLength = Number(response.headers.get("content-length") || 0);
        if (declaredLength > MAX_RESPONSE_BYTES) {
          const error = new Error("PolicyEdge response exceeded the safe size limit.");
          error.failureCode = "HTML_UNSUPPORTED_STRUCTURE";
          error.status = 422;
          throw error;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_RESPONSE_BYTES) {
          const error = new Error("PolicyEdge response exceeded the safe size limit.");
          error.failureCode = "HTML_UNSUPPORTED_STRUCTURE";
          error.status = 422;
          throw error;
        }
        return {
          buffer,
          contentType: String(response.headers.get("content-type") || "").toLowerCase(),
          status: response.status,
          url: current.href,
        };
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (error.name === "AbortError") {
          error.failureCode = "HTML_FETCH_FAILED";
          error.status = 504;
        }
        if (attempt < retries && (!error.status || error.status >= 500 || error.status === 429)) {
          await delay(Math.min(4_000, 400 * 2 ** attempt));
          continue;
        }
        throw error;
      }
    }
    if (lastError) throw lastError;
  }
  throw new Error("PolicyEdge fetch could not be completed.");
};

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

let _cachedToken = null;
let _tokenFetchedAt = 0;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const getApiToken = async () => {
  const now = Date.now();
  if (_cachedToken && now - _tokenFetchedAt < TOKEN_TTL_MS) return _cachedToken;

  const response = await boundedFetch(TOKEN_URL, { accept: "application/json" });
  if (!response.contentType.includes("json")) {
    const error = new Error("PolicyEdge token endpoint returned a non-JSON response.");
    error.failureCode = "HTML_CONTENT_TYPE_MISMATCH";
    throw error;
  }
  const { token } = JSON.parse(response.buffer.toString("utf8"));
  if (!token) throw new Error("PolicyEdge /api/token returned no token");
  _cachedToken = token;
  _tokenFetchedAt = now;
  return token;
};

// ---------------------------------------------------------------------------
// Strapi API helpers
// ---------------------------------------------------------------------------

const strapiGet = async (path, params = {}) => {
  const token = await getApiToken();
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  timeout.unref?.();
  try {
    const res = await fetch(assertPolicyEdgeUrl(url.toString()).href, {
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "RashtramAI-PolicyEdge/2.0",
      },
    });
    if (!res.ok) throw new Error(`Strapi API error ${res.status} for PolicyEdge.`);
    const declaredLength = Number(res.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("PolicyEdge API response exceeded the safe size limit.");
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_RESPONSE_BYTES) throw new Error("PolicyEdge API response exceeded the safe size limit.");
    if (!String(res.headers.get("content-type") || "").toLowerCase().includes("json")) {
      const error = new Error("PolicyEdge API returned an unsupported content type.");
      error.failureCode = "HTML_CONTENT_TYPE_MISMATCH";
      throw error;
    }
    return JSON.parse(buffer.toString("utf8"));
  } finally {
    clearTimeout(timeout);
  }
};

// ---------------------------------------------------------------------------
// Listing — all articles in a category
// ---------------------------------------------------------------------------

const fetchPage = async (page = 1, pageSize = 12) => {
  console.log(`  Fetching listing page ${page}...`);
  const data = await strapiGet("/api/articles", {
    "filters[state][$eq]": "published",
    "filters[categories][slug][$eq]": CATEGORY_SLUG,
    "pagination[page]": String(page),
    "pagination[pageSize]": String(pageSize),
    "sort": "publishDate:desc",
    "fields[0]": "slug",
    "fields[1]": "title",
    "fields[2]": "publishDate",
    "fields[3]": "summary",
    "populate[0]": "categories",
    "populate[1]": "institutions",
  });

  const meta = data?.meta?.pagination || {};
  const articles = (data?.data || []).map((item) => ({
    slug: item.slug,
    title: item.title || item.slug,
    date: item.publishDate || null,
    url: `${ARTICLE_BASE}${item.slug}`,
    summary: item.summary || null,
    institutions: (item.institutions || []).map((i) => i.name || "").filter(Boolean),
    category: (item.categories || [])[0]?.name || "Reports/Data Releases",
  }));

  return {
    articles,
    meta: {
      total: meta.total || 0,
      totalPages: meta.pageCount || 1,
      page: meta.page || page,
      pageSize: meta.pageSize || pageSize,
    },
  };
};

const fetchAllPages = async (maxPages = 99999, delayMs = 800) => {
  const first = await fetchPage(1);
  const totalPages = Math.min(first.meta.totalPages, maxPages);

  console.log(
    `  Total: ${first.meta.total} articles across ${first.meta.totalPages} pages. Fetching ${totalPages} pages.`,
  );

  const allArticles = [...first.articles];

  for (let page = 2; page <= totalPages; page += 1) {
    await delay(delayMs);
    const pageData = await fetchPage(page);
    allArticles.push(...pageData.articles);
  }

  return {
    total: first.meta.total,
    totalPages: first.meta.totalPages,
    fetchedPages: totalPages,
    listings: allArticles,
  };
};

// ---------------------------------------------------------------------------
// Article detail — fetch full body text from the HTML page
// ---------------------------------------------------------------------------

const fetchHTML = async (url) => {
  const response = await boundedFetch(url, { accept: "text/html,application/xhtml+xml" });
  const prefix = response.buffer.subarray(0, 512).toString("utf8");
  if (!response.contentType.includes("text/html") &&
      !response.contentType.includes("application/xhtml") &&
      !/^\s*<(?:!doctype\s+html|html)\b/i.test(prefix)) {
    const error = new Error("PolicyEdge page did not return supported HTML.");
    error.failureCode = "HTML_CONTENT_TYPE_MISMATCH";
    error.status = 422;
    throw error;
  }
  return response.buffer.toString("utf8");
};

const stripHTML = (html) =>
  String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 10)),
    )
    .replace(/\s+/g, " ")
    .trim();

const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const richContentHtml = (value) => {
  if (typeof value === "string") return value;
  if (!value) return "";
  const nodes = Array.isArray(value) ? value : [value];
  const render = (node) => {
    if (node == null) return "";
    if (typeof node === "string") return escapeHtml(node);
    if (typeof node.text === "string") return escapeHtml(node.text);
    const children = (node.children || []).map(render).join("");
    if (node.type === "heading") {
      const level = Math.max(1, Math.min(6, Number(node.level || 2)));
      return `<h${level}>${children}</h${level}>`;
    }
    if (node.type === "paragraph") return `<p>${children}</p>`;
    if (node.type === "list") {
      const tag = node.format === "ordered" ? "ol" : "ul";
      return `<${tag}>${children}</${tag}>`;
    }
    if (node.type === "list-item") return `<li>${children}</li>`;
    if (node.type === "quote") return `<blockquote>${children}</blockquote>`;
    if (node.type === "table") return `<table><tbody>${children}</tbody></table>`;
    if (node.type === "table-row") return `<tr>${children}</tr>`;
    if (node.type === "table-cell") return `<td>${children}</td>`;
    if (node.type === "link" && node.url) {
      return `<a href="${escapeHtml(node.url)}">${children}</a>`;
    }
    return children;
  };
  return nodes.map(render).join("\n");
};

const normalizedMatchText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const mapApiArticle = (item) => {
  if (!item) return null;
  const slug = String(item.slug || "").trim();
  const rawHtml = richContentHtml(item.content);
  const bodyText = String(item.plain_content || "").trim() || stripHTML(rawHtml);
  return {
    slug,
    url: slug ? `${ARTICLE_BASE}${slug}` : null,
    title: String(item.title || item.seoTitle || "").trim(),
    description: String(item.summary || item.seoDescription || "").trim(),
    bodyText,
    rawHtml: rawHtml.trim() || null,
    sdgTags: (item.tags || []).map((tag) => tag?.name || tag?.title || "").filter(Boolean),
    institutions: (item.institutions || []).map((institution) => institution?.name || "").filter(Boolean),
    category: (item.categories || [])[0]?.name || "Reports/Data Releases",
    publishDate: item.publishDate || item.publishedAt || null,
    extractionSource: "policyedge_api",
  };
};

const fetchArticleFromApi = async (slug, title = "") => {
  const lookup = async (filters) => {
    const response = await strapiGet("/api/articles", {
      ...filters,
      "filters[state][$eq]": "published",
      "pagination[pageSize]": "10",
      populate: "*",
    });
    return response?.data || [];
  };

  let candidates = slug
    ? await lookup({ "filters[slug][$eq]": slug })
    : [];
  if (!candidates.length && title) {
    candidates = await lookup({ "filters[title][$containsi]": title.slice(0, 180) });
  }
  if (!candidates.length) return null;

  const normalizedSlug = normalizedMatchText(slug);
  const normalizedTitle = normalizedMatchText(title);
  const selected = candidates.find((item) => normalizedMatchText(item.slug) === normalizedSlug)
    || candidates.find((item) => normalizedMatchText(item.title) === normalizedTitle)
    || candidates[0];
  return mapApiArticle(selected);
};

const fetchArticleFromHtml = async (slug) => {
  const url = `${ARTICLE_BASE}${slug}`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  const htmlTitle = stripHTML(
    $("#article-heading").first().html()
      || $("meta[property='og:title']").attr("content")
      || $("h1").first().html()
      || $("title").first().html()
      || "",
  );
  const description = stripHTML(
    $("meta[name='description']").attr("content")
      || $("meta[property='og:description']").attr("content")
      || "",
  );
  $("script, style, noscript, template, nav, header, footer, aside").remove();
  const bodyText = $("#single-entry-content, article, main, [role='main']")
    .toArray()
    .map((element) => stripHTML($(element).html() || ""))
    .filter((text) => text.length >= 40)
    .sort((left, right) => right.length - left.length)[0]
    || stripHTML($("body").html() || "");

  const sdgTags = $("a[href^='/sdg/']")
    .toArray()
    .map((element) => stripHTML($(element).html() || ""))
    .filter(Boolean);
  const institutions = $("a[href^='/institution/']")
    .toArray()
    .map((element) => stripHTML($(element).html() || ""))
    .filter(Boolean);

  return {
    slug,
    url,
    title: htmlTitle,
    description,
    bodyText,
    rawHtml: html,
    sdgTags,
    institutions,
    category: "Reports/Data Releases",
    extractionSource: "policyedge_html",
  };
};

const fetchArticle = async (slug, options = {}) => {
  console.log(`    Fetching article: ${slug}`);
  let apiError = null;
  try {
    const apiArticle = await fetchArticleFromApi(slug, options.title || "");
    if (apiArticle?.bodyText) return apiArticle;
  } catch (error) {
    apiError = error;
    console.warn(`    PolicyEdge API article lookup failed for ${slug}: ${error.message}`);
  }

  try {
    return await fetchArticleFromHtml(slug);
  } catch (htmlError) {
    if (apiError) {
      const error = new Error(
        `PolicyEdge article could not be read through its API or public page: ${htmlError.message}`,
      );
      error.cause = apiError;
      throw error;
    }
    throw htmlError;
  }
};

// ---------------------------------------------------------------------------
// HTML listing helpers kept for backward compat (page 1 only)
// ---------------------------------------------------------------------------
const extractArticleLinks = (html) => {
  const links = [];
  const linkRegex = /href="\/p\/([^"]+)"/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const slug = match[1];
    if (!links.includes(slug)) links.push(slug);
  }
  return links;
};

const extractListingMeta = (html) => {
  const pageLinks = [...html.matchAll(/page=(\d+)/g)].map((m) =>
    Number.parseInt(m[1], 10),
  );
  const totalPages = pageLinks.length ? Math.max(...pageLinks) : 1;
  return { total: 0, totalPages };
};

module.exports = {
  extractArticleLinks,
  extractListingMeta,
  fetchAllPages,
  fetchArticle,
  fetchArticleFromApi,
  fetchArticleFromHtml,
  fetchHTML,
  fetchPage,
  mapApiArticle,
  boundedFetch,
  assertPolicyEdgeUrl,
  stripHTML,
  getApiToken,
  ARTICLE_BASE,
  LISTING_BASE: "https://www.policyedge.in/category/reports-data-releases",
};
