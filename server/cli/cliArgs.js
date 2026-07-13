const argumentValue = (name, fallback = null) => {
  const exact = `--${name}`;
  const item = process.argv.find(
    (value) => value === exact || value.startsWith(`${exact}=`),
  );
  if (!item) return fallback;
  return item === exact ? true : item.slice(exact.length + 1);
};

const argumentFlag = (name) => {
  const value = argumentValue(name, false);
  if (value === true) return true;
  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase(),
  );
};

const argumentInteger = (name, fallback, minimum = 1, maximum = 10_000) => {
  const parsed = Number.parseInt(argumentValue(name, fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

module.exports = {
  argumentFlag,
  argumentInteger,
  argumentValue,
};
