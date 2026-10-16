const asyncHandler = require("express-async-handler");
const { Op } = require("sequelize");

const { Appointment, Centre, City, APPOINTMENT_STATUSES, APPOINTMENT_STATUS_IDS } = require("../models");
const { ApiError } = require("../utils/ApiError");
const { Validator, str, toInt, nepalToday } = require("../utils/validate");
const { adminAppointment } = require("../utils/serialize");

/** The booking form's "at my home" choice; every other value is a centre slug. */
const HOME_VISIT = "home";

const LOCALES = ["en", "ne"];

/* ------------------------------------------------------------------ */
/* Public                                                             */
/* ------------------------------------------------------------------ */

/**
 * POST /api/appointments
 *
 * The website's booking form. Field names match the form's inputs, so the
 * per-field messages land under the right box.
 */
const createAppointment = asyncHandler(async (req, res) => {
  const body = req.body || {};

  /* Honeypot: a field people never see. Bots fill it in; pretend it worked
     and store nothing, so they have no reason to try another way. */
  if (str(body.website)) return res.status(201).json({ success: true });

  const validator = new Validator(body)
    .required("name", "Name")
    .maxLength("name", 120, "Name")
    .required("phone", "Phone number")
    .maxLength("phone", 60, "Phone number")
    .phone("phone")
    .integer("age", "Age", { min: 18, max: 110 })
    .date("preferredDate", "Preferred date")
    .required("centre", "Screening place")
    .maxLength("message", 2000, "Message");

  const preferredDate = str(body.preferredDate) || null;
  if (preferredDate && !validator.details.preferredDate && preferredDate < nepalToday()) {
    validator.fail("preferredDate", "Preferred date cannot be in the past.");
  }
  validator.throwIfInvalid();

  const choice = str(body.centre);
  const atHome = choice === HOME_VISIT;

  let centre = null;
  if (!atHome) {
    /* Only a centre the website is actually showing can be asked for. */
    centre = await Centre.findOne({
      where: { slug: choice, isActive: true },
      include: [{ model: City, as: "city", where: { isActive: true }, required: true }],
    });
    if (!centre) validator.fail("centre", "Choose a centre from the list.").throwIfInvalid();
  }

  const appointment = await Appointment.create({
    name: str(body.name),
    phone: str(body.phone),
    age: str(body.age) ? toInt(body.age) : null,
    preferredDate,
    atHome,
    centreId: centre ? centre.id : null,
    centreName: centre ? centre.nameEn : "",
    message: str(body.message) || null,
    locale: LOCALES.includes(body.locale) ? body.locale : "en",
  });

  res.status(201).json({ success: true, id: appointment.id });
});

/* ------------------------------------------------------------------ */
/* Admin                                                              */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 50;

/**
 * GET /api/admin/appointments?status=new&q=sita&page=1&pageSize=50
 *
 * Newest first. The counts ignore the status filter (but honour the search),
 * so the filter pills can show how many sit behind each one.
 */
const listAppointments = asyncHandler(async (req, res) => {
  const status = APPOINTMENT_STATUS_IDS.includes(req.query.status) ? req.query.status : null;
  const q = str(req.query.q).slice(0, 100);
  const pageSize = Math.min(Math.max(toInt(req.query.pageSize, PAGE_SIZE) || PAGE_SIZE, 1), 100);
  const page = Math.max(toInt(req.query.page, 1) || 1, 1);

  const search = q
    ? { [Op.or]: [{ name: { [Op.substring]: q } }, { phone: { [Op.substring]: q } }] }
    : {};
  const where = status ? { ...search, status } : search;

  const [{ rows, count }, grouped] = await Promise.all([
    Appointment.findAndCountAll({
      where,
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    Appointment.count({ where: search, group: ["status"] }),
  ]);

  const counts = Object.fromEntries(APPOINTMENT_STATUS_IDS.map((id) => [id, 0]));
  grouped.forEach((g) => {
    counts[g.status] = Number(g.count);
  });

  res.json({
    statuses: APPOINTMENT_STATUSES,
    appointments: rows.map(adminAppointment),
    counts: { all: Object.values(counts).reduce((a, b) => a + b, 0), ...counts },
    total: count,
    page,
    pageSize,
  });
});

const findAppointment = async (id) => {
  const appointment = await Appointment.findByPk(id);
  if (!appointment) throw ApiError.notFound("That appointment request no longer exists.");
  return appointment;
};

/** PATCH /api/admin/appointments/:id — status and the staff note; the request itself stays as sent. */
const updateAppointment = asyncHandler(async (req, res) => {
  const appointment = await findAppointment(req.params.id);
  const body = req.body || {};
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  const validator = new Validator(body);
  if (has("status")) validator.required("status", "Status").oneOf("status", APPOINTMENT_STATUS_IDS, "Status");
  if (has("adminNote")) validator.maxLength("adminNote", 2000, "Note");
  validator.throwIfInvalid();

  if (has("status")) appointment.status = str(body.status);
  if (has("adminNote")) appointment.adminNote = str(body.adminNote) || null;
  await appointment.save();

  res.json({ appointment: adminAppointment(appointment) });
});

/** DELETE /api/admin/appointments/:id */
const deleteAppointment = asyncHandler(async (req, res) => {
  const appointment = await findAppointment(req.params.id);
  await appointment.destroy();
  res.json({ success: true });
});

module.exports = { createAppointment, listAppointments, updateAppointment, deleteAppointment };
