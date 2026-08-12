const documentLabel = (document = {}) =>
  [
    document.title,
    document.documentType || document.type,
    document.ministry || document.authority,
    document.jurisdiction || document.state,
    document.year,
  ]
    .filter(Boolean)
    .join(" · ");

const baseGroundingInstruction = (document) => `
Document under review: ${documentLabel(document) || "current document"}.

Use only the retrieved Rashtram AI source context and document brief.
For every substantive claim, cite the supplied source labels inline.
Separate "Stated evidence" from "Analytical implication" when you infer a
risk, stakeholder effect, or implementation consequence from stated facts.
If evidence is missing, write "Not identified in the retrieved text" instead
of guessing. Keep the output concise, decision-ready, and professionally
structured.
`.trim();

const workflowPrompt = (document, task) =>
  [baseGroundingInstruction(document), task].join("\n\n");

export const RESEARCH_WORKFLOW_GROUPS = [
  {
    id: "understand",
    title: "Understand",
    description: "Turn a dense document into a usable research brief.",
    workflows: [
      {
        id: "executive_brief",
        title: "Executive brief",
        shortTitle: "Brief",
        description: "Purpose, core provisions, affected groups, and open questions.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Create an executive research brief with these sections:
1. What this document is about
2. Main objectives or operative changes
3. Affected people, sectors, or institutions
4. Implementation or compliance implications
5. What is not identified in the retrieved text
6. Three follow-up research questions grounded in the evidence`,
          ),
      },
      {
        id: "evidence_table",
        title: "Evidence table",
        shortTitle: "Evidence",
        description: "Convert retrieved passages into cited claims and implications.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Build a compact evidence table with columns:
- Issue
- Stated evidence
- Source citation
- Analytical implication
- Confidence: High / Medium / Low

Use at most eight rows. Do not include claims without citations.`,
          ),
      },
      {
        id: "plain_language",
        title: "Plain-language explainer",
        shortTitle: "Explain",
        description: "Explain the document for a non-specialist reader.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Explain this document in plain language:
1. One-sentence gist
2. Why it matters
3. What changes or findings are stated
4. Who should care
5. Limits of the retrieved evidence

Avoid legal jargon unless necessary, and define it when used.`,
          ),
      },
    ],
  },
  {
    id: "analyse",
    title: "Analyse",
    description: "Apply policy-research lenses to the grounded evidence.",
    workflows: [
      {
        id: "implementation_risks",
        title: "Implementation risk scan",
        shortTitle: "Risks",
        description: "Find delivery, capacity, equity, compliance, and monitoring risks.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Run an implementation risk scan. Use this structure:
1. Stated implementation requirements or gaps
2. Delivery and administrative capacity risks
3. Equity, access, or exclusion risks
4. Compliance and enforcement risks
5. Monitoring, data, or accountability risks
6. Mitigations suggested by the evidence or reasonable next questions

Label each point as "Stated evidence" or "Analytical implication".`,
          ),
      },
      {
        id: "stakeholder_map",
        title: "Stakeholder map",
        shortTitle: "Stakeholders",
        description: "Map affected groups, authorities, beneficiaries, and opponents.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Create a stakeholder map:
1. Directly named institutions or authorities
2. Affected citizens, sectors, or regulated entities
3. Implementing bodies
4. Beneficiaries
5. Groups facing burdens or risks
6. Missing stakeholders that should be checked next

Do not name an institution unless it appears in the retrieved evidence.`,
          ),
      },
      {
        id: "institutional_impact",
        title: "Institutional impact map",
        shortTitle: "Institutions",
        description: "Identify how institutions, departments, regulators, or governments are affected.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Map institutional impact:
1. Institutions explicitly mentioned
2. Powers, duties, or responsibilities assigned
3. Coordination requirements
4. Administrative burden
5. Accountability or oversight implications
6. Institutions not identified but relevant to verify next`,
          ),
      },
      {
        id: "compliance_burden",
        title: "Compliance burden analysis",
        shortTitle: "Compliance",
        description: "Extract duties, deadlines, reporting, penalties, and burden points.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Analyse compliance burden:
1. Who must comply
2. Required actions, filings, reports, or standards
3. Dates, deadlines, or transition periods
4. Penalties or consequences
5. Administrative cost or complexity implications
6. Evidence gaps`,
          ),
      },
      {
        id: "causal_loop",
        title: "Causal loop analysis",
        shortTitle: "Causality",
        description: "Trace problem → intervention → expected effects → feedback risks.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Create a causal loop analysis:
1. Problem or gap identified
2. Intervention or policy lever
3. Expected first-order effects
4. Possible second-order effects
5. Reinforcing or balancing feedback loops
6. Assumptions that need validation`,
          ),
      },
    ],
  },
  {
    id: "draft",
    title: "Draft",
    description: "Generate reusable research outputs from the evidence.",
    workflows: [
      {
        id: "policy_brief",
        title: "Policy brief draft",
        shortTitle: "Policy brief",
        description: "Produce a concise, source-grounded policy brief.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Draft a policy brief with:
1. Title
2. Executive summary
3. Problem statement
4. Evidence from the document
5. Policy implications
6. Implementation risks
7. Recommendations or next research questions

Keep recommendations clearly tied to evidence or label them as next questions.`,
          ),
      },
      {
        id: "argument_critique",
        title: "Argument critique",
        shortTitle: "Critique",
        description: "Stress-test an argument or claim against the document evidence.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Critique the document's apparent argument or policy logic:
1. Core claim or objective
2. Evidence that supports it
3. Evidence that is missing or weak
4. Assumptions
5. Counterarguments
6. Questions a reviewer should ask`,
          ),
      },
      {
        id: "op_ed_outline",
        title: "Op-ed outline",
        shortTitle: "Op-ed",
        description: "Create a public-facing argument outline from grounded evidence.",
        prompt: (document) =>
          workflowPrompt(
            document,
            `Create an op-ed outline:
1. Proposed headline
2. Hook
3. Central argument
4. Three evidence-backed points
5. Counterpoint and response
6. Closing paragraph direction

Keep it factual and cite evidence for each point.`,
          ),
      },
    ],
  },
];

export const FEATURED_RESEARCH_WORKFLOWS = [
  "executive_brief",
  "implementation_risks",
  "stakeholder_map",
  "policy_brief",
];

export const flattenResearchWorkflows = () =>
  RESEARCH_WORKFLOW_GROUPS.flatMap((group) =>
    group.workflows.map((workflow) => ({
      ...workflow,
      groupId: group.id,
      groupTitle: group.title,
    })),
  );
