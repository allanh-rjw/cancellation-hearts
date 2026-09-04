export function nonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

export function assertNonEmptyString(value, label) {
  if (!nonEmptyString(value)) throw new TypeError(`${label} is required`);
  return value;
}

export function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

export function assertFiniteNumber(value, label) {
  if (!Number.isFinite(Number(value))) throw new TypeError(`${label} must be finite`);
  return Number(value);
}

export function assertInteger(value, label, { min = Number.MIN_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min) throw new TypeError(`${label} must be an integer >= ${min}`);
  return value;
}

export function assertTimestamp(value, label) {
  assertNonEmptyString(value, label);
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${label} must be a valid timestamp`);
  return value;
}

export function uniqueNonEmptyStrings(values, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  const normalized = values.map((value, index) => assertNonEmptyString(value, `${label}[${index}]`).trim());
  if (!allowEmpty && !normalized.length) throw new TypeError(`${label} must contain at least one value`);
  if (new Set(normalized).size !== normalized.length) throw new TypeError(`${label} must not contain duplicates`);
  return normalized;
}

export function jsonClone(value, label = "value") {
  try {
    return structuredClone(value);
  } catch {
    throw new TypeError(`${label} must be structured-cloneable`);
  }
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
