const ANSWER_INTENTS = Object.freeze({
  SOURCE_FACT: "SOURCE_FACT",
  EXPLANATION: "EXPLANATION",
  SUMMARY: "SUMMARY",
  ANALYSIS: "ANALYSIS",
  IMPLICATION: "IMPLICATION",
  CRITIQUE: "CRITIQUE",
  PERSPECTIVE: "PERSPECTIVE",
  HYPOTHETICAL: "HYPOTHETICAL",
  CURRENT_STATUS: "CURRENT_STATUS",
  COMPARISON: "COMPARISON",
  LEGAL_EFFECT: "LEGAL_EFFECT",
  COMPLIANCE: "COMPLIANCE",
  TIMELINE: "TIMELINE",
  POLICY_DRAFT: "POLICY_DRAFT",
  GENERAL_CONTEXT: "GENERAL_CONTEXT",
});

const FRESHNESS_CLASSES = Object.freeze({
  STATIC: "STATIC",
  DOCUMENT_BOUND: "DOCUMENT_BOUND",
  TIME_SENSITIVE: "TIME_SENSITIVE",
  CURRENT_STATUS: "CURRENT_STATUS",
});

const CLAIM_CLASSES = Object.freeze({
  SOURCE_FACT: "SOURCE_FACT",
  EXTERNAL_FACT: "EXTERNAL_FACT",
  INFERENCE: "INFERENCE",
  PERSPECTIVE: "PERSPECTIVE",
  HYPOTHETICAL: "HYPOTHETICAL",
});

const matches = (value, expression) => expression.test(String(value || ""));

const classifyAnswerIntent = (question, options = {}) => {
  const text = String(question || "").trim();
  if (options.task === "policy_draft") return ANSWER_INTENTS.POLICY_DRAFT;
  if (options.task === "comparison" || options.documentCount > 1 ||
      matches(text, /\b(compare|comparison|contrast|versus|vs\.?|difference between)\b/i)) {
    return ANSWER_INTENTS.COMPARISON;
  }
  if (matches(text, /\b(current(?:ly)?|present status|latest|still (?:valid|active|applicable|operative|pending|in force)|now (?:an? )?(?:act|law|rule)|in force today|has .* (?:passed|lapsed|expired|been amended|been repealed|been superseded)|is .* (?:pending|operative|active)|who currently|what currently)\b/i)) {
    return ANSWER_INTENTS.CURRENT_STATUS;
  }
  if (matches(text, /\b(if|assuming|suppose|hypothetical|what would happen if|scenario where)\b/i)) {
    return ANSWER_INTENTS.HYPOTHETICAL;
  }
  if (matches(text, /\b(from (?:the )?.+ perspective|perspective of|what would .+ (?:think|argue|say)|strongest case (?:for|against)|defend (?:it|this)|business-friendly|government's position|critics? (?:say|argue))\b/i)) {
    return ANSWER_INTENTS.PERSPECTIVE;
  }
  if (matches(text, /\b(critic(?:ise|ize|ally|ism|ique)|weakness|shortcoming|policy gap|strongest criticism)\b/i)) {
    return ANSWER_INTENTS.CRITIQUE;
  }
  if (matches(text, /\b(implication|impact|consequence|why (?:does|is) .* matter|affect|trade-?off|implementation risks?|unintended consequences?)\b/i)) {
    return ANSWER_INTENTS.IMPLICATION;
  }
  if (matches(text, /\b(compliance|comply|obligation|licen[cs]e|registration|penalt|deadline|applicability)\b/i)) {
    return ANSWER_INTENTS.COMPLIANCE;
  }
  if (matches(text, /\b(legal effect|legal impact|binding|enforceable|power|duty|right|liability)\b/i)) {
    return ANSWER_INTENTS.LEGAL_EFFECT;
  }
  if (matches(text, /\b(timeline|chronolog|before|after|when|commencement|effective date|history|which version|as of)\b/i)) {
    return ANSWER_INTENTS.TIMELINE;
  }
  if (matches(text, /\b(summar(?:y|ise|ize)|overview|in brief|key points|executive brief)\b/i)) {
    return ANSWER_INTENTS.SUMMARY;
  }
  if (matches(text, /\b(analy[sz]e|assessment|evaluate|advantages? and disadvantages?|pros and cons|go deeper)\b/i)) {
    return ANSWER_INTENTS.ANALYSIS;
  }
  if (matches(text, /\b(explain|what does .* mean|in simple terms|help me understand|difference between an? (?:act|bill))\b/i)) {
    return ANSWER_INTENTS.EXPLANATION;
  }
  if (matches(text, /\b(what is an? (?:ordinance|act|bill|rule|regulation)|what does [A-Z]{2,} mean|define|conceptually)\b/i)) {
    return ANSWER_INTENTS.GENERAL_CONTEXT;
  }
  return ANSWER_INTENTS.SOURCE_FACT;
};

const classifyFreshness = (question, intent = classifyAnswerIntent(question)) => {
  const text = String(question || "");
  if (intent === ANSWER_INTENTS.CURRENT_STATUS) return FRESHNESS_CLASSES.CURRENT_STATUS;
  if (matches(text, /\b(latest|today|currently|present requirement|current (?:law|rule|regulator|requirement|market|figure|policy|scheme)|still active|recent amendment)\b/i)) {
    return FRESHNESS_CLASSES.TIME_SENSITIVE;
  }
  if (intent === ANSWER_INTENTS.GENERAL_CONTEXT &&
      !matches(text, /\b(this|selected|section|clause|document|bill|act|rule|policy|notification)\b/i)) {
    return FRESHNESS_CLASSES.STATIC;
  }
  return FRESHNESS_CLASSES.DOCUMENT_BOUND;
};

const detectAnswerStyle = (question) => {
  const text = String(question || "");
  if (/\b(short|brief|concise) answer\b/i.test(text)) return "concise";
  if (/\b(explain simply|simple terms|for a beginner|university student)\b/i.test(text)) return "plain_language";
  if (/\b(technical|legal analysis|go deeper|detailed|in depth)\b/i.test(text)) return "technical_detailed";
  if (/\b(executive brief|executive briefing)\b/i.test(text)) return "executive_brief";
  if (/\bUPSC(?:-style)?\b/i.test(text)) return "upsc";
  if (/\btable\b/i.test(text)) return "table";
  if (/\bbullet points?\b/i.test(text)) return "bullets";
  if (/\bdiplomatic(?: tone)?\b/i.test(text)) return "diplomatic";
  if (/\bformal(?: tone)?\b/i.test(text)) return "formal";
  return "natural_research";
};

const requiresCurrentVerification = (freshnessClass) => [
  FRESHNESS_CLASSES.TIME_SENSITIVE,
  FRESHNESS_CLASSES.CURRENT_STATUS,
].includes(freshnessClass);

const generationProfileFor = ({ task = "chat", intent, freshnessClass } = {}) => {
  const resolvedIntent = intent || ANSWER_INTENTS.SOURCE_FACT;
  const strict = [
    ANSWER_INTENTS.SOURCE_FACT,
    ANSWER_INTENTS.LEGAL_EFFECT,
    ANSWER_INTENTS.COMPLIANCE,
    ANSWER_INTENTS.CURRENT_STATUS,
    ANSWER_INTENTS.TIMELINE,
  ].includes(resolvedIntent) || requiresCurrentVerification(freshnessClass);
  if (task === "policy_draft") return {
    name: "policy_drafting_reasoned_v1", temperature: 0.25, topP: 0.85, maxOutputTokens: 3_200,
  };
  if (task === "comparison") return {
    name: "comparison_analysis_v1", temperature: 0.18, topP: 0.8, maxOutputTokens: 3_600,
  };
  if (strict) return {
    name: "evidence_extraction_v1", temperature: 0.08, topP: 0.65, maxOutputTokens: 1_200,
  };
  return {
    name: "grounded_analysis_v1", temperature: 0.22, topP: 0.85, maxOutputTokens: 1_500,
  };
};

const currentVerificationInstruction = (verification = {}) => {
  if (!verification.required) return "No current-world verification was required for this question.";
  if (verification.status === "VERIFIED_CURRENT") {
    return `Current-status evidence was verified against indexed authoritative material through ${verification.checkedThrough || verification.checkedAt || "the recorded source date"}. Distinguish the selected document from later material if they differ.`;
  }
  const connector = verification.connectorStatus
    ? ` Relevant connector status: ${verification.connectorStatus}.`
    : "";
  return `Current status is not fully verified from the presently indexed authoritative sources.${connector} Do not guess or use model memory. Explain what the selected document states, then explicitly say that a later amendment, repeal, superseding instrument, or present status could not be verified.`;
};

const buildAdaptivePromptLayers = ({
  task = "document_chat",
  question = "",
  intent,
  freshnessClass,
  answerStyle,
  currentVerification = {},
  conversationHistory = "",
  strictCompliance = false,
} = {}) => {
  const resolvedIntent = intent || classifyAnswerIntent(question, {
    task: task === "policy_draft" ? "policy_draft" : task === "comparison" ? "comparison" : undefined,
  });
  const resolvedFreshness = freshnessClass || classifyFreshness(question, resolvedIntent);
  const resolvedStyle = answerStyle || detectAnswerStyle(question);
  return [
    "GLOBAL SAFETY AND EVIDENCE RULES",
    "Current verified evidence outranks selected-document evidence; selected-document evidence outranks verified related sources; verified sources outrank general model knowledge; speculation is never fact.",
    "The retrieved original passages are authoritative for what a selected document contains. If model memory conflicts with a passage, the passage wins.",
    "Ground document facts in exact supplied citation labels. Never invent provisions, dates, figures, institutions, legal effects, relationships, licences, deadlines, penalties, registrations, or applicability.",
    "You may reason beyond quotation: explain, synthesize, critique, identify trade-offs and implications, adopt a requested perspective, and explore hypotheticals when the factual premises come from evidence.",
    "Clearly phrase analysis as analysis (for example, 'The available evidence suggests' or 'One possible implication is'). Clearly phrase hypotheticals conditionally. Do not claim a perspective is held by a real group without evidence.",
    "Stable general concepts may be explained from general knowledge, but they must not override a selected source. Changing facts must never come from model memory.",
    "Cite material factual premises without attaching a citation to every analytical sentence. Conversation history helps resolve references and style; it is not factual evidence.",
    strictCompliance
      ? "COMPLIANCE STRICTNESS: operational explanation is allowed, but every licence, deadline, penalty, registration, obligation, statutory applicability, or current requirement requires authoritative evidence."
      : "",
    "TASK ROLE",
    `Surface: ${task}. Answer intent: ${resolvedIntent}. Freshness class: ${resolvedFreshness}. Requested style: ${resolvedStyle}.`,
    "Follow the user's newest analytical direction even if it differs from an earlier turn.",
    "FRESHNESS AND TEMPORAL CONTEXT",
    currentVerificationInstruction({
      required: requiresCurrentVerification(resolvedFreshness),
      ...currentVerification,
    }),
    conversationHistory
      ? `CONVERSATION CONTEXT (reference/style only; never evidence):\n${String(conversationHistory).slice(0, 4_000)}`
      : "",
  ].filter(Boolean).join("\n\n");
};

const classifyMaterialClaim = (text) => {
  const value = String(text || "").trim();
  if (/\b(if|assuming|suppose|hypothetical|would (?:likely|possibly)|in that scenario)\b/i.test(value)) {
    return CLAIM_CLASSES.HYPOTHETICAL;
  }
  if (/\b(from (?:the )?.+ perspective|a critic might|supporters? might|opponents? might|strongest case)\b/i.test(value)) {
    return CLAIM_CLASSES.PERSPECTIVE;
  }
  if (/\b(analytical implication|inference|may|might|could|likely|plausible|suggests?|possible interpretation|appears to)\b/i.test(value)) {
    return CLAIM_CLASSES.INFERENCE;
  }
  if (/\b(currently|today|latest|presently|as of \d{4}|now in force|current regulator)\b/i.test(value)) {
    return CLAIM_CLASSES.EXTERNAL_FACT;
  }
  if (/\b(?:an? )?(?:act|bill|ordinance|regulation|rule|fiscal deficit|EPR|NBFC) (?:is|means|refers to)|\bmeans?\b.*\bconcept\b/i.test(value)) {
    return CLAIM_CLASSES.EXTERNAL_FACT;
  }
  return CLAIM_CLASSES.SOURCE_FACT;
};

const enforceFreshnessGuard = (answer, verification = {}) => {
  const value = String(answer || "").trim();
  if (!verification.required || verification.status === "VERIFIED_CURRENT") return value;
  if (/could not verify|not fully verified|unable to verify|cannot verify/i.test(value)) return value;
  return [
    value,
    "",
    "Current-status note: I could not verify from the currently indexed authoritative sources whether a later amendment, repeal, or superseding instrument changes this position.",
  ].filter(Boolean).join("\n");
};

module.exports = {
  ANSWER_INTENTS,
  CLAIM_CLASSES,
  FRESHNESS_CLASSES,
  buildAdaptivePromptLayers,
  classifyAnswerIntent,
  classifyFreshness,
  classifyMaterialClaim,
  detectAnswerStyle,
  enforceFreshnessGuard,
  generationProfileFor,
  requiresCurrentVerification,
};
