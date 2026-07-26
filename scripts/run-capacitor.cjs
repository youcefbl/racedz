/* eslint-disable @typescript-eslint/no-require-imports */

// Capacitor 6 expects the CommonJS default export exposed by tar 6.
// The security-patched tar 7 package exposes the same API without `default`.
const tar = require("tar");

if (!tar.default) {
  tar.default = tar;
}

process.argv = [process.argv[0], "cap", ...process.argv.slice(2)];
require("@capacitor/cli/dist/index.js").run();
