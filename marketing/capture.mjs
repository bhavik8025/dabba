// Captures real app screenshots for the marketing carousel.
// Run:  node marketing/capture.mjs   (dev server must be on http://localhost:5173)
import { chromium } from "playwright-core";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = (n) => path.join(here, "shots", n);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL = "http://localhost:5173";

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});

const pause = (ms = 350) => page.waitForTimeout(ms);
const snap = async (name) => {
  await pause();
  // the demo banner is honest in-app, but visual noise on marketing slides
  await page.evaluate(() => document.querySelector(".demo-banner")?.remove());
  await page.screenshot({ path: shots(name) });
  console.log("✓", name);
};
const tab = async (label) => {
  await page.click(`.tabbar button:has-text("${label}")`);
  await pause();
};

// fresh demo seed
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("tiffin-demo", "1");
});
await page.reload();
await page.waitForSelector(".tabbar", { timeout: 15000 });
await pause(600);

// ---- Add tab: stage a realistic half-filled day ----
const individualCard = page.locator(".card", { hasText: "Individual" });
await individualCard.locator("select").selectOption({ label: "Bhavik (me)" });
await pause(150);
await individualCard.locator("select").selectOption({ label: "Raj" });
await pause(150);
// Raj +1 roti (second stepper in his row)
await page
  .locator(".member-row", { hasText: "Raj" })
  .locator(".stepper").nth(1).locator("button").nth(1).click();
// shared: 2 tiffins shared by Bhavik, Raj, Amit
await page.click('[aria-label="toggle shared for Bhavik"]');
await page.click('[aria-label="toggle shared for Raj"]');
await page.click('[aria-label="toggle shared for Amit"]');
// shared stepper moves in ½ steps — 4 clicks = 2 tiffins
const sharedPlus = page.locator(".shared-controls .stepper").first().locator("button").nth(1);
for (let i = 0; i < 4; i++) {
  await sharedPlus.click();
  await pause(120);
}
await page.evaluate(() => window.scrollTo(0, 0));
await snap("add-top.png");
// scroll to shared + live amount preview
await page.locator(".card", { hasText: "Amount preview" }).scrollIntoViewIfNeeded();
await snap("add-shared.png");

// ---- History ----
await tab("History");
await page.evaluate(() => window.scrollTo(0, 0));
await snap("history.png");
await page.locator(".entry-card.tombstone").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -120));
await snap("tombstone.png");

// ---- Balances ----
await tab("Balances");
await page.evaluate(() => window.scrollTo(0, 0));
await snap("balances.png");
// ledger for Amit
await page.locator(".bal-row.clickable", { hasText: "Amit" }).first().click();
await pause(250);
await page.evaluate(() => window.scrollTo(0, 0));
await snap("ledger.png");
// audit, all time
await page.locator(".range-chips button", { hasText: "All time" }).click();
await page.locator("pre.audit").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await snap("audit.png");

// ---- Settings ----
await tab("Settings");
await page.evaluate(() => window.scrollTo(0, 0));
await snap("settings.png");
await page
  .locator(".section-title", { hasText: "Install on your phone" })
  .evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => window.scrollBy(0, -24));
await snap("install.png");

await browser.close();
console.log("All shots captured.");
