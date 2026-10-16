const express = require("express");

const { Router } = express;

const { requireAuth } = require("../middleware/auth");
const {
  listLocations,
  createCity,
  updateCity,
  deleteCity,
  createCentre,
  updateCentre,
  deleteCentre,
} = require("../controllers/location.controller");
const {
  listAppointments,
  updateAppointment,
  deleteAppointment,
} = require("../controllers/appointment.controller");
const {
  listNews,
  uploadNewsImage,
  createNews,
  updateNews,
  deleteNews,
  MAX_IMAGE_BYTES,
} = require("../controllers/news.controller");

const router = Router();

/* Everything below needs a valid session. */
router.use(requireAuth);

/* Both collections in one go — the admin screen shows them side by side. */
router.get("/locations", listLocations);

/* Cities */
router.post("/cities", createCity);
router.patch("/cities/:id", updateCity);
router.delete("/cities/:id", deleteCity);

/* Centres */
router.post("/centres", createCentre);
router.patch("/centres/:id", updateCentre);
router.delete("/centres/:id", deleteCentre);

/* Appointment requests — created by the website's booking form, not here. */
router.get("/appointments", listAppointments);
router.patch("/appointments/:id", updateAppointment);
router.delete("/appointments/:id", deleteAppointment);

/* News. A photo is uploaded on its own, as the raw file — any Content-Type is
   read as bytes, and the controller decides from them what the file really is.
   The parser's limit sits a little above the controller's so an oversize
   image gets the controller's clearer message. */
router.get("/news", listNews);
router.post(
  "/news/images",
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES + 512 * 1024 }),
  uploadNewsImage
);
router.post("/news", createNews);
router.patch("/news/:id", updateNews);
router.delete("/news/:id", deleteNews);

module.exports = router;
