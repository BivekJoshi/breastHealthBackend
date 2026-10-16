const { Router } = require("express");

const { getLocations } = require("../controllers/location.controller");
const { createAppointment } = require("../controllers/appointment.controller");
const { getNews, getNewsPost, getNewsImage } = require("../controllers/news.controller");
const { rateLimit } = require("../middleware/rateLimit");

const router = Router();

/* Provinces, cities and screening centres — everything the website lists. */
router.get("/locations", getLocations);

/* The booking form. A real visitor sends one or two; ten an hour is plenty. */
router.post(
  "/appointments",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many requests from this connection. Please call us instead, or try again later.",
  }),
  createAppointment
);

/* Published news posts, and their photos. */
router.get("/news", getNews);
router.get("/news/images/:key", getNewsImage);
router.get("/news/:slug", getNewsPost);

module.exports = router;
