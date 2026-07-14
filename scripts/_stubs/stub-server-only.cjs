// Preload (NODE_OPTIONS=--require) that lets tsx test scripts import server modules
// which pull in `server-only`/`client-only` — packages the Next bundler provides but
// that aren't installed in node_modules. Maps those specifiers to an empty stub.
const Module = require("module");
const path = require("path");

const stub = path.join(__dirname, "server-only.cjs");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only" || request === "client-only") return stub;
  return original.call(this, request, ...rest);
};
