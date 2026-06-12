// One-off: render-check the website locally (desktop + mobile) before deploy.
import { chromium } from "playwright-core";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const b = await chromium.launch({ executablePath: EDGE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto("http://localhost:8799/");
await p.waitForTimeout(1200);
await p.screenshot({ path: "website-check-top.png" });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
await p.waitForTimeout(800);
await p.screenshot({ path: "website-check-mid.png" });
const mob = await b.newPage({ viewport: { width: 390, height: 844 } });
await mob.goto("http://localhost:8799/");
await mob.waitForTimeout(1000);
await mob.screenshot({ path: "website-check-mobile.png" });
console.log("console errors:", errs.length ? errs.join(" | ") : "none");
await b.close();
