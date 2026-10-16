const asyncHandler = require("express-async-handler");
const { Op } = require("sequelize");

const {
  City,
  Centre,
  PROVINCES,
  PROVINCE_IDS,
  CENTRE_TYPES,
  CENTRE_TYPE_IDS,
} = require("../models");
const { ApiError } = require("../utils/ApiError");
const { uniqueSlug } = require("../utils/slugify");
const { Validator, str, toBool, toInt } = require("../utils/validate");
const {
  publicCity,
  publicCentre,
  adminCity,
  adminCentre,
} = require("../utils/serialize");

const ACTIVE = { isActive: true };

/** Centres within a city: the editor's order, then alphabetical. */
const CENTRE_ORDER = [["sortOrder", "ASC"], ["nameEn", "ASC"]];

const provinceIndex = new Map(PROVINCE_IDS.map((id, index) => [id, index]));
const provinceName = (id) => PROVINCES.find((p) => p.id === id)?.en || id;

/** Cities east → west by province, then the editor's order, then alphabetical. */
const byProvinceThenOrder = (a, b) =>
  provinceIndex.get(a.province) - provinceIndex.get(b.province) ||
  a.sortOrder - b.sortOrder ||
  a.nameEn.localeCompare(b.nameEn);

/* ------------------------------------------------------------------ */
/* Public                                                             */
/* ------------------------------------------------------------------ */

/**
 * GET /api/locations
 *
 * Everything the website's finder, home-page teaser and booking form need, in
 * one request. Only visible centres in visible cities leave the server, and
 * only cities that have at least one of them — a city pill that opens onto an
 * empty list is worse than no pill.
 *
 * All seven provinces are always sent, so the finder can show the empty ones
 * as "no centre yet" instead of pretending they do not exist.
 */
const getLocations = asyncHandler(async (_req, res) => {
  const centres = await Centre.findAll({
    where: ACTIVE,
    include: [{ model: City, as: "city", where: ACTIVE, required: true }],
    order: CENTRE_ORDER,
  });

  const cities = [...new Map(centres.map((c) => [c.city.id, c.city])).values()];

  res.json({
    provinces: PROVINCES,
    types: CENTRE_TYPES,
    cities: cities.sort(byProvinceThenOrder).map(publicCity),
    centres: centres.map(publicCentre),
  });
});

/* ------------------------------------------------------------------ */
/* Admin                                                              */
/* ------------------------------------------------------------------ */

/** GET /api/admin/locations — every row, hidden ones included. */
const listLocations = asyncHandler(async (_req, res) => {
  const [cities, centres] = await Promise.all([
    City.findAll(),
    Centre.findAll({ order: CENTRE_ORDER }),
  ]);

  const counts = new Map();
  centres.forEach((c) => counts.set(c.cityId, (counts.get(c.cityId) || 0) + 1));

  res.json({
    provinces: PROVINCES,
    types: CENTRE_TYPES,
    cities: cities.sort(byProvinceThenOrder).map((c) => adminCity(c, counts.get(c.id) || 0)),
    centres: centres.map(adminCentre),
  });
});

/* ------------------------------ cities ------------------------------ */

const findCity = async (id) => {
  const city = await City.findByPk(id);
  if (!city) throw ApiError.notFound("That city no longer exists.");
  return city;
};

/**
 * Two "Kathmandu"s in Bagmati would split one city's centres across two
 * headings on the website. The column collation is case-insensitive, so
 * "kathmandu" is caught too.
 */
const assertCityNameFree = async (nameEn, province, ignoreId = null) => {
  const where = { nameEn, province };
  if (ignoreId) where.id = { [Op.ne]: ignoreId };

  const clash = await City.findOne({ where, attributes: ["nameEn"] });
  if (clash) {
    throw ApiError.conflict(`${clash.nameEn} is already listed in ${provinceName(province)} Province.`, {
      nameEn: "This city is already listed in that province.",
    });
  }
};

const validateCity = (body, has) => {
  const validator = new Validator(body);
  if (has("nameEn")) {
    validator.required("nameEn", "City name").maxLength("nameEn", 120, "City name");
  }
  if (has("nameNe")) validator.maxLength("nameNe", 120, "Nepali name");
  if (has("province")) {
    validator.required("province", "Province").oneOf("province", PROVINCE_IDS, "Province");
  }
  if (has("sortOrder")) validator.integer("sortOrder", "Sort order");
  validator.throwIfInvalid();
};

/** POST /api/admin/cities */
const createCity = asyncHandler(async (req, res) => {
  const body = req.body || {};
  /* Every field is checked on create; the optional ones pass when blank. */
  validateCity(body, () => true);

  const nameEn = str(body.nameEn);
  const province = str(body.province);
  await assertCityNameFree(nameEn, province);

  const city = await City.create({
    slug: await uniqueSlug(City, nameEn, "city"),
    nameEn,
    nameNe: str(body.nameNe),
    province,
    sortOrder: toInt(body.sortOrder),
    isActive: toBool(body.isActive, true),
  });

  res.status(201).json({ city: adminCity(city, 0) });
});

/**
 * PATCH /api/admin/cities/:id
 *
 * Partial by design: the list's visibility switch sends only { isActive },
 * while the editor sends the whole form.
 */
const updateCity = asyncHandler(async (req, res) => {
  const city = await findCity(req.params.id);
  const body = req.body || {};
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  validateCity(body, has);

  const nameEn = has("nameEn") ? str(body.nameEn) : city.nameEn;
  const province = has("province") ? str(body.province) : city.province;
  if (nameEn !== city.nameEn || province !== city.province) {
    await assertCityNameFree(nameEn, province, city.id);
  }

  city.nameEn = nameEn;
  city.province = province;
  if (has("nameNe")) city.nameNe = str(body.nameNe);
  if (has("sortOrder")) city.sortOrder = toInt(body.sortOrder);
  if (has("isActive")) city.isActive = toBool(body.isActive);
  await city.save();

  const count = await Centre.count({ where: { cityId: city.id } });
  res.json({ city: adminCity(city, count) });
});

/** DELETE /api/admin/cities/:id — refused while centres still point at it. */
const deleteCity = asyncHandler(async (req, res) => {
  const city = await findCity(req.params.id);

  const count = await Centre.count({ where: { cityId: city.id } });
  if (count > 0) {
    throw ApiError.conflict(
      `${city.nameEn} still has ${count} ${count === 1 ? "centre" : "centres"}. ` +
        "Move them to another city or delete them first."
    );
  }

  await city.destroy();
  res.json({ success: true });
});

/* ------------------------------ centres ----------------------------- */

const findCentre = async (id) => {
  const centre = await Centre.findByPk(id);
  if (!centre) throw ApiError.notFound("That centre no longer exists.");
  return centre;
};

/** Validates the fields present and returns the target city when cityId is one of them. */
const validateCentre = async (body, has) => {
  const validator = new Validator(body);
  if (has("cityId")) validator.required("cityId", "City").integer("cityId", "City");
  if (has("nameEn")) {
    validator.required("nameEn", "Centre name").maxLength("nameEn", 160, "Centre name");
  }
  if (has("nameNe")) validator.maxLength("nameNe", 160, "Nepali name");
  if (has("addressEn")) {
    validator.required("addressEn", "Address").maxLength("addressEn", 255, "Address");
  }
  if (has("addressNe")) validator.maxLength("addressNe", 255, "Nepali address");
  if (has("phone")) {
    validator.required("phone", "Phone number").maxLength("phone", 60, "Phone number").phone("phone");
  }
  if (has("type")) validator.oneOf("type", CENTRE_TYPE_IDS, "Centre type");
  if (has("sortOrder")) validator.integer("sortOrder", "Sort order");
  validator.throwIfInvalid();

  if (!has("cityId")) return null;

  const city = await City.findByPk(body.cityId);
  if (!city) validator.fail("cityId", "Choose a city from the list.").throwIfInvalid();
  return city;
};

/** POST /api/admin/centres */
const createCentre = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const city = await validateCentre(body, () => true);

  const nameEn = str(body.nameEn);

  const centre = await Centre.create({
    /* City first, so two cities' "Main branch" read apart in the URL. */
    slug: await uniqueSlug(Centre, `${city.slug} ${nameEn}`, "centre"),
    cityId: city.id,
    nameEn,
    nameNe: str(body.nameNe),
    addressEn: str(body.addressEn),
    addressNe: str(body.addressNe),
    phone: str(body.phone),
    type: str(body.type, "clinic"),
    sortOrder: toInt(body.sortOrder),
    isActive: toBool(body.isActive, true),
  });

  res.status(201).json({ centre: adminCentre(centre) });
});

/** PATCH /api/admin/centres/:id — partial, like updateCity. */
const updateCentre = asyncHandler(async (req, res) => {
  const centre = await findCentre(req.params.id);
  const body = req.body || {};
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  const city = await validateCentre(body, has);

  if (city) centre.cityId = city.id;
  if (has("nameEn")) centre.nameEn = str(body.nameEn);
  if (has("nameNe")) centre.nameNe = str(body.nameNe);
  if (has("addressEn")) centre.addressEn = str(body.addressEn);
  if (has("addressNe")) centre.addressNe = str(body.addressNe);
  if (has("phone")) centre.phone = str(body.phone);
  if (has("type")) centre.type = str(body.type, centre.type);
  if (has("sortOrder")) centre.sortOrder = toInt(body.sortOrder);
  if (has("isActive")) centre.isActive = toBool(body.isActive);
  await centre.save();

  res.json({ centre: adminCentre(centre) });
});

/** DELETE /api/admin/centres/:id */
const deleteCentre = asyncHandler(async (req, res) => {
  const centre = await findCentre(req.params.id);
  await centre.destroy();
  res.json({ success: true });
});

module.exports = {
  getLocations,
  listLocations,
  createCity,
  updateCity,
  deleteCity,
  createCentre,
  updateCentre,
  deleteCentre,
};
