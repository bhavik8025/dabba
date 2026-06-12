# Project state — 12 Jun 2026

Single source of truth for continuing this project in any tool or session.

## What is live right now

| Thing | Status |
|---|---|
| **App** | ✅ LIVE at https://getdabba.vercel.app (PWA, installable) |
| Brand | **Dabba: The Tiffin Tracker** (short name "Dabba") — renamed from "Tiffin Tracker" same day as launch |
| Extra URLs (same app) | dabba-tiffin.vercel.app (reserved for future marketing site), tiffin-tracker-app.vercel.app + tiffin-tracker-zeta.vercel.app (legacy, keep working) |
| Database | Supabase free tier, Mumbai — schema + hardening + analytics tables applied, **0 real users yet** |
| GitHub | ✅ https://github.com/bhavik8025/dabba (public, MIT, sanitized — no secrets) |
| Marketing | ✅ `marketing/dabba-carousel.pdf` (9 slides, clickable link, Dabba-branded) + `marketing/linkedin-post.md` (3 post versions + first comment + playbook). **Not posted yet.** |
| Cost | ₹0/month everywhere. No card on file anywhere. Vercel Web Analytics was briefly enabled (free Hobby tier) and then **disabled on request** — never any payment. |

## Security/auth facts (do not break these)

- Login = phone + 6-digit PIN → synthetic email `p<10digits>@tiffin-tracker.app`
  (NEVER rename this domain — it's the account identity).
- Supabase "Confirm email" = OFF (required for the synthetic emails).
- Attribution stamped by Postgres triggers; entries/settlements have **no
  DELETE policy** (tombstones only); profiles visible via `profile_visible()`.
- `leads` / `feedback` / `events` tables: INSERT-only via API (forms +
  PWA-install counter write; read in dashboard Table Editor only).

## Website — ✅ LIVE at https://dabba-tiffin.vercel.app (12 Jun 2026)

- Separate Vercel project **`dabba-website`** (static, `website/` folder of
  this repo; its own `.vercel/` link inside that folder). The
  `dabba-tiffin.vercel.app` domain was MOVED from the app project to it.
- Landing page: CSS-3D dabba hero, problem (Hinglish chat), 6 features, real
  screenshot gallery, how-it-works, dark trust section, 8-question FAQ
  (FAQPage JSON-LD), about, **working lead + feedback forms → Supabase**
  (verified live; one test row "Site Test" sits in `leads`), final CTA, blog
  (`/blog/` + first post with BlogPosting schema), 404 page.
- SEO: robots.txt, sitemap.xml, canonicals, OG/Twitter cards (assets/og.png),
  WebSite + SoftwareApplication + FAQPage + BlogPosting structured data,
  system fonts only, lazy images — fast by construction.
- **IndexNow key `52854a789c6a229f8031880b15579006`** (file at site root);
  all 3 URLs pinged to api.indexnow.org → HTTP 202 (Bing/Yandex notified).
- Anonymous pageview counter → `events` table (`site_pageview`, one per
  session, no cookies/third parties).
- Re-render checks: `node scripts/sitecheck.mjs` (needs `npx serve website -l 8799`),
  `node scripts/formcheck.mjs` (live form test).

## Pending work

1. **LinkedIn launch** — user posts `marketing/dabba-carousel.pdf` + a post
   from `marketing/linkedin-post.md` + the first comment with the link.
2. **Google Search Console + Bing Webmaster** — needs USER's Google/Microsoft
   logins: add property `dabba-tiffin.vercel.app`, verify (HTML tag method —
   paste tag into website/index.html head + redeploy, or DNS), submit
   sitemap.xml. Bing: "Import from Google Search Console" is fastest.
3. Optional, all free, only with user's explicit OK: re-enable Vercel Web
   Analytics (Hobby tier); saved usage-dashboard SQL query; Microsoft Clarity.

## Machine state (this laptop)

- Repo: `C:\Users\admin\tiffin-tracker` — git on `main`, origin = GitHub above.
- `gh` CLI authenticated as **bhavik8025** (keyring).
- `.env` has the real Supabase URL + publishable key (gitignored; also in
  Vercel project env vars).
- Vercel deploy token `tiffin-tracker-deploy` **expires 13 Jun 2026** — after
  that, deploys need a one-time `npx vercel login`. Deploy command:
  `npm run build` then `npx vercel deploy --prod`.
- Regenerate marketing assets: `node marketing/capture.mjs` (app screenshots
  from local dev), `node scripts/capture-welcome-live.mjs` (welcome shot from
  prod), `node marketing/render.mjs` (slides + PDF), `node scripts/gen-icons.mjs`
  + `node scripts/gen-og.mjs` (icons / OG card).

## Decisions the user has made (don't re-litigate)

- ₹0 only — no paid anything, ever, without explicit confirmation first.
- Play Store: dropped.
- Hyper-niche positioning: PG/flat students sharing daily tiffin (contrast
  with user's previous mass-market project, BEBO).
- Old tiffin-tracker URLs stay alive as aliases.
- Comment keyword for the LinkedIn funnel: **"dabba"**.
