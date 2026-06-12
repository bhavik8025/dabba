// Rasterize public/icon.svg to the PNGs Android (manifest) and iOS
// (apple-touch-icon) actually use on the home screen.
import { chromium } from "playwright-core";
import { readFileSync } from "fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const svg = readFileSync("public/icon.svg", "utf8").replace(
  "<svg",
  '<svg preserveAspectRatio="xMidYMid meet"'
);

const out = [
  { name: "icon-192.png", w: 192 }, // Android manifest (primary)
  { name: "icon-512.png", w: 512 }, // Android manifest (large + maskable)
  { name: "apple-touch-icon.png", w: 180 }, // iOS home screen
];

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
for (const { name, w } of out) {
  const page = await browser.newPage({ viewport: { width: w, height: w } });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">
       <div style="width:${w}px;height:${w}px">${svg.replace(
      "<svg",
      `<svg width="${w}" height="${w}"`
    )}</div>
     </body></html>`
  );
  await page.screenshot({ path: `public/${name}`, omitBackground: false });
  await page.close();
  console.log("✓", name, w + "x" + w);
}
await browser.close();
