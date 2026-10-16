const { ApiError } = require("../utils/ApiError");
const { ENVIRONMENT } = require("../config/config");

const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist.`));
};

/** Maps a Sequelize field name back to the key the form actually posted. */
const fieldOf = (error) => error.path || "value";

/* eslint-disable no-unused-vars */
const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || "Something went wrong. Please try again.";
  let details = err.details;

  /* Translate Sequelize failures into the same { error, details } contract. */
  if (err.name === "SequelizeValidationError" && err.errors) {
    status = 400;
    message = "Please correct the highlighted fields.";
    details = Object.fromEntries(err.errors.map((error) => [fieldOf(error), error.message]));
  } else if (err.name === "SequelizeUniqueConstraintError") {
    status = 409;
    const first = err.errors?.[0];
    const field = first ? fieldOf(first) : "value";
    message = `That ${field} is already in use.`;
    details = { [field]: `This ${field} is already taken.` };
  } else if (err.name === "SequelizeForeignKeyConstraintError") {
    status = 409;
    message = "That record is still linked to something else.";
  } else if (err.name === "SequelizeDatabaseError") {
    status = 400;
    message = "That request could not be processed.";
    /* Logged, but not sent to the client — the text carries table and column
       names. An unknown column here means the models moved ahead of the
       database, and without this line that failure would be silent. */
    console.error(`Database error ❌ ${err.parent?.sqlMessage || err.message}`);
    if (err.sql) console.error(`  while running: ${err.sql}`);
  } else if (err.type === "entity.parse.failed") {
    /* express.json() on a malformed body. */
    status = 400;
    message = "The request body is not valid JSON.";
  } else if (err.type === "entity.too.large") {
    /* A body over the parser's limit: an oversize photo, or a very long post. */
    status = 413;
    message = "That is too large to upload. Images can be up to 5 MB.";
  }

  if (status >= 500) {
    console.error("Unhandled error ❌".red.bold, err);
    if (ENVIRONMENT === "prod") message = "Something went wrong. Please try again.";
  }

  const payload = { error: message };
  if (details && Object.keys(details).length > 0) payload.details = details;

  res.status(status).json(payload);
};

module.exports = { notFoundHandler, errorHandler };
