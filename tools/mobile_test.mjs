// Real mobile-viewport test via Chrome DevTools Protocol (device emulation).
// Node 22 has a global WebSocket — no deps needed.
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9223;
const URL_TO_TEST = process.argv[2] || "http://127.0.0.1:8000/?demo=1";
const SHOT = process.argv[3] || "/tmp/mobile_real.png";

const chrome = execFile(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/cdp-prof-${Date.now()}`,
  "about:blank",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await sleep(1500);
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.enable");
  await send("Page.navigate", { url: URL_TO_TEST });
  await sleep(6000); // let the demo flow finish

  const probe = await send("Runtime.evaluate", { returnByValue: true, expression: `
    (() => {
      const doc = document.documentElement.scrollWidth, vw = innerWidth;
      let worst = null, max = 0;
      document.querySelectorAll('body *').forEach(el => {
        if (el.offsetParent === null) return;
        const w = el.scrollWidth;
        if (w > max) { max = w; worst = el; }
      });
      const path = []; let e = worst;
      while (e && e.tagName !== 'BODY') { path.unshift(e.tagName + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '')); e = e.parentElement; }
      return { doc, vw, max, path: path.join(' > ') };
    })()
  `});
  console.log("PROBE:", JSON.stringify(probe.result?.result?.value));

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(SHOT, Buffer.from(shot.result.data, "base64"));
  console.log("screenshot:", SHOT);

  ws.close(); chrome.kill();
  process.exit(0);
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
