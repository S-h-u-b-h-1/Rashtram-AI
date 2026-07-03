const cheerio = require("cheerio");
const { sha256 } = require("../core/hashing");
const { normalizeDate } = require("../core/normalizer");
const { createSnapshot } = require("../core/sourceSnapshots");
const { attachConnectorLifecycle } = require("./connectorLifecycle");

const text = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const createRssConnector = (config) => {
  const connector = {
    ...config,
    defaultCollection: config.collection,
    async collect(options = {}, { fetcher }) {
      const url = options.url || config.url;
      try {
        const response = await fetcher.getText(url, {
          headers: {
            Accept: "application/rss+xml, application/xml, text/xml",
          },
        });
        const $ = cheerio.load(response.body, { xmlMode: true });
        const records = [];
        $("item, entry").each((_, element) => {
          const item = $(element);
          const title = text(item.find("title").first().text());
          const link =
            text(item.find("link").first().text()) ||
            item.find("link").first().attr("href");
          if (!title || !link) return;
          const description = text(
            item.find("description, summary, content").first().text(),
          );
          const category = text(item.find("category").first().text());
          const published = text(
            item.find("pubDate, published, updated").first().text(),
          );
          const documentType =
            typeof config.documentType === "function"
              ? config.documentType(`${title} ${description} ${category}`)
              : config.documentType || "press_release";
          records.push({
            sourceName: config.name,
            sourceRecordId: text(item.find("guid, id").first().text()) ||
              sha256(link).slice(0, 40),
            sourceUrl: link,
            detailUrl: link,
            title,
            documentType,
            jurisdictionLevel: config.jurisdictionLevel || "union",
            jurisdiction: config.jurisdiction || "India",
            authority: config.authority,
            ministry: config.ministry,
            category: category || config.collection,
            status: "Published",
            publicationDate: normalizeDate(published),
            mimeType: "text/html",
            metadata: {
              collection: config.collection,
              description,
              feedUrl: url,
            },
          });
        });
        const limit = Math.max(1, Number(options.limit || 100));
        return {
          records: records.slice(0, limit),
          snapshots: [
            createSnapshot({
              sourceName: config.name,
              sourceUrl: url,
              body: response.body,
              responseStatus: response.status,
              recordCount: records.length,
              metadata: { collection: config.collection, format: "rss" },
            }),
          ],
          errors: [],
          diagnostics: records.length
            ? []
            : [
                {
                  type: "empty-source",
                  collection: config.collection,
                  message: "The official RSS feed contained no items.",
                },
              ],
        };
      } catch (error) {
        return {
          records: [],
          snapshots: [],
          errors: [{ stage: "rss", message: error.message }],
          diagnostics: [
            {
              type: "error",
              collection: config.collection,
              message: error.message,
            },
          ],
        };
      }
    },
  };
  return attachConnectorLifecycle(connector, [config.collection]);
};

module.exports = { createRssConnector };
