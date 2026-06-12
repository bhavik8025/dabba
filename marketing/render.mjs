// Renders carousel.html -> slides/slide-N.png (1080x1350) + dabba-carousel.pdf
// Run:  node marketing/render.mjs
import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlUrl = pathToFileURL(path.join(here, "carousel.html")).href;
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SLIDES = 9;

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });

for (let i = 1; i <= SLIDES; i++) {
  await page.goto(`${htmlUrl}?slide=${i}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(here, "slides", `slide-${i}.png`) });
  console.log(`✓ slide-${i}.png`);
}

// single PDF for LinkedIn document upload
await page.goto(htmlUrl);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(400);
await page.pdf({
  path: path.join(here, "dabba-carousel.pdf"),
  width: "1080px",
  height: "1350px",
  printBackground: true,
});
console.log("✓ dabba-carousel.pdf");

await browser.close();
