const asyncHandler = require("express-async-handler");

const { User } = require("../models");
const { signToken } = require("../middleware/auth");
const { ApiError } = require("../utils/ApiError");
const { Validator, str } = require("../utils/validate");
const { serializeUser } = require("../utils/serialize");

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  new Validator(req.body)
    .required("email", "Email")
    .email("email")
    .required("password", "Password")
    .throwIfInvalid();

  const user = await User.scope("withPassword").findOne({
    where: { email: str(req.body.email).toLowerCase() },
  });

  /* One message for every failure, so the form cannot be used to find out
     which addresses have accounts. */
  const matches = user && user.isActive && (await user.comparePassword(req.body.password));
  if (!matches) throw ApiError.unauthorized("That email and password do not match.");

  user.lastLoginAt = new Date();
  await user.save({ fields: ["lastLoginAt"] });

  res.json({ token: signToken(user), user: serializeUser(user) });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

/** POST /api/auth/change-password */
const changePassword = asyncHandler(async (req, res) => {
  new Validator(req.body)
    .required("currentPassword", "Current password")
    .required("newPassword", "New password")
    .minLength("newPassword", 8, "New password")
    .throwIfInvalid();

  const user = await User.scope("withPassword").findByPk(req.user.id);

  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest("Please correct the highlighted fields.", {
      currentPassword: "That is not your current password.",
    });
  }

  user.password = String(req.body.newPassword);
  await user.save();

  res.json({ success: true });
});

module.exports = { login, me, changePassword };
