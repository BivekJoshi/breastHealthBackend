const { Router } = require("express");

const authRoutes = require("./auth.routes");
const publicRoutes = require("./public.routes");
const adminRoutes = require("./admin.routes");

const { getState } = require("../utils/readiness");

const router = Router();

/**
 * Deploy smoke test target. Only a fully warmed app answers `"status":"ok"` —
 * a boot that is still connecting answers `"starting"` and one that gave up
 * answers `"failed"` with the reason, both with a 503. That is the difference
 * between a deploy log that names the problem and the web server's blank 503.
 */
router.get("/health", (_req, res) => {
  const { phase, error } = getState();
  const ready = phase === "ready";

  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : phase,
    uptime: process.uptime(),
    ...(error ? { error } : {}),
  });
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);

/* Public routes are mounted last so they cannot shadow /auth or /admin. */
router.use("/", publicRoutes);

module.exports = router;
