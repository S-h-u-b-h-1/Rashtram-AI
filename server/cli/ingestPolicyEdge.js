#!/usr/bin/env node

/**
 * PolicyEdge Ingestion CLI
 *
 * Usage:
 *   node server/cli/ingestPolicyEdge.js               # Scrape ALL pages (default)
 *   node server/cli/ingestPolicyEdge.js --pages 5     # Scrape first 5 pages only
 *   node server/cli/ingestPolicyEdge.js --embed       # Also embed into Pinecone
 *   node server/cli/ingestPolicyEdge.js --embed --pages 10
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { query } = require("../db");
const {
  fetchAllPages,
  fetchArticle,
} = require("../lib/ingestion/connectors/policyedgeConnector");
const {
  checkPolicyExists,
  generatePolicySummary,
  storePolicyContentInChunks,
} = require("../lib/vectordb");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const args = process.argv.slice(2);
  // Default: scrape ALL pages (99999 = effectively unlimited, capped by real total)
  const options = { pages: 99999, embed: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--pages" && args[i + 1]) {
      const value = args[i + 1];
      options.pages = value === "all" ? 99999 : Number.parseInt(value, 10);
      i += 1;
    }
    if (args[i] === "--embed") {
      options.embed = true;
    }
  }
  return options;
};

const splitIntoChunks = (text, chunkSize = 800) => {
  const words = text.split(" ");
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
};

/**
 * Upsert article into legislative_documents and mark it as research_ready
 * in the documents table (synced via trigger) so it shows up with research enabled.
 */
const upsertPolicy = async (article) => {
  const slug = article.slug;
  const publicationDate = article.publishedDate
    ? new Date(article.publishedDate).toISOString()
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
      "policyedge",
      slug,
      "national",
      "India",
      "policyedge",
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
        source: "policyedge",
      }),
    ],
  );

  const docId = result.rows[0]?.id;

  if (docId) {
    // Mark as research_ready so the Research button is enabled in the UI.
    // PolicyEdge articles are HTML-based (no PDF), so readiness is driven by embeddings.
    await query(
      `UPDATE documents
       SET research_ready = TRUE,
           comparison_ready = TRUE,
           updated_at = NOW()
       WHERE id = $1`,
      [docId],
    );
  }

  return docId;
};

const embedPolicy = async (policyId, article) => {
  const existence = await checkPolicyExists(String(policyId));
  if (existence.exists) {
    console.log(`      Already embedded (${existence.chunksCount} chunks)`);
    return { alreadyEmbedded: true, chunksStored: existence.chunksCount };
  }

  const fullContent = [article.title, article.description, article.bodyText]
    .filter(Boolean)
    .join("\n\n");

  if (fullContent.length < 50) {
    console.log(`      Content too short (${fullContent.length} chars), skipping embed`);
    return { skipped: true, reason: "content_too_short" };
  }

  const rawChunks = splitIntoChunks(fullContent);
  const summaryContext = rawChunks.slice(0, 6).join("\n\n");

  let summary;
  try {
    summary = await generatePolicySummary(summaryContext);
  } catch (error) {
    console.warn(`      Summary generation failed: ${error.message}`);
    summary = article.description || "";
  }

  const chunks = rawChunks.map((chunk, index) => ({
    id: `policy-${policyId}-chunk-${index}`,
    policyId: String(policyId),
    title: article.title,
    content: chunk,
    chunkIndex: index,
    totalChunks: rawChunks.length,
    metadata: {
      documentType: "policy",
      source: "PolicyEdge",
      sourceUrl: article.url,
      category: article.category,
      summary,
    },
  }));

  const stored = await storePolicyContentInChunks(chunks);
  console.log(`      Embedded ${stored.chunksStored} chunks`);
  return { chunksStored: stored.chunksStored };
};

const run = async () => {
  const options = parseArgs();
  const pagesLabel = options.pages >= 99999 ? "ALL" : options.pages;

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   PolicyEdge → Rashtram AI Ingestion     ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`Pages to scrape: ${pagesLabel}`);
  console.log(`Embed into Pinecone: ${options.embed ? "YES" : "NO"}\n`);

  const listing = await fetchAllPages(options.pages, 1500);
  console.log(`\nFound ${listing.listings.length} article links across ${listing.fetchedPages} of ${listing.totalPages} pages.\n`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;
  let embedded = 0;

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
        console.log(`    ✓ Upserted as doc id ${policyId} (research_ready=true)`);
      } else {
        updated += 1;
      }

      if (options.embed && policyId) {
        await delay(800);
        await embedPolicy(policyId, article);
        embedded += 1;
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
  if (options.embed) {
    console.log(`    Embedded:           ${embedded}`);
  }
  console.log("════════════════════════════════════════════\n");
  process.exit(0);
};

run().catch((error) => {
  console.error("Fatal ingestion error:", error);
  process.exit(1);
});
