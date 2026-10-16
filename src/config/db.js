const { Sequelize } = require("sequelize");
const { DB, ENVIRONMENT } = require("./config");

/**
 * One Sequelize instance for the whole process.
 *
 * `sequelize.sync()` is used instead of the migration CLI on purpose: cPanel's
 * Node.js Selector gives you a "Run JS script" button and a restricted shell,
 * so a deploy that needs `npx sequelize-cli db:migrate` is painful. Syncing on
 * boot means uploading the files and restarting the app is enough.
 */
const sequelize = new Sequelize(DB.NAME, DB.USER, DB.PWD, {
  host: DB.HOST,
  port: DB.PORT,
  dialect: "mysql",
  logging: DB.LOGGING ? console.log : false,
  define: {
    /* snake_case columns, so hand-written SQL in phpMyAdmin reads naturally. */
    underscored: true,
    /* utf8mb4, or the Nepali (Devanagari) names would not survive the trip. */
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
  },
  pool: {
    max: DB.POOL_MAX,
    min: 0,
    idle: 10000,
    acquire: 30000,
  },
  timezone: "+00:00",
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`Database connected: ${DB.USER}@${DB.HOST}/${DB.NAME}`.cyan.underline);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`.red.bold);
    if (ENVIRONMENT !== "prod") {
      console.error(
        "Check DB_HOST / DB_NAME / DB_USER / DB_PWD in .env, and that MySQL is running."
          .yellow
      );
    }
    throw error;
  }
};

module.exports = { sequelize, connectDB };
