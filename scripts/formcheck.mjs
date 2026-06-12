// One-off: live test of the website lead form (writes one test row to leads).
import { chromium } from "playwright-core";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const b = await chromium.launch({ executablePath: EDGE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto("https://dabba-tiffin.vercel.app/", { waitUntil: "networkidle" });
await p.fill('#lead-form input[name="name"]', "Site Test");
await p.fill('#lead-form input[name="contact"]', "site-test@example.com");
await p.fill('#lead-form textarea[name="message"]', "Automated launch verification — ignore");
await p.click('#lead-form button[type="submit"]');
await p.waitForTimeout(2500);
const msg = await p.textContent("#lead-form .form-msg");
console.log(msg && msg.includes("thank you") ? "PASS  lead form submits to Supabase from production" : "FAIL  form said: " + msg);
await p.screenshot({ path: "website-live.png", clip: { x: 0, y: 0, width: 1280, height: 760 } });
await b.close();
