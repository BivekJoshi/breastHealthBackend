require("colors");

const { createDefaultAdminUser } = require("./seedAdmin");

/**
 * Called on every boot from server.js. Idempotent — the admin is only created
 * when missing, so restarting never clobbers a changed password.
 *
 * Locations are deliberately not seeded. The tables start empty and every
 * city and centre is entered through the admin screen, so nothing sample-only
 * can ever reach the public site.
 */
const runSeeds = async () => {
  await createDefaultAdminUser();
};

/**
 * `npm run seed` runs the same thing standalone, which is how a schema change
 * gets applied on cPanel: upload, then run this from the Node.js App panel.
 * `npm run db:reset` adds --force, which DROPS every table first.
 */
const runFromCli = async () => {
  const { connectDB } = require("../config/db");
  const { syncDatabase } = require("../models");

  const force = process.argv.includes("--force");

  await connectDB();

  if (force) {
    console.log("--force given: dropping and recreating every table.".red.bold);
  }
  await syncDatabase({ alter: !force && process.env.DB_SYNC_ALTER === "true", force });
  await runSeeds();

  console.log("Seed complete.".green.bold);
  process.exit(0);
};

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error("Seed failed ❌".red.bold);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runSeeds };
