/**
 * cPanel / Phusion Passenger entry point.
 *
 * In "Setup Node.js App" set:
 *   Application root           BreastScanBackend
 *   Application startup file   app.js
 *
 * Passenger `require()`s this file, which is why the whole backend is
 * CommonJS rather than ESM — Passenger cannot require() an ES module, and a
 * "type": "module" package.json would break the boot with ERR_REQUIRE_ESM.
 */

require("./src/server");
