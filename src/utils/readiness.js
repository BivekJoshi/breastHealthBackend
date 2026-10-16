/**
 * Boot state, shared between server.js (which sets it) and GET /api/health
 * (which reports it).
 *
 * It lives in its own module rather than hanging off the Express app because
 * server.js already requires the router — reaching back the other way would
 * be a require cycle.
 */

const state = { phase: "starting", error: null, since: Date.now() };

/** phase: "starting" while warming up, "ready" once the DB is usable, "failed" after a boot error. */
const setPhase = (phase, error = null) => {
  state.phase = phase;
  state.error = error ? error.message || String(error) : null;
  state.since = Date.now();
};

const getState = () => ({ ...state });

module.exports = { setPhase, getState };
