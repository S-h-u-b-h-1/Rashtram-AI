#!/usr/bin/env node

/**
 * PolicyEdge Ingestion CLI
 *
 * Usage:
 *   node server/cli/ingestPolicyEdge.js               # Scrape ALL pages (default)
 *   node server/cli/ingestPolicyEdge.js --pages 5     # Scrape first 5 pages only
 * Semantic preparation is intentionally handled by Processing V3, not this
 * catalogue command. Use the bounded PolicyEdge canary after ingestion.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { query } = require("../db");
const {
  fetchAllPages,
  fetchArticle,
} = require("../lib/ingestion/connectors/policyedgeConnector");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const args = process.argv.slice(2);
  // Default: scrape ALL pages (99999 = effectively unlimited, capped by real total)
  const options = { pages: 99999 };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--pages" && args[i + 1]) {
      const value = args[i + 1];
      options.pages = value === "all" ? 99999 : Number.parseInt(value, 10);
      i += 1;
    }
    if (args[i] === "--embed") {
      throw new Error("--embed was retired. PolicyEdge semantic work must use bounded Processing V3 preparation.");
    }
  }
  return options;
};

/**
 * Upsert catalogue and HTML-resource provenance only. Processing V3 is the
 * sole component allowed to grant research capabilities.
 */
const upsertPolicy = async (article) => {
  const slug = article.slug;
  const publicationDate = article.publishDate
    ? new Date(article.publishDate).toISOString()
    : null;
  const year = publicationDate
    ? new Date(publicationDate).getFullYear()
    : null;

  const result = await query(
    `INSERT INTO legislative_documents (
       title,
       document_type,
       source_name,
       source_document_id,
       jurisdiction_level,
       jurisdiction,
       canonical_source,
       canonical_id,
       canonical_url,
       source_url,
       publication_date,
       year,
       category,
       authority,
       source_metadata,
       metadata_json,
       first_seen_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, NOW(), NOW())
     ON CONFLICT (canonical_id)
     DO UPDATE SET
       title = EXCLUDED.title,
       publication_date = COALESCE(EXCLUDED.publication_date, legislative_documents.publication_date),
       year = COALESCE(EXCLUDED.year, legislative_documents.year),
       category = COALESCE(EXCLUDED.category, legislative_documents.category),
       authority = COALESCE(EXCLUDED.authority, legislative_documents.authority),
       source_metadata = legislative_documents.source_metadata || EXCLUDED.source_metadata,
       metadata_json = legislative_documents.metadata_json || EXCLUDED.metadata_json,
       updated_at = NOW()
     RETURNING id`,
    [
      article.title || slug,
      "policy",
      "policy-edge",
      slug,
      "national",
      "India",
      "policy-edge",
      slug,
      article.url,
      article.url,
      publicationDate,
      year,
      article.category || "Reports/Data Releases",
      (article.institutions || []).join(", ") || null,
      JSON.stringify({
        description: article.description || null,
        sdgTags: article.sdgTags || [],
        institutions: article.institutions || [],
      }),
      JSON.stringify({
        slug,
        source: "policy-edge",
      }),
    ],
  );

  const docId = result.rows[0]?.id;

  if (docId) {
    await query(
      `INSERT INTO legislative_document_resources (
         document_id, label, resource_type, category, url, metadata
       )
       VALUES ($1, $2, 'html', $3, $4, $5::jsonb)
       ON CONFLICT (document_id, url)
       DO UPDATE SET
         label = EXCLUDED.label,
         resource_type = EXCLUDED.resource_type,
         category = COALESCE(EXCLUDED.category, legislative_document_resources.category),
         metadata = legislative_document_resources.metadata || EXCLUDED.metadata,
         last_seen_at = NOW(),
         updated_at = NOW()`,
      [
        docId,
        "PolicyEdge article",
        article.category || "Reports/Data Releases",
        article.url,
        JSON.stringify({
          source: "policy-edge",
          slug,
          mimeType: "text/html",
          extractable: true,
        }),
      ],
    );
  }

  return docId;
};

const run = async () => {
  const options = parseArgs();
  const pagesLabel = options.pages >= 99999 ? "ALL" : options.pages;

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   PolicyEdge → Rashtram AI Ingestion     ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`Pages to scrape: ${pagesLabel}`);
  console.log("Semantic preparation: deferred to bounded Processing V3 canary\n");

  const listing = await fetchAllPages(options.pages, 1500);
  console.log(`\nFound ${listing.listings.length} article links across ${listing.fetchedPages} of ${listing.totalPages} pages.\n`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < listing.listings.length; i += 1) {
    const entry = listing.listings[i];
    const progress = `[${i + 1}/${listing.listings.length}]`;

    try {
      console.log(`  ${progress} Fetching: ${entry.slug}`);
      await delay(1200);
      const article = await fetchArticle(entry.slug);

      const policyId = await upsertPolicy(article);
      if (policyId) {
        inserted += 1;
        console.log(`    ✓ Upserted as doc id ${policyId} (research readiness pending processing)`);
      } else {
        updated += 1;
      }

    } catch (error) {
      errors += 1;
      console.error(`    ✗ Error processing ${entry.slug}: ${error.message}`);
    }
  }

  console.log("\n════════════════════════════════════════════");
  console.log(`  Ingestion Complete`);
  console.log(`    Articles processed: ${inserted + updated}`);
  console.log(`    New/updated:        ${inserted}`);
  console.log(`    Errors:             ${errors}`);
  console.log("════════════════════════════════════════════\n");
  process.exit(0);
};

run().catch((error) => {
  console.error("Fatal ingestion error:", error);
  process.exit(1);
});
