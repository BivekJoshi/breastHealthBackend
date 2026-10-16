require("colors");

const { sequelize } = require("../config/db");

const { User } = require("./User");
const {
  City,
  Centre,
  PROVINCES,
  PROVINCE_IDS,
  CENTRE_TYPES,
  CENTRE_TYPE_IDS,
} = require("./locations");
const { Appointment, APPOINTMENT_STATUSES, APPOINTMENT_STATUS_IDS } = require("./Appointment");
const { News } = require("./News");
const { NewsImage, IMAGE_TYPES } = require("./NewsImage");

/* ------------------------------------------------------------------ */
/* Associations                                                        */
/* ------------------------------------------------------------------ */

/* RESTRICT, not CASCADE: deleting a city must never silently take its
   centres with it. The controller refuses with a message that says why. */
City.hasMany(Centre, { foreignKey: "cityId", as: "centres", onDelete: "RESTRICT" });
Centre.belongsTo(City, { foreignKey: "cityId", as: "city" });

/* SET NULL: a centre can still be deleted after people have asked for it.
   The request keeps the centre's name in centreName. */
Centre.hasMany(Appointment, { foreignKey: "centreId", as: "appointments", onDelete: "SET NULL" });
Appointment.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });

/* CASCADE: a post's photos mean nothing without it. */
News.hasMany(NewsImage, { foreignKey: "newsId", as: "images", onDelete: "CASCADE" });
NewsImage.belongsTo(News, { foreignKey: "newsId", as: "post" });

/**
 * Adds columns a model declares but its table does not have yet.
 *
 * `sync({ alter: true })` would cover this, but it also reconciles indexes on
 * every boot, and on MySQL that means re-adding the same unique index until
 * the 64-key limit trips — so boot deliberately runs with `alter` off.
 *
 * This pass is narrower. One DESCRIBE per table, then ADD COLUMN for what is
 * genuinely absent — nothing is modified, reordered or dropped, so it cannot
 * lose data, and on an up-to-date database it writes nothing at all.
 */
const ensureColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const added = [];

  for (const model of Object.values(sequelize.models)) {
    const tableName = model.getTableName();

    let table;
    try {
      table = await queryInterface.describeTable(tableName);
    } catch {
      /* sync() has just created it, so every column is already present. */
      continue;
    }

    for (const [name, attribute] of Object.entries(model.getAttributes())) {
      const column = attribute.field || name;
      if (table[column] || attribute.type?.key === "VIRTUAL") continue;

      try {
        await queryInterface.addColumn(tableName, column, attribute);
        added.push(`${tableName}.${column}`);
      } catch (error) {
        /* A NOT NULL column with no default cannot be added to a table that
           already has rows. Say so and keep booting. */
        console.error(`Could not add ${tableName}.${column} — ${error.message}`.red.bold);
      }
    }
  }

  if (added.length) console.log(`Schema catch-up added ${added.join(", ")}`.cyan);
  return added;
};

/** Creates any missing tables and adds new columns to existing ones. */
const syncDatabase = async ({ alter = false, force = false } = {}) => {
  await sequelize.sync({ alter, force });
  if (!alter && !force) await ensureColumns();
};

module.exports = {
  sequelize,
  syncDatabase,

  User,
  City,
  Centre,
  Appointment,
  News,
  NewsImage,

  IMAGE_TYPES,
  PROVINCES,
  PROVINCE_IDS,
  CENTRE_TYPES,
  CENTRE_TYPE_IDS,
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_IDS,
};
