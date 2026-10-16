const { SEED_ADMIN } = require("../config/config");
const { User } = require("../models");

/**
 * Creates the admin account on boot when it does not exist yet.
 *
 * The password is never touched on an existing user, so a password changed in
 * the admin survives every restart and redeploy — which is the whole point of
 * shipping a default credential that the operator is expected to replace.
 */
const createDefaultAdminUser = async () => {
  const email = SEED_ADMIN.EMAIL;
  const existing = await User.findOne({ where: { email } });

  if (existing) {
    console.log(`Admin already present: ${email}`.grey);
    return existing;
  }

  const admin = await User.create({
    name: SEED_ADMIN.NAME,
    email,
    password: SEED_ADMIN.PASSWORD,
  });

  console.log(
    `Seeded admin ${email} — sign in and change this password.`.green.bold
  );

  return admin;
};

module.exports = { createDefaultAdminUser };
