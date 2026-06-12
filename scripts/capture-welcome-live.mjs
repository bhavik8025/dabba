// Recaptures the welcome screenshot from the LIVE site (post-rebrand).
import { chromium } from "playwright-core";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const b = await chromium.launch({ executablePath: EDGE, headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await p.goto("https://getdabba.vercel.app", { waitUntil: "networkidle" });
await p.waitForSelector(".hero", { timeout: 20000 });
await p.waitForTimeout(600);
const t = await p.textContent("body");
if (!t.includes("Dabba")) {
  console.error("FAIL: 'Dabba' not on live page:", t.slice(0, 120));
  process.exit(1);
}
await p.screenshot({ path: "marketing/shots/welcome.png" });
console.log("welcome.png recaptured from LIVE site — shows Dabba");
await b.close();
