const SOURCE_GROUPS = [
  {
    key: "legislative-research",
    label: "Verified Legislative References",
    purpose: "Structured Bills, Acts, briefs, and state legislative coverage",
    sources: ["prs-india"],
  },
  {
    key: "parliamentary-records",
    label: "Parliamentary Public Records",
    purpose: "Public parliamentary business, debates, questions, and committees",
    sources: ["digital-sansad", "lok-sabha", "rajya-sabha"],
  },
  {
    key: "official-gazettes",
    label: "Official Gazette Records",
    purpose: "Public notifications, rules, orders, and Gazette publications",
    sources: ["egazette", "state-gazette"],
  },
  {
    key: "official-acts",
    label: "Official Acts Repositories",
    purpose: "Public Acts and subordinate legal instruments",
    sources: ["india-code"],
  },
  {
    key: "policy-and-state",
    label: "Public Policy & State Records",
    purpose: "Policies, schemes, state legislation, and public proceedings",
    sources: ["ministry", "state-legislature"],
  },
];

const STATUS_PRIORITY = {
  Error: 5,
  Stale: 4,
  Fresh: 3,
  Connected: 2,
  Planned: 1,
};

export const getPublicSourceLabel = (sourceName) => {
  const normalized = String(sourceName || "").toLowerCase();
  const group = SOURCE_GROUPS.find((candidate) =>
    candidate.sources.some((source) => normalized.includes(source)),
  );
  return group?.label || "Verified Public Record";
};

export const summarizePublicSources = (sources = []) =>
  SOURCE_GROUPS.map((group) => {
    const members = sources.filter((source) =>
      group.sources.includes(source.key),
    );
    const status =
      members
        .map((source) => source.status || "Planned")
        .sort(
          (left, right) =>
            (STATUS_PRIORITY[right] || 0) - (STATUS_PRIORITY[left] || 0),
        )[0] || "Planned";
    const timestamps = members
      .map((source) => source.lastRefresh)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));
    const lastRefresh = timestamps.length
      ? new Date(Math.max(...timestamps.map((value) => value.getTime())))
      : null;

    return {
      key: group.key,
      label: group.label,
      purpose: group.purpose,
      status,
      documentCount: members.reduce(
        (total, source) => total + Number(source.documentCount || 0),
        0,
      ),
      lastRefresh: lastRefresh?.toISOString() || null,
    };
  });

export { SOURCE_GROUPS };
