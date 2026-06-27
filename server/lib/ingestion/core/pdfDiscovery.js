const cheerio = require("cheerio");

const absoluteUrl = (url, baseUrl) => {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
};

const discoverPdfLinks = (html, baseUrl) => {
  const $ = cheerio.load(html || "");
  const links = [];
  const seen = new Set();

  $("a[href], meta[name='citation_pdf_url']").each((_, element) => {
    const rawUrl =
      $(element).attr("href") || $(element).attr("content") || "";
    const label = $(element).text().replace(/\s+/g, " ").trim() || "PDF";
    const url = absoluteUrl(rawUrl, baseUrl);
    if (
      !url ||
      seen.has(url) ||
      !(/\.pdf(?:$|[?#])/i.test(url) || /bitstream/i.test(url))
    ) {
      return;
    }
    seen.add(url);
    links.push({
      label,
      resourceType: "pdf",
      category: "source-document",
      url,
    });
  });
  return links;
};

module.exports = {
  absoluteUrl,
  discoverPdfLinks,
};
