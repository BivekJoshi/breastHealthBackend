const { DataTypes } = require("sequelize");

const { sequelize } = require("../config/db");
const { id, sortOrder } = require("./_shared");

/** The image formats a news post accepts — checked against the file's own bytes, not its name. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * A photo on a news post, stored in the database itself.
 *
 * In MySQL rather than on disk so it survives a cPanel redeploy (uploading
 * the app folder again would wipe an uploads directory) and is backed up with
 * everything else. The admin's browser shrinks photos before sending them, so
 * a typical image is a few hundred KB.
 *
 * An image is uploaded before its post is saved, so newsId starts out null;
 * saving the post claims it. Unclaimed images are swept after a day.
 */
const NewsImage = sequelize.define(
  "NewsImage",
  {
    id,
    /* The public id in /api/news/images/<key>. Random, so a draft post's
       photos cannot be found by counting up from 1. */
    key: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    newsId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    mimeType: { type: DataTypes.ENUM(...IMAGE_TYPES), allowNull: false },
    size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    /* The first image is the post's cover. */
    sortOrder,
    /* MEDIUMBLOB: up to 16 MB. Uploads are capped well below that. */
    data: { type: DataTypes.BLOB("medium"), allowNull: false },
  },
  {
    tableName: "news_images",
    indexes: [{ fields: ["news_id", "sort_order"] }],
    /* The bytes must never ride along on a list query. Ask for them with unscoped(). */
    defaultScope: { attributes: { exclude: ["data"] } },
  }
);

module.exports = { NewsImage, IMAGE_TYPES };
