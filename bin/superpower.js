#!/usr/bin/env node
// superpower CLI shim — suppresses node:sqlite experimental warnings so the
// stdio MCP transport stays clean.
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name !== "ExperimentalWarning") console.error(w);
});
import("../dist/index.js");
