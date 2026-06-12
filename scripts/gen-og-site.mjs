// Renders public/og.png (1200x630) — the social-share card for the app link.
import { chromium } from "playwright-core";
import { readFileSync } from "fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const svg = readFileSync("public/icon.svg", "utf8").replace("<svg", '<svg width="150" height="150"');

const html = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; font-family: "Segoe UI", system-ui, sans-serif;
         background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 55%, #fed7aa 100%);
         display: flex; align-items: center; overflow: hidden; position: relative; }
  .blob { position: absolute; border-radius: 50%; background: rgba(232,89,12,.08); }
  .b1 { width: 560px; height: 560px; right: -160px; top: -220px; }
  .b2 { width: 380px; height: 380px; right: 120px; bottom: -240px; background: rgba(232,89,12,.06); }
  .wrap { display: flex; align-items: center; gap: 64px; padding: 0 96px; position: relative; }
  .icon { filter: drop-shadow(0 24px 48px rgba(232,89,12,.35)); }
  h1 { font-size: 110px; font-weight: 800; color: #1c1917; letter-spacing: -3px; line-height: 1; }
  h1 span { color: #e8590c; }
  .sub { font-size: 40px; font-weight: 700; color: #e8590c; margin-top: 10px; }
  .tag { font-size: 30px; color: #57534e; margin-top: 26px; line-height: 1.45; max-width: 720px; }
  .url { display: inline-block; margin-top: 34px; background: #e8590c; color: #fff;
         font-size: 28px; font-weight: 700; padding: 14px 30px; border-radius: 16px;
         box-shadow: 0 12px 28px rgba(232,89,12,.3); }
</style></head><body>
  <div class="blob b1"></div><div class="blob b2"></div>
  <div class="wrap">
    <div class="icon">${svg}</div>
    <div>
      <h1>Dabba<span>.</span></h1>
      <div class="sub">The Tiffin Tracker</div>
      <div class="tag">Free tiffin cost splitter for PG &amp; flat groups.<br/>Exact splits. Signed records. Zero fights.</div>
      <div class="url">dabba-tiffin.vercel.app</div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: "website/assets/og.png" });
await browser.close();
console.log("✓ public/og.png 1200x630");
