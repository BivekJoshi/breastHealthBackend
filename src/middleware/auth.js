const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const { JWT } = require("../config/config");
const { User } = require("../models");
const { ApiError } = require("../utils/ApiError");

const signToken = (user) =>
  jwt.sign({ sub: String(user.id) }, JWT.SECRET, { expiresIn: JWT.EXPIRES_IN });

/**
 * Verifies the bearer token and reloads the user, so an account deactivated
 * after the token was issued loses access straight away rather than at expiry.
 */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) throw ApiError.unauthorized("Please sign in to continue.");

  let payload;
  try {
    payload = jwt.verify(token, JWT.SECRET);
  } catch {
    throw ApiError.unauthorized();
  }

  const user = await User.findByPk(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized();

  req.user = user;
  next();
});

module.exports = { signToken, requireAuth };
