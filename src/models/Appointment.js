const { DataTypes } = require("sequelize");

const { sequelize } = require("../config/db");
const { id, text } = require("./_shared");

/**
 * Where a request sits in the call-back workflow. "new" is everything the
 * website has sent that nobody has phoned yet — the admin opens on that list.
 */
const APPOINTMENT_STATUSES = [
  { id: "new", en: "New" },
  { id: "confirmed", en: "Confirmed" },
  { id: "completed", en: "Completed" },
  { id: "cancelled", en: "Cancelled" },
];

const APPOINTMENT_STATUS_IDS = APPOINTMENT_STATUSES.map((s) => s.id);

/**
 * A screening request from the website's booking form. Nothing is booked yet
 * when it arrives — staff call the visitor back to agree a centre and time.
 */
const Appointment = sequelize.define(
  "Appointment",
  {
    id,
    name: { type: DataTypes.STRING(120), allowNull: false },
    phone: { type: DataTypes.STRING(60), allowNull: false },
    age: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    preferredDate: { type: DataTypes.DATEONLY, allowNull: true },
    atHome: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /* Null for a home visit, or once the centre has been deleted. */
    centreId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    /* The centre's name when the request came in, so the request still says
       where even after the centre is renamed or deleted. */
    centreName: text(160),
    message: { type: DataTypes.TEXT, allowNull: true },
    /* The language the visitor used, so the call back can start in it. */
    locale: text(5, "en"),
    status: {
      type: DataTypes.ENUM(...APPOINTMENT_STATUS_IDS),
      allowNull: false,
      defaultValue: "new",
    },
    /* Staff only — never sent to the website. */
    adminNote: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: "appointments", indexes: [{ fields: ["status", "created_at"] }] }
);

module.exports = { Appointment, APPOINTMENT_STATUSES, APPOINTMENT_STATUS_IDS };
