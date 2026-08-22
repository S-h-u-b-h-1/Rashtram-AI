const crypto = require("node:crypto");
const cheerio = require("cheerio");

const DEFAULT_MAX_TEXT = 500_000;
const DEFAULT_CHUNK_SIZE = 1_800;
const MIN_RESEARCH_TEXT = 120;
const BOILERPLATE_SELECTOR = [
  "script", "style", "noscript", "template", "svg", "canvas", "iframe",
  "nav", "header", "footer", "aside", "form", "dialog",
  "[role='navigation']", "[role='banner']", "[role='contentinfo']",
  "[aria-modal='true']", ".cookie", ".cookie-banner", ".newsletter",
  ".social-share", ".share-buttons", ".related-posts", ".sidebar",
  "#cookie-banner", "#newsletter", "#sidebar",
].join(",");
const ERROR_PAGE_PATTERN = /\b(access denied|forbidden|captcha|verify you are human|sign in to continue|log in to continue|page not found|service unavailable)\b/i;
const DYNAMIC_SHELL_PATTERN = /^(?:loading(?:\.\.\.)?|please wait|enable javascript|javascript is required)$/i;

const sha256 = (value) => crypto
  .createHash("sha256")
  .update(Buffer.isBuffer(value) ? value : String(value || ""))
  .digest("hex");

const cleanText = (value, maxLength = DEFAULT_MAX_TEXT) => String(value || "")
  .normalize("NFKC")
  .replace(/\u0000/g, "")
  .replace(/\r\n?/g, "\n")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/[ \t]{2,}/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim()
  .slice(0, maxLength);

const stableAnchor = (value) => {
  const anchor = String(value || "").trim();
  return /^[A-Za-z][A-Za-z0-9_:.-]{0,127}$/.test(anchor) ? anchor : null;
};

const sourceUrlWithAnchor = (sourceUrl, anchor) => {
  if (!sourceUrl || !anchor) return sourceUrl || null;
  try {
    const parsed = new URL(sourceUrl);
    parsed.hash = anchor;
    return parsed.href;
  } catch {
    return sourceUrl;
  }
};

const selectMainRoot = ($) => {
  const candidates = [];
  for (const selector of [
    "#single-entry-content", "article", "main", "[role='main']",
    ".entry-content", ".article-content", ".post-content",
    "[data-testid*='article']",
  ]) {
    $(selector).each((_, element) => {
      const textLength = cleanText($(element).text()).length;
      if (textLength >= 40) candidates.push({ element, textLength });
    });
  }
  candidates.sort((left, right) => right.textLength - left.textLength);
  return candidates[0]?.element ? $(candidates[0].element) : $("body");
};

const structuredTextCandidates = ($) => {
  const candidates = [];
  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const parsed = JSON.parse($(element).html() || "null");
      const records = Array.isArray(parsed) ? parsed : [parsed];
      for (const record of records) {
        const graph = Array.isArray(record?.["@graph"]) ? record["@graph"] : [record];
        for (const item of graph) {
          for (const field of ["articleBody", "text", "description", "abstract"]) {
            if (typeof item?.[field] === "string" && item[field].length >= 40) {
              candidates.push(cleanText(item[field]));
            }
          }
        }
      }
    } catch {
      // Invalid embedded data is ignored in favor of visible source content.
    }
  });
  const nextData = $("#__NEXT_DATA__").first().html();
  if (nextData) {
    try {
      const visit = (value, key = "", depth = 0) => {
        if (depth > 10 || value == null) return;
        if (typeof value === "string") {
          if (/^(articleBody|plain_content|content|body|description|summary|abstract)$/i.test(key) && value.length >= 40) {
            const fragment = cheerio.load(value);
            candidates.push(cleanText(fragment.root().text()));
          }
          return;
        }
        if (Array.isArray(value)) {
          value.slice(0, 100).forEach((entry) => visit(entry, key, depth + 1));
          return;
        }
        if (typeof value === "object") {
          Object.entries(value).forEach(([childKey, child]) => visit(child, childKey, depth + 1));
        }
      };
      visit(JSON.parse(nextData));
    } catch {
      // Invalid Next.js payloads do not block visible source extraction.
    }
  }
  return [...new Set(candidates.filter((value) => value.length >= 40))];
};

const tableBlocks = ($, table, sectionPath, heading, anchor, orderStart) => {
  const $table = $(table);
  const caption = cleanText($table.find("caption").first().text(), 300) || null;
  let headers = $table.find("thead tr").first().find("th,td")
    .toArray().map((cell) => cleanText($(cell).text(), 300)).filter(Boolean);
  const rows = $table.find("tbody tr, tr").toArray();
  if (!headers.length && rows.length) {
    const firstCells = $(rows[0]).find("th,td").toArray();
    if (firstCells.some((cell) => $(cell).is("th"))) {
      headers = firstCells.map((cell) => cleanText($(cell).text(), 300));
    }
  }
  const blocks = [];
  rows.forEach((row, rowIndex) => {
    const cells = $(row).find("th,td").toArray()
      .map((cell) => cleanText($(cell).text(), 2_000));
    if (!cells.some(Boolean)) return;
    if (rowIndex === 0 && headers.length && cells.join("|") === headers.join("|")) return;
    const pairs = cells.map((cell, index) => {
      const label = headers[index] || `Column ${index + 1}`;
      return `${label}: ${cell || "Not stated"}`;
    });
    blocks.push({
      type: "table_row",
      text: cleanText([
        caption ? `Table: ${caption}` : null,
        `Row ${rowIndex + 1}`,
        ...pairs,
      ].filter(Boolean).join("\n")),
      sectionPath: [...sectionPath],
      heading: heading || caption,
      anchor,
      domOrder: orderStart + blocks.length,
      tableContext: { caption, headers, rowIndex: rowIndex + 1, cells },
    });
  });
  return blocks;
};

const extractBlocks = ($, root) => {
  const blocks = [];
  const sectionStack = [];
  let currentHeading = null;
  let currentAnchor = null;
  let order = 0;
  root.find("h1,h2,h3,h4,h5,h6,p,blockquote,pre,li,table,dt,dd").each((_, element) => {
    const $element = $(element);
    if ($element.closest(BOILERPLATE_SELECTOR).length) return;
    if (!$element.is("table") && $element.closest("table").length) return;
    if (!$element.is("li") && $element.closest("li").length) return;
    const tag = String(element.tagName || element.name || "").toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      const text = cleanText($element.text(), 600);
      if (!text) return;
      sectionStack.splice(level - 1);
      sectionStack[level - 1] = text;
      while (sectionStack.length && !sectionStack[sectionStack.length - 1]) sectionStack.pop();
      currentHeading = text;
      currentAnchor = stableAnchor($element.attr("id"));
      blocks.push({
        type: "heading", text, headingLevel: level,
        sectionPath: sectionStack.filter(Boolean), heading: text,
        anchor: currentAnchor, domOrder: order++,
      });
      return;
    }
    if (tag === "table") {
      const anchor = stableAnchor($element.attr("id")) || currentAnchor;
      const rows = tableBlocks(
        $, element, sectionStack.filter(Boolean), currentHeading, anchor, order,
      );
      blocks.push(...rows);
      order += rows.length;
      return;
    }
    const text = cleanText($element.text(), 20_000);
    if (!text || DYNAMIC_SHELL_PATTERN.test(text)) return;
    const list = tag === "li" ? $element.closest("ol,ul") : null;
    blocks.push({
      type: tag === "li" ? "list_item" : tag === "dt" || tag === "dd" ? "definition" : tag === "p" ? "paragraph" : tag,
      text,
      sectionPath: sectionStack.filter(Boolean),
      heading: currentHeading,
      anchor: stableAnchor($element.attr("id")) || currentAnchor,
      domOrder: order++,
      ...(tag === "li" ? {
        listContext: {
          ordered: Boolean(list?.is("ol")),
          index: $element.index() + 1,
        },
      } : {}),
    });
  });
  return blocks;
};

const assessHtmlQuality = ({ $, root, blocks, text }) => {
  const pageText = cleanText($("body").text());
  const linkText = cleanText(root.find("a").text());
  const linkTextRatio = text.length ? Math.min(1, linkText.length / text.length) : 1;
  const meaningfulBlocks = blocks.filter((block) => block.type !== "heading");
  const errorPatternDetected = ERROR_PAGE_PATTERN.test(text.slice(0, 2_000));
  const dynamicShell = meaningfulBlocks.length === 0 && DYNAMIC_SHELL_PATTERN.test(pageText);
  const valid = text.length >= MIN_RESEARCH_TEXT && meaningfulBlocks.length > 0 &&
    linkTextRatio < 0.75 && !dynamicShell && !(errorPatternDetected && text.length < 1_200);
  const reasons = [];
  if (text.length < MIN_RESEARCH_TEXT) reasons.push("content_too_short");
  if (!meaningfulBlocks.length) reasons.push("no_meaningful_blocks");
  if (linkTextRatio >= 0.75) reasons.push("link_text_ratio_high");
  if (dynamicShell) reasons.push("dynamic_shell");
  if (errorPatternDetected && text.length < 1_200) reasons.push("error_or_login_page");
  return {
    valid,
    reasons,
    normalizedCharacters: text.length,
    headingCount: blocks.filter((block) => block.type === "heading").length,
    paragraphCount: blocks.filter((block) => block.type === "paragraph").length,
    listItemCount: blocks.filter((block) => block.type === "list_item").length,
    tableRowCount: blocks.filter((block) => block.type === "table_row").length,
    linkTextRatio: Number(linkTextRatio.toFixed(4)),
    errorPatternDetected,
    dynamicShell,
  };
};

const extractStructuredHtml = ({ html, url, preferredTitle = "", description = "" }) => {
  const rawHtml = String(html || "");
  const $ = cheerio.load(rawHtml);
  const structured = structuredTextCandidates($);
  const title = cleanText(
    preferredTitle || $("meta[property='og:title']").attr("content") ||
      $("h1").first().text() || $("title").first().text() ||
      (() => { try { return new URL(url).hostname; } catch { return "Source document"; } })(),
    300,
  );
  $(BOILERPLATE_SELECTOR).remove();
  const root = selectMainRoot($);
  let blocks = extractBlocks($, root);
  if (structured.length && !blocks.some((block) => block.type !== "heading" && block.text.length >= structured[0].length * 0.75)) {
    const prefix = structured.map((text, index) => ({
      type: "structured_text", text, sectionPath: [], heading: null,
      anchor: null, domOrder: -structured.length + index,
    }));
    blocks = [...prefix, ...blocks];
  }
  if (!blocks.some((block) => block.type !== "heading")) {
    const fallback = cleanText(root.text());
    if (fallback && !DYNAMIC_SHELL_PATTERN.test(fallback)) {
      blocks = [{
        type: "paragraph", text: fallback, sectionPath: [], heading: null,
        anchor: null, domOrder: 0,
      }];
    }
  }
  const deduplicated = [];
  const seen = new Set();
  for (const block of blocks) {
    const key = `${block.type}:${block.text}`;
    if (!block.text || seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(block);
  }
  const contentText = cleanText(deduplicated.map((block) => block.text).join("\n\n"));
  const normalizedDescription = cleanText(description, 2_000);
  const text = cleanText([
    title,
    normalizedDescription && !contentText.includes(normalizedDescription) ? normalizedDescription : null,
    contentText,
  ].filter(Boolean).join("\n\n"));
  const quality = assessHtmlQuality({ $, root, blocks: deduplicated, text });
  return {
    title,
    text,
    blocks: deduplicated,
    quality,
    rawHtmlHash: sha256(rawHtml),
    cleanContentHash: sha256(text),
    mimeType: "text/html",
    resourceType: "html",
    pageCount: null,
    extractionMethod: structured.length ? "structured_html" : "source_html",
    sourceUrl: url || null,
  };
};

const splitOversizedBlock = (block, limit) => {
  if (block.text.length <= limit || block.type === "table_row") return [block];
  const sentences = block.text.split(/(?<=[.!?।])\s+/u);
  const parts = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > limit) {
      parts.push({ ...block, text: current });
      current = "";
    }
    if (sentence.length > limit) {
      for (let offset = 0; offset < sentence.length; offset += limit) {
        parts.push({ ...block, text: sentence.slice(offset, offset + limit) });
      }
    } else {
      current = cleanText(`${current} ${sentence}`);
    }
  }
  if (current) parts.push({ ...block, text: current });
  return parts;
};

const chunkStructuredHtml = (extracted, options = {}) => {
  const limit = Math.max(600, Math.min(4_000, Number(options.chunkSize || DEFAULT_CHUNK_SIZE)));
  const expanded = extracted.blocks.flatMap((block) => splitOversizedBlock(block, limit));
  const chunks = [];
  let current = [];
  let currentLength = 0;
  const flush = () => {
    if (!current.length) return;
    const first = current[0];
    const last = current[current.length - 1];
    const sectionPath = last.sectionPath?.length ? last.sectionPath : first.sectionPath || [];
    const heading = last.heading || first.heading || null;
    const anchor = last.anchor || first.anchor || null;
    const content = cleanText(current.map((block) => block.text).join("\n\n"));
    if (content) {
      chunks.push({
        content,
        metadata: {
          resourceType: "html",
          mimeType: "text/html",
          pageStart: null,
          pageEnd: null,
          pageEstimate: false,
          heading,
          sectionTitle: heading,
          sectionPath,
          sourceAnchor: anchor,
          sourceUrl: sourceUrlWithAnchor(extracted.sourceUrl, anchor),
          canonicalSourceUrl: extracted.sourceUrl || null,
          structuralType: current.some((block) => block.type === "table_row")
            ? "html_table"
            : "html_section",
          blockTypes: [...new Set(current.map((block) => block.type))],
          tableContext: current.find((block) => block.tableContext)?.tableContext || null,
          rawHtmlHash: extracted.rawHtmlHash,
          cleanContentHash: extracted.cleanContentHash,
        },
      });
    }
    current = [];
    currentLength = 0;
  };
  for (const block of expanded) {
    const sectionChanged = current.length &&
      JSON.stringify(current[current.length - 1].sectionPath || []) !== JSON.stringify(block.sectionPath || []);
    if (current.length && (currentLength + block.text.length + 2 > limit || sectionChanged)) flush();
    current.push(block);
    currentLength += block.text.length + 2;
  }
  flush();
  return chunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
    metadata: { ...chunk.metadata, chunkIndex: index, totalChunks: chunks.length },
  }));
};

const htmlFailure = (code, message, { status = 422, retryable = false, reviewRequired = false } = {}) => {
  const error = new Error(message);
  error.status = status;
  error.failureCode = code;
  error.retryable = retryable;
  error.reviewRequired = reviewRequired;
  return error;
};

module.exports = {
  BOILERPLATE_SELECTOR,
  MIN_RESEARCH_TEXT,
  assessHtmlQuality,
  chunkStructuredHtml,
  cleanText,
  extractStructuredHtml,
  htmlFailure,
  sha256,
  sourceUrlWithAnchor,
  stableAnchor,
};
