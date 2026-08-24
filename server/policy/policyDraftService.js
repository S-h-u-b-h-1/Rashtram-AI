const REQUIRED_SECTIONS = [
  "Problem and Evidence",
  "Policy Objectives",
  "Target Groups and Equity Considerations",
  "Policy Options",
  "Recommended Approach",
  "Implementation Plan",
  "Institutions and Responsibilities",
  "Funding and Delivery Model",
  "Monitoring, Evaluation, and Learning",
  "Risks and Mitigations",
  "Consultation Questions",
  "Evidence Notes",
];

const text = (value, maximum = 20_000) => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim().slice(0, maximum);
  }
  return "";
};

const citationList = (value) => [...new Set((Array.isArray(value) ? value : [])
  .map((item) => text(item, 240))
  .filter(Boolean))].slice(0, 30);

const normalizeItem = (value) => {
  if (typeof value === "string") return { content: text(value), citations: [] };
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const content = text(value.content || value.analysis || value.point || value.description);
  if (!content) return null;
  return {
    ...(text(value.heading || value.title, 240) ? { heading: text(value.heading || value.title, 240) } : {}),
    content,
    citations: citationList(value.citations),
  };
};

const normalizeItems = (value, maximum = 30) => (Array.isArray(value) ? value : [])
  .map(normalizeItem)
  .filter(Boolean)
  .slice(0, maximum);

const normalizePolicyDraft = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Policy draft response must be a JSON object.");
  }
  const title = text(value.title, 240);
  const executiveSummary = text(value.executiveSummary, 8_000);
  const sections = normalizeItems(value.sections, 30);
  if (!title || !executiveSummary || !sections.length) {
    throw new Error("Policy draft response is missing its title, executive summary, or sections.");
  }
  return {
    title,
    executiveSummary,
    sections,
    recommendations: normalizeItems(value.recommendations),
    implementation: normalizeItems(value.implementation),
    risks: normalizeItems(value.risks),
    evidenceLimitations: normalizeItems(value.evidenceLimitations),
  };
};

const parsePolicyDraftJson = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizePolicyDraft(value);
  }
  const normalized = text(value, 100_000)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Policy draft response was not valid JSON.");
  return normalizePolicyDraft(JSON.parse(normalized.slice(start, end + 1)));
};

const renderCitations = (citations) => citations.length
  ? ` ${citations.map((citation) => citation.startsWith("[") ? citation : `[${citation}]`).join(" ")}`
  : "";

const renderItems = (items) => items.map((item) => {
  const prefix = item.heading ? `**${item.heading}:** ` : "";
  return `- ${prefix}${item.content}${renderCitations(item.citations)}`;
}).join("\n");

const policyDraftToMarkdown = (draft) => {
  const normalized = normalizePolicyDraft(draft);
  const parts = [
    `# ${normalized.title}`,
    "## Executive Summary",
    normalized.executiveSummary,
  ];
  for (const section of normalized.sections) {
    parts.push(`## ${section.heading || "Policy Analysis"}`);
    parts.push(`${section.content}${renderCitations(section.citations)}`);
  }
  const collections = [
    ["Recommendations", normalized.recommendations],
    ["Implementation Actions", normalized.implementation],
    ["Risks and Mitigations", normalized.risks],
    ["Evidence Limitations", normalized.evidenceLimitations],
  ];
  for (const [heading, items] of collections) {
    if (!items.length) continue;
    parts.push(`## ${heading}`);
    parts.push(renderItems(items));
  }
  return parts.filter(Boolean).join("\n\n").replace(/\[object Object\]/gi, "");
};

const groundedDraftFallback = ({ brief = {}, title, evidenceLabels = [], reason } = {}) => {
  const objective = text(brief.objective, 1_500) || "the stated policy problem";
  const audience = text(brief.audience, 500) || "the intended beneficiaries and implementing institutions";
  const geography = text(brief.geography, 500) || "the stated jurisdiction";
  const requirements = text(brief.requirements, 2_000);
  const labels = citationList(evidenceLabels).slice(0, 8);
  const evidenceNote = labels.length
    ? `The selected evidence should be reviewed against ${labels.map((item) => item.startsWith("[") ? item : `[${item}]`).join(", ")}.`
    : "No citation label was available for a source-specific factual finding.";
  return normalizePolicyDraft({
    title: title || brief.title || `Policy draft: ${objective.slice(0, 100)}`,
    executiveSummary: `This is a grounded working draft for ${objective}. It separates proposed policy choices from verified source facts. Source-specific legal details, figures, duties, and dates must be validated against the selected evidence before adoption.`,
    sections: [
      { heading: REQUIRED_SECTIONS[0], content: `Policy problem: ${objective}. ${evidenceNote}`, citations: labels },
      { heading: REQUIRED_SECTIONS[1], content: `Proposed objective: address ${objective} with measurable, lawful, and administratively feasible action.` },
      { heading: REQUIRED_SECTIONS[2], content: `The proposed policy should assess effects on ${audience}, including unequal access, cost, capacity, and grievance risks.` },
      { heading: REQUIRED_SECTIONS[3], content: requirements ? `Options should be tested against these requested requirements: ${requirements}` : "Develop at least a baseline option, a targeted option, and a phased option. Validate their legal authority, costs, and delivery capacity." },
      { heading: REQUIRED_SECTIONS[4], content: "Recommendation: select an option only after evidence review, stakeholder consultation, delivery-cost assessment, and legal validation." },
      { heading: REQUIRED_SECTIONS[5], content: `Use a phased implementation in ${geography}: define ownership, milestones, resourcing, safeguards, feedback channels, and review points.` },
      { heading: REQUIRED_SECTIONS[6], content: "To be validated: designate the legally competent lead institution, delivery partners, oversight body, and grievance authority." },
      { heading: REQUIRED_SECTIONS[7], content: "To be validated: prepare an itemised cost, lawful funding source, procurement approach, and recurrent operating-cost estimate." },
      { heading: REQUIRED_SECTIONS[8], content: "Define a baseline, a small set of outcome and equity indicators, reporting frequency, independent review, and a revision trigger." },
      { heading: REQUIRED_SECTIONS[9], content: "Key proposed safeguards include phased rollout, capacity testing, transparent eligibility, grievance handling, privacy protection, and periodic review." },
      { heading: REQUIRED_SECTIONS[10], content: "Consult affected groups, implementing staff, domain experts, finance and legal teams, and independent evaluators before finalisation." },
      { heading: REQUIRED_SECTIONS[11], content: `${evidenceNote} This fallback does not assert that any proposed recommendation is existing law or government policy.` , citations: labels },
    ],
    recommendations: ["Validate every legal, financial, institutional, and statistical premise before publication."],
    implementation: ["Begin with a time-bound pilot and publish measurable review criteria before wider rollout."],
    risks: ["Incomplete evidence may produce an unsuitable design; mitigate this through source verification and consultation."],
    evidenceLimitations: [reason ? `AI drafting was unavailable or invalid (${text(reason, 240)}); a conservative grounded template was produced.` : "A conservative grounded template was produced because validated structured generation was unavailable."],
  });
};

const generateValidatedPolicyDraft = async ({
  prompt,
  context,
  brief,
  title,
  evidenceLabels,
  generate,
  repair,
}) => {
  try {
    const raw = await generate({ prompt, context, responseLanguage: brief.responseLanguage });
    try {
      const draft = parsePolicyDraftJson(raw);
      return { draft, markdown: policyDraftToMarkdown(draft), generationMode: "generated", error: null };
    } catch (parseError) {
      if (!repair) throw parseError;
      const repaired = await repair({ raw, prompt, context, responseLanguage: brief.responseLanguage });
      const draft = parsePolicyDraftJson(repaired);
      return { draft, markdown: policyDraftToMarkdown(draft), generationMode: "repaired", error: null };
    }
  } catch (error) {
    const draft = groundedDraftFallback({ brief, title, evidenceLabels, reason: error.message });
    return { draft, markdown: policyDraftToMarkdown(draft), generationMode: "grounded_fallback", error };
  }
};

module.exports = {
  REQUIRED_SECTIONS,
  generateValidatedPolicyDraft,
  groundedDraftFallback,
  normalizePolicyDraft,
  parsePolicyDraftJson,
  policyDraftToMarkdown,
};
