#!/usr/bin/env node

const path = require("path");
require("dotenv").config({
  path: process.env.ENV_FILE || path.resolve(__dirname, "../.env.local"),
});
process.env.JWT_SECRET ||= "local-release-verification-only";
const jwt = require("jsonwebtoken");
const app = require("../server");
const { connectDB, getPool, query } = require("../db");

const request = async (baseUrl, token, endpoint) => {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { "auth-token": token },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${endpoint} returned ${response.status}: ${
        payload.error || "unknown error"
      }`,
    );
  }
  return payload;
};

const main = async () => {
  await connectDB();
  const user = await query("SELECT id FROM users ORDER BY id LIMIT 1");
  if (!user.rows[0]) {
    throw new Error("Release verification requires one existing user.");
  }
  const token = jwt.sign(
    { user: { id: String(user.rows[0].id) } },
    process.env.JWT_SECRET,
    {
      expiresIn: "5m",
      issuer: "rashtram-ai",
      audience: "rashtram-ai-client",
    },
  );
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const [
      dashboard,
      profile,
      bills,
      acts,
      gazettes,
      policies,
      documents,
      chats,
    ] =
      await Promise.all([
        request(baseUrl, token, "/api/dashboard/intelligence"),
        request(baseUrl, token, "/api/profile"),
        request(baseUrl, token, "/api/bills?limit=2"),
        request(baseUrl, token, "/api/acts?limit=2"),
        request(baseUrl, token, "/api/egazettes?limit=2"),
        request(
          baseUrl,
          token,
          "/api/documents?type=policy,consultation-paper,guideline&limit=2",
        ),
        request(baseUrl, token, "/api/documents?limit=2"),
        request(baseUrl, token, "/api/document-chat/history?limit=2"),
      ]);
    const universalId = documents.documents?.[0]?.id;
    const [documentDetail, documentSearch, timeline, graph] =
      universalId
        ? await Promise.all([
            request(baseUrl, token, `/api/documents/${universalId}`),
            request(
              baseUrl,
              token,
              "/api/documents/search?q=tax&limit=2",
            ),
            request(
              baseUrl,
              token,
              `/api/documents/${universalId}/timeline`,
            ),
            request(
              baseUrl,
              token,
              `/api/documents/${universalId}/graph`,
            ),
          ])
        : [{}, { documents: [] }, { timeline: [] }, { graph: {} }];
    const checks = {
      dashboard: Boolean(dashboard.currentDate),
      nationalDashboardSections: [
        "latestPolicies",
        "latestMinistryUpdates",
        "latestStateUpdates",
        "latestRegulatorUpdates",
        "committeeActivity",
        "publicConsultations",
        "cabinetDecisions",
      ].every((key) => Array.isArray(dashboard[key])),
      profile: Boolean(profile.user?.id && profile.account),
      profilePolicyCoverage:
        Number(profile.platformCoverageStats?.policyDocuments || 0) > 0,
      bills: bills.bills?.length || 0,
      acts: acts.acts?.length || 0,
      gazettes: gazettes.gazettes?.length || 0,
      policies: policies.documents?.length || 0,
      universalDocuments: documents.documents?.length || 0,
      universalDocumentDetail: Boolean(documentDetail.document?.id),
      universalRelatedChats: Array.isArray(
        documentDetail.document?.relatedChats,
      ),
      universalSearch: documentSearch.documents?.length || 0,
      universalTimeline: Array.isArray(timeline.timeline),
      universalGraph: Array.isArray(graph.graph?.nodes),
      unifiedChats: chats.count || 0,
    };
    for (const required of [
      "dashboard",
      "nationalDashboardSections",
      "profile",
      "profilePolicyCoverage",
      "bills",
      "acts",
      "gazettes",
      "policies",
      "universalDocuments",
      "universalDocumentDetail",
      "universalRelatedChats",
      "universalTimeline",
      "universalGraph",
    ]) {
      if (!checks[required]) {
        throw new Error(`Release verification failed: ${required}`);
      }
    }
    console.log(JSON.stringify({ status: "passed", checks }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await getPool().end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
