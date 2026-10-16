const path = require("path");
const dotenv = require("dotenv");

/**
 * The app root's .env, found from this file rather than the working directory,
 * which Passenger does not promise to be the app root. `override` lets the file
 * win over variables set in cPanel's Node.js App screen, so a setting that
 * seems ignored only ever has one place to look.
 */
const ENV_FILE = path.resolve(__dirname, "../../.env");
const ENV_FILE_FOUND = !dotenv.config({ path: ENV_FILE, override: true }).error;

const ENVIRONMENT = process.env.NODE_ENV === "production" ? "prod" : "dev";

/**
 * MySQL connection settings.
 *
 * On cPanel the database, user and password are created in the MySQL Databases
 * area and are always prefixed with the account name (e.g. `breastscan_db`), so
 * every value here has to come from the environment rather than a default.
 */
const DB = {
  HOST: process.env.DB_HOST || "127.0.0.1",
  PORT: Number(process.env.DB_PORT || 3306),
  NAME: process.env.DB_NAME || "breastscan",
  USER: process.env.DB_USER || "root",
  PWD: process.env.DB_PWD || "",
  /* Shared hosting caps concurrent connections hard; keep the pool small. */
  POOL_MAX: Number(process.env.DB_POOL_MAX || 5),
  LOGGING: process.env.DB_LOGGING === "true",
};

const DEFAULT_JWT_SECRET = "breastscan_dev_secret_change_me_before_deploy";

const JWT = {
  SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  /* Anyone holding the default can mint admin sessions. server.js shouts. */
  IS_DEFAULT: !process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET,
};

/** The admin account, created on boot when it does not exist yet. */
const SEED_ADMIN = {
  NAME: process.env.SEED_ADMIN_NAME || "BreastScan Admin",
  EMAIL: (process.env.SEED_ADMIN_EMAIL || "admin@breastscan.com.np").toLowerCase().trim(),
  PASSWORD: process.env.SEED_ADMIN_PASSWORD || "P@ssw0rd",
};

const PORT = Number(process.env.PORT || 4000);

/* The Next.js dev server. Comma-separate for staging + production hosts. */
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

module.exports = {
  ENV_FILE,
  ENV_FILE_FOUND,
  ENVIRONMENT,
  DB,
  JWT,
  SEED_ADMIN,
  PORT,
  CLIENT_URL,
};
