const TEXT_QUALITY_VERSION = "pdf-text-quality-v1";
const NORMALIZATION_VERSION = "pdf-text-normalization-v1";
const OCR_PROMPT_VERSION = "pdf-ocr-transcription-v2";

const QUALITY = Object.freeze({
  GOOD: "GOOD",
  SUSPICIOUS: "SUSPICIOUS",
  CORRUPTED: "CORRUPTED",
  UNRECOVERABLE: "UNRECOVERABLE",
});

const count = (value, pattern) => (String(value || "").match(pattern) || []).length;
const ratio = (part, whole) => whole > 0 ? part / whole : 0;
const bounded = (value) => Number(Math.max(0, Math.min(1, value)).toFixed(4));

const repairArtificialSpacing = (text) => String(text || "")
  .split("\n")
  .map((line) => {
    const tokens = line.trim().split(/\s+/u).filter(Boolean);
    const singleLetters = tokens.filter((token) => /^\p{L}$/u.test(token));
    if (tokens.length < 8 || ratio(singleLetters.length, tokens.length) < 0.72) return line;
    return line.split(/\s{2,}/u).map((segment) => {
      const parts = segment.trim().split(/\s+/u).filter(Boolean);
      return parts.length >= 2 && parts.every((part) => /^\p{L}$/u.test(part))
        ? parts.join("")
        : segment.trim();
    }).join(" ");
  })
  .join("\n");

const normalizeExtractedText = (text, { repairSpacing = true } = {}) => {
  let value = String(text || "")
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/[\u200b-\u200d\u2060\ufeff]/gu, "")
    .replace(/\u00a0/g, " ")
    .replace(/([\p{Ll}]{3,})-\n([\p{Ll}]{3,})/gu, "$1$2")
    .replace(/[\x00-\x08\x0b\x0e-\x1f\x7f-\x9f]/g, "")
    .replace(/\r\n?/g, "\n");
  if (repairSpacing) value = repairArtificialSpacing(value);
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const languageProfile = (value) => {
  const devanagari = count(value, /[\u0900-\u097f]/gu);
  const latin = count(value, /[A-Za-z]/g);
  const letters = count(value, /\p{L}/gu);
  return {
    devanagari,
    latin,
    letters,
    language: devanagari >= 20 && latin >= 20
      ? "hi-en"
      : devanagari >= 20 && devanagari >= latin
        ? "hi"
        : latin >= 20 ? "en" : "und",
  };
};

const shannonEntropy = (value) => {
  const symbols = [...String(value || "").replace(/\s/gu, "")];
  if (!symbols.length) return 0;
  const frequencies = new Map();
  symbols.forEach((symbol) => frequencies.set(symbol, (frequencies.get(symbol) || 0) + 1));
  return -[...frequencies.values()].reduce((sum, frequency) => {
    const probability = frequency / symbols.length;
    return sum + probability * Math.log2(probability);
  }, 0);
};

const tokenPlausibility = (tokens, language) => {
  if (!tokens.length) return 0;
  const plausible = tokens.filter((token) => {
    if (/^\d+(?:[.,:/-]\d+)*%?$/u.test(token)) return true;
    if (/[\u0900-\u097f]/u.test(token)) {
      return /^[\u0900-\u097f]+[।॥.,;:!?-]?$/u.test(token) && token.length >= 2;
    }
    if (/^[A-Za-z][A-Za-z'’.-]*$/u.test(token)) {
      if (token.length <= 2) return true;
      return /[aeiouy]/i.test(token) || /^[A-Z]{2,8}$/u.test(token);
    }
    return language === "und" && /^\p{L}{2,}[\p{L}\p{M}'’.-]*$/u.test(token);
  }).length;
  return ratio(plausible, tokens.length);
};

const evaluateTextQuality = (text, options = {}) => {
  const value = String(text || "");
  const characters = [...value].length;
  const nonWhitespace = count(value, /\S/gu);
  const profile = languageProfile(value);
  const alphabetic = count(value, /[\p{L}\p{M}]/gu);
  const numeric = count(value, /\p{N}/gu);
  const whitespace = count(value, /\s/gu);
  const punctuation = count(value, /\p{P}/gu);
  const symbols = count(value, /\p{S}/gu);
  const replacements = count(value, /\uFFFD/gu);
  const controls = count(value, /[\x00-\x08\x0b\x0e-\x1f\x7f-\x9f]/g);
  const privateUse = count(value, /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu);
  const tokens = value.trim().split(/\s+/u).filter(Boolean);
  const singleCharacterTokens = tokens.filter((token) => /^[\p{L}\p{N}]$/u.test(token)).length;
  const averageWordLength = tokens.length
    ? tokens.reduce((sum, token) => sum + [...token].length, 0) / tokens.length
    : 0;
  const printable = count(value, /[\p{L}\p{M}\p{N}\p{P}\p{S}\s]/gu);
  const plausibility = tokenPlausibility(tokens, profile.language);
  const repeatedSequence = /(.{4,24})\1{3,}/su.test(value);
  const extremeRuns = /[^\s\p{N}\p{P}aeiouy\u0900-\u097f]{14,}/iu.test(value);
  const spacedCharacters = tokens.length >= 8 && ratio(singleCharacterTokens, tokens.length) >= 0.65;
  const ocrChatter = /\b(?:here is|the transcription|i cannot|as an ai|provided image|uploaded document|markdown)\b/i.test(value.slice(0, 500));
  const entropy = shannonEntropy(value);
  const signals = {
    characters,
    words: tokens.length,
    averageWordLength: Number(averageWordLength.toFixed(2)),
    printableRatio: bounded(ratio(printable, characters)),
    alphabeticRatio: bounded(ratio(alphabetic, nonWhitespace)),
    numericRatio: bounded(ratio(numeric, nonWhitespace)),
    whitespaceRatio: bounded(ratio(whitespace, characters)),
    punctuationRatio: bounded(ratio(punctuation, nonWhitespace)),
    symbolRatio: bounded(ratio(symbols, nonWhitespace)),
    replacementRatio: bounded(ratio(replacements, characters)),
    controlRatio: bounded(ratio(controls, characters)),
    privateUseRatio: bounded(ratio(privateUse, characters)),
    singleCharacterTokenRatio: bounded(ratio(singleCharacterTokens, tokens.length)),
    tokenPlausibility: bounded(plausibility),
    entropy: Number(entropy.toFixed(3)),
    devanagariRatio: bounded(ratio(profile.devanagari, Math.max(profile.letters, 1))),
    repeatedSequence,
    extremeRuns,
    spacedCharacters,
    ocrChatter,
  };
  const reasons = [];
  let penalty = 0;
  const add = (condition, amount, reason) => {
    if (condition) { penalty += amount; reasons.push(reason); }
  };
  add(characters < 20 || alphabetic < 10, 0.85, "insufficient recognizable text");
  add(signals.replacementRatio > 0.02, 0.75, "high replacement-character density");
  add(signals.controlRatio > 0.01, 0.65, "control-character corruption");
  add(signals.privateUseRatio > 0.01, 0.7, "private-use glyph density suggests a broken font map");
  add(signals.alphabeticRatio < 0.18 && characters >= 40, 0.48, "low readable-letter density");
  add(signals.symbolRatio > 0.28 && signals.alphabeticRatio < 0.4, 0.5, "abnormal symbol density");
  add(signals.singleCharacterTokenRatio > 0.55, 0.4, "artificially spaced or fragmented characters");
  add(signals.tokenPlausibility < 0.32 && tokens.length >= 8, 0.55, "very low token plausibility");
  add(repeatedSequence, 0.45, "repeated character sequence corruption");
  add(extremeRuns, 0.3, "extreme unreadable character run");
  add(averageWordLength > 28 && tokens.length >= 5, 0.3, "abnormally long tokens");
  add(ocrChatter && options.method === "ocr", 0.8, "OCR returned conversational model text");
  if (profile.language.startsWith("hi") && signals.devanagariRatio >= 0.45) {
    penalty = Math.max(0, penalty - 0.12);
  }
  const score = bounded(1 - Math.min(1, penalty));
  let quality = QUALITY.GOOD;
  if (characters < 20 || alphabetic < 10) quality = QUALITY.UNRECOVERABLE;
  else if (score < 0.28) quality = QUALITY.CORRUPTED;
  else if (score < 0.72 || reasons.length) quality = QUALITY.SUSPICIOUS;
  return {
    quality,
    score,
    usable: quality === QUALITY.GOOD || (quality === QUALITY.SUSPICIOUS && score >= 0.62),
    language: profile.language,
    signals,
    reasons: reasons.slice(0, 8),
    version: TEXT_QUALITY_VERSION,
  };
};

const aggregateDocumentQuality = (pages = []) => {
  const counts = Object.fromEntries(Object.values(QUALITY).map((quality) => [quality, 0]));
  pages.forEach((page) => { counts[page.quality] = (counts[page.quality] || 0) + 1; });
  const total = pages.length;
  const usablePages = pages.filter((page) => page.usable).length;
  const failedPages = pages.filter((page) => !page.usable).map((page) => page.page);
  const averageScore = total
    ? pages.reduce((sum, page) => sum + Number(page.score || 0), 0) / total
    : 0;
  return {
    counts,
    totalPages: total,
    usablePages,
    failedPages: failedPages.slice(0, 100),
    usableCoverage: bounded(ratio(usablePages, total)),
    averageScore: bounded(averageScore),
    partialRecovery: usablePages > 0 && usablePages < total,
    version: TEXT_QUALITY_VERSION,
  };
};

const evidenceTextIsReliable = (evidence = {}) => {
  const declared = evidence.extractionQuality || evidence.qualityClass ||
    evidence.metadata?.extractionQuality || evidence.metadata?.qualityClass;
  if ([QUALITY.CORRUPTED, QUALITY.UNRECOVERABLE].includes(declared)) return false;
  const score = Number(evidence.extractionQualityScore ?? evidence.metadata?.extractionQualityScore);
  if (Number.isFinite(score) && score >= 0.72) return true;
  const content = String(evidence.content || evidence.text || "").trim();
  // Short labels and graph metadata are not PDF evidence and should be judged by
  // their explicit quality metadata, not by long-form prose thresholds.
  if (content.length < 40 && !declared) return true;
  return evaluateTextQuality(content).usable;
};

module.exports = {
  NORMALIZATION_VERSION,
  OCR_PROMPT_VERSION,
  QUALITY,
  TEXT_QUALITY_VERSION,
  aggregateDocumentQuality,
  evidenceTextIsReliable,
  evaluateTextQuality,
  normalizeExtractedText,
  repairArtificialSpacing,
};
