#!/usr/bin/env node
// Cross-platform "open URL in default browser" helper used by all launch
// configurations in .vscode/launch.json. Replaces the Windows-only
// powershell.exe + Start-Process pattern so the same launch.json works
// on Windows, BAS (Linux), and macOS.
//
// Usage:  node scripts/open-url.js <URL>
//
// On BAS the default browser command is `xdg-open`, which BAS wires to
// open URLs in the host browser (or in the BAS Simple Browser tab).
const { spawn } = require("child_process");
const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/open-url.js <URL>");
  process.exit(2);
}
const cmd =
  process.platform === "win32"
    ? "cmd"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
const args =
  process.platform === "win32" ? ["/c", "start", "", url] : [url];
const child = spawn(cmd, args, { stdio: "inherit", detached: true });
child.on("error", (err) => {
  console.error(`Failed to launch ${cmd}: ${err.message}`);
  process.exit(1);
});
child.unref();
