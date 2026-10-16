/**
 * Two shapes leave the server.
 *
 * The public one is exactly what the website's location finder already reads:
 * slugs as ids and { en, ne } pairs, with the Nepali falling back to English
 * while a translation is still blank — a visitor should never see an empty
 * name.
 *
 * The admin one is snake_case with database ids and the raw columns, blanks
 * included, so the editor shows what is actually stored.
 */

const iso = (value) => (value ? new Date(value).toISOString() : null);

const bilingual = (en, ne) => ({ en, ne: ne || en });

/** Relative to the API base, so it works under any host: the website prefixes its API_URL. */
const newsImageUrl = (image) => `/news/images/${image.key}`;

/** Needs `post.images` included; sorts them cover-first. */
const imagesOf = (post) =>
  [...(post.images || [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

/* ------------------------------ public ------------------------------ */

const publicCity = (city) => ({
  id: city.slug,
  ...bilingual(city.nameEn, city.nameNe),
  province: city.province,
});

/** Needs `centre.city` included, for the city's slug. */
const publicCentre = (centre) => ({
  id: centre.slug,
  city: centre.city.slug,
  name: bilingual(centre.nameEn, centre.nameNe),
  address: bilingual(centre.addressEn, centre.addressNe),
  phone: centre.phone,
  type: centre.type,
});

/* ------------------------------ admin ------------------------------- */

const adminCity = (city, centreCount = 0) => ({
  id: city.id,
  slug: city.slug,
  name_en: city.nameEn,
  name_ne: city.nameNe || "",
  province: city.province,
  sort_order: city.sortOrder,
  is_active: Boolean(city.isActive),
  centre_count: centreCount,
  created_at: iso(city.createdAt),
  updated_at: iso(city.updatedAt),
});

const adminCentre = (centre) => ({
  id: centre.id,
  slug: centre.slug,
  city_id: centre.cityId,
  name_en: centre.nameEn,
  name_ne: centre.nameNe || "",
  address_en: centre.addressEn,
  address_ne: centre.addressNe || "",
  phone: centre.phone,
  type: centre.type,
  sort_order: centre.sortOrder,
  is_active: Boolean(centre.isActive),
  created_at: iso(centre.createdAt),
  updated_at: iso(centre.updatedAt),
});

const adminAppointment = (appointment) => ({
  id: appointment.id,
  name: appointment.name,
  phone: appointment.phone,
  age: appointment.age ?? null,
  preferred_date: appointment.preferredDate || null,
  at_home: Boolean(appointment.atHome),
  centre_id: appointment.centreId ?? null,
  centre_name: appointment.centreName || "",
  message: appointment.message || "",
  locale: appointment.locale || "en",
  status: appointment.status,
  admin_note: appointment.adminNote || "",
  created_at: iso(appointment.createdAt),
  updated_at: iso(appointment.updatedAt),
});

const adminNews = (post) => ({
  id: post.id,
  slug: post.slug,
  title_en: post.titleEn,
  title_ne: post.titleNe || "",
  summary_en: post.summaryEn || "",
  summary_ne: post.summaryNe || "",
  body_en: post.bodyEn,
  body_ne: post.bodyNe || "",
  images: imagesOf(post).map((image) => ({ id: image.id, url: newsImageUrl(image) })),
  published_at: post.publishedAt,
  is_active: Boolean(post.isActive),
  created_at: iso(post.createdAt),
  updated_at: iso(post.updatedAt),
});

/* ------------------------------ news -------------------------------- */

/** A card on the /news list — everything but the body, and only the cover photo. */
const publicNewsSummary = (post) => {
  const [cover] = imagesOf(post);
  return {
    id: post.slug,
    title: bilingual(post.titleEn, post.titleNe),
    summary: bilingual(post.summaryEn, post.summaryNe),
    image: cover ? newsImageUrl(cover) : null,
    date: post.publishedAt,
  };
};

/** One post, body and every photo included. */
const publicNewsPost = (post) => ({
  ...publicNewsSummary(post),
  images: imagesOf(post).map(newsImageUrl),
  body: bilingual(post.bodyEn, post.bodyNe),
});

const serializeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  last_login_at: iso(user.lastLoginAt),
});

module.exports = {
  publicCity,
  publicCentre,
  publicNewsSummary,
  publicNewsPost,
  adminCity,
  adminCentre,
  adminAppointment,
  adminNews,
  newsImageUrl,
  serializeUser,
};
