const { DataTypes } = require("sequelize");

const { sequelize } = require("../config/db");
const { id, slug, text, sortOrder, isActive } = require("./_shared");

/**
 * Nepal's seven provinces, in official order (east → west).
 *
 * Fixed by the constitution, so they are reference data in code rather than a
 * table the admin has to fill in. The order matters: the website lists
 * provinces and their cities east to west, and so does every query here.
 */
const PROVINCES = [
  { id: "koshi", en: "Koshi", ne: "कोशी" },
  { id: "madhesh", en: "Madhesh", ne: "मधेश" },
  { id: "bagmati", en: "Bagmati", ne: "बागमती" },
  { id: "gandaki", en: "Gandaki", ne: "गण्डकी" },
  { id: "lumbini", en: "Lumbini", ne: "लुम्बिनी" },
  { id: "karnali", en: "Karnali", ne: "कर्णाली" },
  { id: "sudurpashchim", en: "Sudurpashchim", ne: "सुदूरपश्चिम" },
];

/** Drives the badge on each centre card on the website. */
const CENTRE_TYPES = [
  { id: "clinic", en: "Clinic", ne: "क्लिनिक" },
  { id: "hospital", en: "Hospital", ne: "अस्पताल" },
  { id: "diagnostic", en: "Diagnostic centre", ne: "डायग्नोस्टिक केन्द्र" },
];

const PROVINCE_IDS = PROVINCES.map((p) => p.id);
const CENTRE_TYPE_IDS = CENTRE_TYPES.map((t) => t.id);

/**
 * A city the screening network reaches. Every centre belongs to one, and the
 * website groups centres under their city.
 *
 * The Nepali name is optional so a city can be added before its translation is
 * ready — the API falls back to the English name until it is filled in.
 */
const City = sequelize.define(
  "City",
  {
    id,
    /* Public id: /locations?city=<slug>. Set once, never regenerated. */
    slug,
    nameEn: { type: DataTypes.STRING(120), allowNull: false },
    nameNe: text(120),
    province: { type: DataTypes.ENUM(...PROVINCE_IDS), allowNull: false },
    sortOrder,
    isActive,
  },
  { tableName: "cities", indexes: [{ fields: ["province", "sort_order"] }] }
);

/** A screening centre: what the website's location finder and booking form list. */
const Centre = sequelize.define(
  "Centre",
  {
    id,
    /* Public id: /book?centre=<slug>. Set once, never regenerated. */
    slug,
    cityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    nameEn: { type: DataTypes.STRING(160), allowNull: false },
    nameNe: text(160),
    addressEn: { type: DataTypes.STRING(255), allowNull: false },
    addressNe: text(255),
    phone: { type: DataTypes.STRING(60), allowNull: false },
    type: {
      type: DataTypes.ENUM(...CENTRE_TYPE_IDS),
      allowNull: false,
      defaultValue: "clinic",
    },
    sortOrder,
    isActive,
  },
  { tableName: "centres", indexes: [{ fields: ["city_id", "sort_order"] }] }
);

module.exports = {
  City,
  Centre,
  PROVINCES,
  PROVINCE_IDS,
  CENTRE_TYPES,
  CENTRE_TYPE_IDS,
};
