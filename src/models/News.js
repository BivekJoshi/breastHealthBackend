const { DataTypes } = require("sequelize");

const { sequelize } = require("../config/db");
const { id, slug, text, isActive } = require("./_shared");

/**
 * A news post on the website's /news page. Its photos are NewsImage rows.
 *
 * The body is plain text, split into paragraphs on blank lines when shown, so
 * nothing typed in the admin can inject markup into the public site. As with
 * locations, the Nepali fields are optional and fall back to the English.
 */
const News = sequelize.define(
  "News",
  {
    id,
    /* Public id: /news?post=<slug>. Set once, never regenerated. */
    slug,
    titleEn: { type: DataTypes.STRING(200), allowNull: false },
    titleNe: text(200),
    summaryEn: text(500),
    summaryNe: text(500),
    bodyEn: { type: DataTypes.TEXT, allowNull: false },
    bodyNe: { type: DataTypes.TEXT, allowNull: true },
    /* A future date schedules the post: it stays off the site until then. */
    publishedAt: { type: DataTypes.DATEONLY, allowNull: false },
    isActive,
  },
  { tableName: "news_posts", indexes: [{ fields: ["is_active", "published_at"] }] }
);

module.exports = { News };
