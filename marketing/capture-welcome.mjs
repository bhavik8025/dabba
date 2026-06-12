// One-off: captures the logged-out Welcome (landing) and Auth screens.
// Requires .env.local with dummy VITE_SUPABASE_* values + dev server restarted.
import { chromium } from "playwright-core";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

await page.goto("http://localhost:5173");
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload();
await page.waitForSelector(".hero", { timeout: 15000 });
await page.waitForTimeout(500);

const body = await page.textContent("body");
if (!body.includes("Try the demo")) {
  console.error("Welcome screen NOT shown — got:", body.slice(0, 120));
  process.exit(1);
}
await page.screenshot({ path: path.join(here, "shots", "welcome.png") });
console.log("✓ welcome.png");

await page.click('button:has-text("Log in / Create account")');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(here, "shots", "auth.png") });
console.log("✓ auth.png");

await browser.close();
