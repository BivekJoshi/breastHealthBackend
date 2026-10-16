const { DataTypes } = require("sequelize");

/**
 * Field shapes repeated across the tables.
 *
 * Every editable collection needs the same things: a manual sort position and
 * an on/off switch. Defining them once keeps the models honest with each other.
 */

const id = {
  type: DataTypes.INTEGER.UNSIGNED,
  primaryKey: true,
  autoIncrement: true,
};

/** Lower numbers list first; ties fall back to the name. */
const sortOrder = {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 0,
};

/** The editor's "Visible on the site" switch. */
const isActive = {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: true,
};

const text = (length = 255, defaultValue = "") => ({
  type: DataTypes.STRING(length),
  allowNull: false,
  defaultValue,
});

/** Public ids for URLs. 190 keeps the unique index inside utf8mb4 key limits. */
const slug = { type: DataTypes.STRING(190), allowNull: false, unique: true };

module.exports = { id, sortOrder, isActive, text, slug };
