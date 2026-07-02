const DAILY_SOURCES = [
  "prs-india",
  "india-code",
  "egazette",
  "pib",
  "ministry-environment",
  "niti-aayog",
  "mygov",
  "state-policy",
  "regulator-rbi",
  "regulator-sebi",
  "regulator-trai",
];

const WEEKLY_SOURCES = [
  "ministry",
  "india-gov",
  "state-directory",
  "state-legislature",
  "state-gazette",
  "state-policy",
  "policy-edge",
  "regulator-rbi",
  "regulator-sebi",
  "regulator-trai",
  "regulator-uidai",
  "regulator-cci",
  "regulator-cerc",
  "regulator-irdai",
  "regulator-pfrda",
  "regulator-nmc",
  "regulator-aicte",
  "regulator-ugc",
  "regulator-ec",
  "regulator-nclat",
  "regulator-gst-council",
  "regulator-cbdt",
  "regulator-cbic",
  "regulator-nclt",
];

const BOUNDED_CRON_SOURCES = ["pib", "egazette", "niti-aayog"];

const scheduleForProfile = (profile) => {
  if (profile === "weekly") return WEEKLY_SOURCES;
  if (profile === "cron") return BOUNDED_CRON_SOURCES;
  return DAILY_SOURCES;
};

module.exports = {
  BOUNDED_CRON_SOURCES,
  DAILY_SOURCES,
  WEEKLY_SOURCES,
  scheduleForProfile,
};
