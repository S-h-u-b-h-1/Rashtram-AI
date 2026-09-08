const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");
const { normalizePolicyDraft } = require("./policyDraftService");

const BRAND = "8F1D2C";
const INK = "29312D";
const MUTED = "706A61";
const PAPER = "FBF8F2";
const clean = (value) => String(value || "")
  .replace(/\[object Object\]/gi, "")
  .replace(/\*\*/g, "")
  .replace(/`/g, "")
  .trim();

const bodyParagraph = (value, options = {}) => new Paragraph({
  spacing: { after: 160, line: 310 },
  ...options,
  children: [new TextRun({ text: clean(value), size: 22, color: INK })],
});

const contentParagraphs = (value) => clean(value)
  .split(/\n+/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const bullet = /^[-*•]\s+/.test(line);
    return bodyParagraph(line.replace(/^[-*•]\s+/, ""), bullet ? { bullet: { level: 0 } } : {});
  });

const sectionHeading = (number, title) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 320, after: 150 },
  border: { bottom: { color: "D9C5C0", style: BorderStyle.SINGLE, size: 4, space: 4 } },
  children: [new TextRun({ text: `${number}. ${clean(title)}`, bold: true, size: 30, color: BRAND })],
});

const referenceText = (citation, number) => {
  const title = clean(citation.title || citation.documentTitle || citation.fileName || `Source ${number}`);
  const authority = clean(citation.authority || citation.documentType || citation.sourceType || "");
  const url = clean(citation.sourceUrl || "");
  return `[${number}] ${title}${authority ? `. ${authority}` : ""}${url ? `. ${url}` : ""}`;
};

const buildPolicyDraftDocx = async ({ draft, citations = [], brief = {}, createdAt = new Date() }) => {
  const canonical = normalizePolicyDraft(draft);
  const date = new Date(createdAt);
  const metadataRows = [
    ["Jurisdiction", brief.geography || "Not specified"],
    ["Intended audience", brief.audience || "Not specified"],
    ["Prepared", Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })],
    ["Status", "Evidence-grounded working draft"],
  ];
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 900, after: 160 },
      children: [new TextRun({ text: "RASHTRAM AI", bold: true, color: BRAND, size: 24, characterSpacing: 180 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 650, after: 260 },
      children: [new TextRun({ text: canonical.title, bold: true, color: BRAND, size: 46 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 700 },
      children: [new TextRun({ text: "Evidence-grounded policy working document", italics: true, color: MUTED, size: 24 })],
    }),
    new Table({
      width: { size: 82, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: metadataRows.map(([label, value]) => new TableRow({ children: [
        new TableCell({
          shading: { fill: "F1E5E1", type: ShadingType.CLEAR },
          width: { size: 32, type: WidthType.PERCENTAGE },
          children: [bodyParagraph(label, { spacing: { after: 0 } })],
        }),
        new TableCell({
          shading: { fill: PAPER, type: ShadingType.CLEAR },
          width: { size: 68, type: WidthType.PERCENTAGE },
          children: [bodyParagraph(value, { spacing: { after: 0 } })],
        }),
      ] })),
    }),
    new Paragraph({ children: [new PageBreak()] }),
    sectionHeading(1, "Executive Summary / Policy Statement"),
    ...contentParagraphs(canonical.executiveSummary),
  ];

  let sectionNumber = 2;
  for (const section of canonical.sections) {
    children.push(sectionHeading(sectionNumber, section.heading || "Policy Analysis"));
    children.push(...contentParagraphs(section.content));
    sectionNumber += 1;
  }
  const collections = [
    ["Recommendations", canonical.recommendations],
    ["Implementation Framework", canonical.implementation],
    ["Risks and Mitigations", canonical.risks],
    ["Evidence Limitations", canonical.evidenceLimitations],
  ];
  for (const [heading, items] of collections) {
    if (!items.length) continue;
    children.push(sectionHeading(sectionNumber, heading));
    for (const item of items) {
      if (item.heading) children.push(new Paragraph({
        spacing: { before: 140, after: 80 },
        children: [new TextRun({ text: clean(item.heading), bold: true, size: 23, color: INK })],
      }));
      children.push(bodyParagraph(item.content, { bullet: { level: 0 } }));
    }
    sectionNumber += 1;
  }
  children.push(sectionHeading(sectionNumber, "References / Sources"));
  if (citations.length) {
    citations.forEach((citation, index) => children.push(bodyParagraph(referenceText(citation, index + 1), { hanging: 360 })));
  } else {
    children.push(bodyParagraph("No source list was retained with this working draft."));
  }
  children.push(new Paragraph({
    spacing: { before: 360 },
    shading: { fill: "F1E5E1", type: ShadingType.CLEAR },
    children: [new TextRun({
      text: "Research assistance only. Verify legal, financial, institutional, and statistical claims against the cited originals before adoption.",
      italics: true,
      color: MUTED,
      size: 18,
    })],
  }));

  const border = { color: "D7B9B1", style: BorderStyle.SINGLE, size: 6, space: 18 };
  const document = new Document({
    creator: "Rashtram AI",
    title: canonical.title,
    description: "Evidence-grounded policy working document",
    styles: {
      default: { document: { run: { font: "Aptos", size: 22, color: INK } } },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1050, right: 1000, bottom: 1000, left: 1000, header: 450, footer: 450 },
          borders: {
            pageBorderTop: border,
            pageBorderRight: border,
            pageBorderBottom: border,
            pageBorderLeft: border,
          },
        },
      },
      headers: { default: new Header({ children: [new Paragraph({
        border: { bottom: { color: "D9C5C0", style: BorderStyle.SINGLE, size: 3, space: 4 } },
        children: [new TextRun({ text: "RASHTRAM AI  ·  POLICY WORKING DOCUMENT", bold: true, color: BRAND, size: 16 })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Confidential working draft  ·  ", color: MUTED, size: 16 }),
          new TextRun({ children: ["Page ", PageNumber.CURRENT], color: MUTED, size: 16 }),
        ],
      })] }) },
      children,
    }],
  });
  return Packer.toBuffer(document);
};

module.exports = { buildPolicyDraftDocx, referenceText };
