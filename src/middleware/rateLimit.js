const { ApiError } = require("../utils/ApiError");

/**
 * A small per-IP limit for the public write endpoints, so a script cannot
 * bury the appointments list in junk.
 *
 * In memory on purpose: no extra package, and nothing to configure on cPanel.
 * Each Passenger process keeps its own count and a restart clears them, which
 * is fine for slowing abuse down — it is not meant as an exact quota.
 */
const rateLimit = ({ windowMs, max, message }) => {
  const hits = new Map();

  /* Forget visitors whose window has passed, so the map cannot grow forever. */
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req, _res, next) => {
    const now = Date.now();
    const ip = req.ip || "unknown";
    let entry = hits.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;
    if (entry.count > max) return next(new ApiError(429, message));
    return next();
  };
};

module.exports = { rateLimit };
