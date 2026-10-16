const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/**
 * Appends -2, -3, … until the slug is free on `model`.
 *
 * Slugs are the public ids the website links with (?city=kathmandu,
 * ?centre=kathmandu-baneshwor), so they are set once at creation and never
 * regenerated — correcting a typo in a name must not break shared links.
 */
const uniqueSlug = async (model, value, fallback = "item") => {
  const base = slugify(value) || fallback;
  let candidate = base;
  let suffix = 2;

  /* eslint-disable no-await-in-loop */
  for (;;) {
    const clash = await model.findOne({ where: { slug: candidate }, attributes: ["id"] });
    if (!clash) return candidate;

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
};

module.exports = { slugify, uniqueSlug };
