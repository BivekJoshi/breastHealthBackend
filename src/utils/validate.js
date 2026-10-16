const { ApiError } = require("./ApiError");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === "";

/**
 * Collects per-field messages and throws them all at once, so a form can
 * highlight every bad input in one round trip instead of one at a time.
 */
class Validator {
  constructor(body = {}) {
    this.body = body;
    this.details = {};
  }

  required(field, label) {
    if (isBlank(this.body[field])) this.details[field] = `${label} is required.`;
    return this;
  }

  email(field, label = "Email") {
    const value = this.body[field];
    if (!isBlank(value) && !EMAIL_RE.test(String(value).trim())) {
      this.details[field] = `Enter a valid ${label.toLowerCase()} address.`;
    }
    return this;
  }

  minLength(field, min, label) {
    const value = this.body[field];
    if (!isBlank(value) && String(value).length < min) {
      this.details[field] = `${label} must be at least ${min} characters.`;
    }
    return this;
  }

  maxLength(field, max, label) {
    const value = this.body[field];
    if (!isBlank(value) && String(value).trim().length > max) {
      this.details[field] = `${label} must be ${max} characters or fewer.`;
    }
    return this;
  }

  oneOf(field, allowed, label) {
    const value = this.body[field];
    if (!isBlank(value) && !allowed.includes(value)) {
      this.details[field] = `${label} must be one of: ${allowed.join(", ")}.`;
    }
    return this;
  }

  integer(field, label, { min, max } = {}) {
    const value = this.body[field];
    if (isBlank(value)) return this;
    const number = Number(value);
    if (!Number.isInteger(number)) {
      this.details[field] = `${label} must be a whole number.`;
    } else if (min !== undefined && number < min) {
      this.details[field] = `${label} must be ${min} or more.`;
    } else if (max !== undefined && number > max) {
      this.details[field] = `${label} must be ${max} or less.`;
    }
    return this;
  }

  /** Loose on purpose: spaces, dashes, brackets and a leading + all pass. */
  phone(field, label = "Phone number") {
    const value = this.body[field];
    if (isBlank(value)) return this;
    const raw = String(value).trim();
    const digits = raw.replace(/\D/g, "");
    if (!/^\+?[\d\s().-]+$/.test(raw) || digits.length < 7 || digits.length > 15) {
      this.details[field] = `Enter a valid ${label.toLowerCase()}.`;
    }
    return this;
  }

  /** A calendar date as the browser's date input sends it: YYYY-MM-DD. */
  date(field, label) {
    const value = this.body[field];
    if (isBlank(value)) return this;
    const raw = String(value).trim();
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== raw) {
      this.details[field] = `${label} must be a valid date.`;
    }
    return this;
  }

  /** An absolute http(s) link, or a path on this site such as /images/x.jpg. */
  url(field, label) {
    const value = this.body[field];
    if (isBlank(value)) return this;
    const raw = String(value).trim();
    if (raw.startsWith("/") && !raw.startsWith("//")) return this;
    try {
      const { protocol } = new URL(raw);
      if (protocol !== "http:" && protocol !== "https:") throw new Error();
    } catch {
      this.details[field] = `${label} must be a link starting with https:// or /.`;
    }
    return this;
  }

  /** Records a message for a check the chained helpers cannot express. */
  fail(field, message) {
    this.details[field] = message;
    return this;
  }

  /** Throws a 400 carrying every collected field message. */
  throwIfInvalid(message = "Please correct the highlighted fields.") {
    if (Object.keys(this.details).length > 0) {
      throw ApiError.badRequest(message, this.details);
    }
  }
}

/** Trims a value to a string, falling back when it is absent. */
const str = (value, fallback = "") =>
  isBlank(value) ? fallback : String(value).trim();

/**
 * Checkboxes arrive as real booleans from JSON, but as "true"/"1"/"on" from a
 * plain form post, so both have to be understood.
 */
const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "on", "yes"].includes(String(value).toLowerCase());
};

const toInt = (value, fallback = 0) => (isBlank(value) ? fallback : Number(value));

/**
 * Today's date in Nepal (UTC+5:45), as YYYY-MM-DD. The server runs on UTC, so
 * without the shift a visitor booking just after midnight would be told their
 * "today" is in the past, and a post scheduled for today would go live late.
 */
const nepalToday = () =>
  new Date(Date.now() + (5 * 60 + 45) * 60 * 1000).toISOString().slice(0, 10);

module.exports = { Validator, isBlank, str, toBool, toInt, nepalToday };
