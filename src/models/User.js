const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

const { sequelize } = require("../config/db");
const { id, isActive } = require("./_shared");

/** An account that may sign in to the locations admin. */
const User = sequelize.define(
  "User",
  {
    id,
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: {
      type: DataTypes.STRING(190), // 190 keeps the unique index inside utf8mb4 key limits
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value) {
        this.setDataValue("email", String(value || "").toLowerCase().trim());
      },
    },
    password: { type: DataTypes.STRING(255), allowNull: false },
    isActive,
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "users",
    /* Hashes must never ride along on a stray findAll(). Ask for them by name. */
    defaultScope: { attributes: { exclude: ["password"] } },
    scopes: { withPassword: { attributes: {} } },
    hooks: {
      async beforeSave(user) {
        if (user.changed("password")) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

User.prototype.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(String(plain), this.password);
};

module.exports = { User };
