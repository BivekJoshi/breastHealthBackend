const express = require("express");
const cors = require("cors");
require("colors");

const { PORT, CLIENT_URL, ENVIRONMENT, JWT } = require("./config/config");
const { connectDB } = require("./config/db");
const { syncDatabase } = require("./models");
const { runSeeds } = require("./seed");
const { setPhase } = require("./utils/readiness");
const { ApiError } = require("./utils/ApiError");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

/* Behind cPanel/Passenger and most proxies, so trust the forwarded headers. */
app.set("trust proxy", 1);

/* ------------------ Middleware ------------------ */
/* A long bilingual news post outgrows the default — Devanagari is 3 bytes a
   character. Parsed here first, the global parser below then leaves it alone. */
app.use("/api/admin/news", express.json({ limit: "512kb" }));
app.use(express.json({ limit: "100kb" }));

/* CLIENT_URL may hold a comma-separated list for staging + production hosts. */
const allowedOrigins = CLIENT_URL.split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      /* No Origin header: curl, health checks, or a same-origin request. */
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS.`));
    },
  })
);

/* ------------------ API ------------------ */
app.use("/api", routes);

app.get("/", (_req, res) => {
  res.status(200).send("BreastScan API is running 🚀");
});

/* ------------------ Errors ------------------ */
app.use(notFoundHandler);
app.use(errorHandler);

/* ------------------ Server ------------------ */
/**
 * Listen first, warm up afterwards.
 *
 * Passenger spawns this process lazily on the first request and gives it a
 * limited window to bind a socket. Doing the DB handshake, the schema sync and
 * the seed *before* listen() means any slow or failed step produces the web
 * server's own blank 503. Binding immediately means /api/health always answers
 * and can name the actual problem.
 */
const warmUp = async (attempt = 1) => {
  const MAX_ATTEMPTS = 5;

  try {
    await connectDB();
    /* No `alter` on boot: on MySQL every altered sync re-adds each unique
       index under a new name until the 64-key limit stops the API starting.
       New tables and columns are still picked up — see syncDatabase. */
    await syncDatabase({ alter: process.env.DB_SYNC_ALTER === "true" });
    await runSeeds();

    setPhase("ready");
    console.log("Warm-up complete — /api/health is now ok".green.bold);
  } catch (error) {
    /* Never exit. A live process keeps reporting why it is unhappy, and
       recovers on its own once the database comes back. */
    if (attempt < MAX_ATTEMPTS) {
      console.error(
        `Warm-up attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message} — retrying in 5s`.yellow
      );
      setTimeout(() => warmUp(attempt + 1), 5000);
      return;
    }

    setPhase("failed", error);
    console.error("Warm-up failed after every attempt ❌".red.bold);
    console.error(error);
  }
};

app.listen(PORT, () => {
  console.log(`Server started on PORT ${PORT} [${ENVIRONMENT}]`.yellow.bold);

  if (ENVIRONMENT === "prod" && JWT.IS_DEFAULT) {
    console.error(
      "JWT_SECRET is not set — anyone can forge admin sessions. Set it in .env.".red.bold
    );
  }

  warmUp();
});

module.exports = app;
