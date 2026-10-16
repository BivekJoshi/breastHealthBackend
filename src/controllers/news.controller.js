const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const { Op } = require("sequelize");

const { sequelize, News, NewsImage } = require("../models");
const { ApiError } = require("../utils/ApiError");
const { uniqueSlug } = require("../utils/slugify");
const { Validator, str, toBool, nepalToday } = require("../utils/validate");
const { adminNews, newsImageUrl, publicNewsSummary, publicNewsPost } = require("../utils/serialize");

/** Newest first; posts sharing a date keep the order they were written in. */
const NEWEST_FIRST = [["publishedAt", "DESC"], ["id", "DESC"]];

/** Visible, and its publish date has arrived (in Nepal). */
const live = () => ({ isActive: true, publishedAt: { [Op.lte]: nepalToday() } });

/** The photos' ids and order — never their bytes. */
const withImages = {
  model: NewsImage,
  as: "images",
  attributes: ["id", "key", "sortOrder"],
};

/** Per image, after the admin's browser has shrunk it. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_POST = 12;

/** An unsaved post's uploads are kept this long, then swept. */
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The image type from the file's first bytes. The Content-Type header and the
 * file name are the uploader's claim; this is what the file actually is.
 * SVG is deliberately absent — it can carry script.
 */
const sniffImageType = (buffer) => {
  const starts = (...bytes) => bytes.every((byte, i) => buffer[i] === byte);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
};

const KEY_RE = /^[a-f0-9]{32}$/;

/* ------------------------------------------------------------------ */
/* Public                                                             */
/* ------------------------------------------------------------------ */

/** GET /api/news — the cards for /news, without the bodies. */
const getNews = asyncHandler(async (_req, res) => {
  const posts = await News.findAll({
    where: live(),
    order: NEWEST_FIRST,
    attributes: { exclude: ["bodyEn", "bodyNe"] },
    include: [withImages],
  });
  res.json({ posts: posts.map(publicNewsSummary) });
});

/** GET /api/news/:slug — one live post, body and photos included. */
const getNewsPost = asyncHandler(async (req, res) => {
  const post = await News.findOne({ where: { ...live(), slug: req.params.slug }, include: [withImages] });
  if (!post) throw ApiError.notFound("That news post is not available.");
  res.json({ post: publicNewsPost(post) });
});

/**
 * GET /api/news/images/:key — the image itself.
 *
 * Open to anyone holding the key, which is how an <img> in both the website
 * and the admin can show it without a session. Keys are random and an image
 * never changes once uploaded, so browsers may keep it for a year.
 */
const getNewsImage = asyncHandler(async (req, res) => {
  const { key } = req.params;
  if (!KEY_RE.test(key)) throw ApiError.notFound("That image does not exist.");

  const image = await NewsImage.unscoped().findOne({ where: { key }, attributes: ["data", "mimeType"] });
  if (!image) throw ApiError.notFound("That image does not exist.");

  res.set({
    "Content-Type": image.mimeType,
    "Content-Length": image.data.length,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(image.data);
});

/* ------------------------------------------------------------------ */
/* Admin                                                              */
/* ------------------------------------------------------------------ */

/** GET /api/admin/news — every post, hidden and scheduled ones included. */
const listNews = asyncHandler(async (_req, res) => {
  const posts = await News.findAll({ order: NEWEST_FIRST, include: [withImages] });
  res.json({ posts: posts.map(adminNews), today: nepalToday() });
});

/**
 * POST /api/admin/news/images — the raw file as the request body.
 *
 * The image is stored unclaimed and its id goes back to the editor, which
 * sends it in `imageIds` when the post is saved.
 */
const uploadNewsImage = asyncHandler(async (req, res) => {
  const data = req.body;
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw ApiError.badRequest("Choose an image file to upload.");
  }
  if (data.length > MAX_IMAGE_BYTES) {
    throw new ApiError(413, "That image is larger than 5 MB.");
  }

  const mimeType = sniffImageType(data);
  if (!mimeType) {
    throw ApiError.badRequest("Only JPEG, PNG, WebP or GIF images can be uploaded.");
  }

  /* Sweep uploads from editors that were closed without saving. */
  await NewsImage.destroy({
    where: { newsId: null, createdAt: { [Op.lt]: new Date(Date.now() - ORPHAN_TTL_MS) } },
  });

  const image = await NewsImage.create({
    key: crypto.randomBytes(16).toString("hex"),
    mimeType,
    size: data.length,
    data,
  });

  res.status(201).json({ image: { id: image.id, url: newsImageUrl(image) } });
});

const findPost = async (id) => {
  const post = await News.findByPk(id);
  if (!post) throw ApiError.notFound("That news post no longer exists.");
  return post;
};

/** The ordered photo ids from the editor, or a 400. */
const parseImageIds = (body, validator) => {
  const value = body.imageIds;
  if (!Array.isArray(value) || value.some((id) => !Number.isInteger(id) || id < 1)) {
    validator.fail("imageIds", "The photo list could not be read. Reload the page and try again.");
    return [];
  }
  const ids = [...new Set(value)];
  if (ids.length > MAX_IMAGES_PER_POST) {
    validator.fail("imageIds", `A post can have up to ${MAX_IMAGES_PER_POST} photos.`);
  }
  return ids;
};

const validatePost = (body, has) => {
  const validator = new Validator(body);
  if (has("titleEn")) validator.required("titleEn", "Title").maxLength("titleEn", 200, "Title");
  if (has("titleNe")) validator.maxLength("titleNe", 200, "Nepali title");
  if (has("summaryEn")) validator.maxLength("summaryEn", 500, "Summary");
  if (has("summaryNe")) validator.maxLength("summaryNe", 500, "Nepali summary");
  if (has("bodyEn")) validator.required("bodyEn", "Article text").maxLength("bodyEn", 50000, "Article text");
  if (has("bodyNe")) validator.maxLength("bodyNe", 50000, "Nepali article text");
  if (has("publishedAt")) validator.required("publishedAt", "Publish date").date("publishedAt", "Publish date");
  const imageIds = has("imageIds") ? parseImageIds(body, validator) : null;
  validator.throwIfInvalid();
  return imageIds;
};

/**
 * Makes `ids` the post's photos, in that order: claims new uploads, re-sorts
 * kept ones, and deletes the ones the editor removed.
 */
const setImages = async (post, ids, transaction) => {
  const found = ids.length
    ? await NewsImage.findAll({ where: { id: ids }, attributes: ["id", "newsId"], transaction })
    : [];
  if (found.length !== ids.length || found.some((image) => image.newsId && image.newsId !== post.id)) {
    throw ApiError.badRequest("Please correct the highlighted fields.", {
      imageIds: "A photo is no longer available. Remove it and upload it again.",
    });
  }

  await NewsImage.destroy({
    where: { newsId: post.id, ...(ids.length && { id: { [Op.notIn]: ids } }) },
    transaction,
  });

  /* eslint-disable no-await-in-loop */
  for (const [index, id] of ids.entries()) {
    await NewsImage.update({ newsId: post.id, sortOrder: index }, { where: { id }, transaction });
  }
};

/** The saved post as the admin list shows it. */
const reloadForAdmin = async (id) => adminNews(await News.findByPk(id, { include: [withImages] }));

/** POST /api/admin/news */
const createNews = asyncHandler(async (req, res) => {
  const body = { imageIds: [], ...(req.body || {}) };
  const imageIds = validatePost(body, () => true);

  const titleEn = str(body.titleEn);
  const slug = await uniqueSlug(News, titleEn, "news");

  const id = await sequelize.transaction(async (transaction) => {
    const post = await News.create(
      {
        slug,
        titleEn,
        titleNe: str(body.titleNe),
        summaryEn: str(body.summaryEn),
        summaryNe: str(body.summaryNe),
        bodyEn: str(body.bodyEn),
        bodyNe: str(body.bodyNe) || null,
        publishedAt: str(body.publishedAt),
        isActive: toBool(body.isActive, true),
      },
      { transaction }
    );
    await setImages(post, imageIds, transaction);
    return post.id;
  });

  res.status(201).json({ post: await reloadForAdmin(id) });
});

/** PATCH /api/admin/news/:id — partial, like the location editors. */
const updateNews = asyncHandler(async (req, res) => {
  const post = await findPost(req.params.id);
  const body = req.body || {};
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  const imageIds = validatePost(body, has);

  if (has("titleEn")) post.titleEn = str(body.titleEn);
  if (has("titleNe")) post.titleNe = str(body.titleNe);
  if (has("summaryEn")) post.summaryEn = str(body.summaryEn);
  if (has("summaryNe")) post.summaryNe = str(body.summaryNe);
  if (has("bodyEn")) post.bodyEn = str(body.bodyEn);
  if (has("bodyNe")) post.bodyNe = str(body.bodyNe) || null;
  if (has("publishedAt")) post.publishedAt = str(body.publishedAt);
  if (has("isActive")) post.isActive = toBool(body.isActive);

  await sequelize.transaction(async (transaction) => {
    await post.save({ transaction });
    if (imageIds) await setImages(post, imageIds, transaction);
  });

  res.json({ post: await reloadForAdmin(post.id) });
});

/** DELETE /api/admin/news/:id — its photos go with it (ON DELETE CASCADE). */
const deleteNews = asyncHandler(async (req, res) => {
  const post = await findPost(req.params.id);
  await post.destroy();
  res.json({ success: true });
});

module.exports = {
  getNews,
  getNewsPost,
  getNewsImage,
  listNews,
  uploadNewsImage,
  createNews,
  updateNews,
  deleteNews,
  MAX_IMAGE_BYTES,
};
