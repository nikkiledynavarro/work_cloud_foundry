#!/usr/bin/env node
// Cross-platform "open URL in default browser" helper used by all launch
// configurations in .vscode/launch.json. Works on Windows, macOS, Linux
// (with xdg-open), and BAS (no xdg-open — falls back to printing a
// clickable URL, since Theia's terminal auto-links it).
//
// Usage:  node scripts/open-url.js <URL>
const { spawn, spawnSync } = require("child_process");
const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/open-url.js <URL>");
  process.exit(2);
}
function tryOpen(cmd, args) {
  // Avoid the spawn-error event by checking the binary is on PATH first.
  // `which` works on Linux/macOS; on Windows we always fall through to cmd.
  if (process.platform !== "win32") {
    const probe = spawnSync("which", [cmd], { stdio: "ignore" });
    if (probe.status !== 0) return false;
  }
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
  return true;
}
let opened = false;
if (process.platform === "win32") {
  opened = tryOpen("cmd", ["/c", "start", "", url]);
} else if (process.platform === "darwin") {
  opened = tryOpen("open", [url]);
} else {
  for (const cmd of ["xdg-open", "gnome-open", "gio"]) {
    const args = cmd === "gio" ? ["open", url] : [url];
    if (tryOpen(cmd, args)) { opened = true; break; }
  }
}
if (!opened) {
  // BAS / headless Linux without a desktop URL handler. Print the URL so
  // the user can ctrl+click it from the terminal (Theia / VS Code auto-link).
  console.log(`Open this URL in your browser:\n  ${url}`);
}
