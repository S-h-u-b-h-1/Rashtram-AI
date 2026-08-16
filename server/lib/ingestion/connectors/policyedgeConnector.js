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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

let _cachedToken = null;
let _tokenFetchedAt = 0;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const getApiToken = async () => {
  const now = Date.now();
  if (_cachedToken && now - _tokenFetchedAt < TOKEN_TTL_MS) return _cachedToken;

  const res = await fetch(TOKEN_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RashtramAI/1.0; +https://rashtram-ai.vercel.app)",
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch PolicyEdge token: HTTP ${res.status}`);
  const { token } = await res.json();
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

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; RashtramAI/1.0)",
    },
  });
  if (!res.ok) throw new Error(`Strapi API error ${res.status} for ${url}`);
  return res.json();
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
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RashtramAI/1.0; +https://rashtram-ai.vercel.app)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
};

const stripHTML = (html) =>
  html
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

const normalizedMatchText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const mapApiArticle = (item) => {
  if (!item) return null;
  const slug = String(item.slug || "").trim();
  const bodyText = String(item.plain_content || "").trim() || stripHTML(item.content || "");
  return {
    slug,
    url: slug ? `${ARTICLE_BASE}${slug}` : null,
    title: String(item.title || item.seoTitle || "").trim(),
    description: String(item.summary || item.seoDescription || "").trim(),
    bodyText,
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
  stripHTML,
  getApiToken,
  ARTICLE_BASE,
  LISTING_BASE: "https://www.policyedge.in/category/reports-data-releases",
};
