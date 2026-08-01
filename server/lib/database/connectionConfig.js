const normalizeConnectionString = (connectionString) => {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");
  if (["prefer", "require", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
};

const isPooledConnectionString = (connectionString) => {
  try {
    return new URL(connectionString).hostname.includes("-pooler.");
  } catch {
    return false;
  }
};

const poolConfig = (connectionString, overrides = {}) => ({
  connectionString: normalizeConnectionString(connectionString),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ...overrides,
});

module.exports = {
  isPooledConnectionString,
  normalizeConnectionString,
  poolConfig,
};
