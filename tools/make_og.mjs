// Render the social share card (og:image) via headless Chrome CDP — no deps.
// Usage: node tools/make_og.mjs <card.html> <out.png>
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9224;
const SRC = process.argv[2];
const OUT = process.argv[3] || "web/og.png";

const chrome = execFile(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/cdp-og-${Date.now()}`,
  "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await sleep(1500);
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) =>
    new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await send("Page.enable");
  await send("Page.navigate", { url: "file://" + SRC });
  await sleep(1200);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
  console.log("og image:", OUT);
  ws.close(); chrome.kill(); process.exit(0);
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
