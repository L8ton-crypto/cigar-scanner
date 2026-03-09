# CigarScanner Backlog

> **⚠️ IMPORTANT: These are ENHANCEMENTS to the existing app.**
> Do NOT rebuild or create new apps. All work happens inside this codebase (`cigar-scanner-app`).
> The app is live at: https://cigar-scanner-app.vercel.app
> Stack: Next.js 16 + Neon Postgres + Vercel + Claude Sonnet (scan API)

---

## 🔥 High Impact

### 1. More Retailers
**Priority:** P1 | **Effort:** Medium
Add more UK cigar retailers to increase price comparison coverage.
- **Targets:** House of Cigars, Rebellion Cigars, Top25Cigars, Sautter, Turmeaus
- **Approach:** Playwright scrapers (same pattern as existing CGars/GQ/Smoke King scripts)
- **Match** new products against existing `cs_products` by normalised name
- **Add** new products where no match exists
- **Files:** New scripts in `scripts/`, update `scripts/full-status.js`
- **DB:** Uses existing `cs_products` + `cs_prices` tables, no schema changes

### 2. Price Alerts
**Priority:** P1 | **Effort:** Large
Let users set price drop alerts on specific products.
- **No auth required** - email-only signup per alert
- **New DB table:** `cs_alerts (id, product_id, email, target_price, active, created_at)`
- **New API:** `POST /api/alerts` (create), `GET /api/alerts?email=` (manage)
- **Cron/scheduled job:** Check prices against alerts, send email via Resend/SendGrid
- **UI:** "Set price alert" button on product detail page (`/cigar/[id]`)
- **Files:** New `src/app/api/alerts/route.ts`, update `src/app/cigar/[id]/page.tsx`

### 3. Scan History
**Priority:** P1 | **Effort:** Small
Save previous scans so users can see their cigar journey.
- **No auth needed** - store in localStorage
- **Save:** timestamp, image thumbnail (compressed), identification result, matched products
- **UI:** "Recent Scans" section on homepage or a `/history` page
- **Files:** Update `src/components/ScanModal.tsx` to save results, new component for history
- **No DB changes** - purely client-side

### 4. Shareable Scan Results
**Priority:** P1 | **Effort:** Medium
Generate shareable links/cards when scanning a cigar.
- **New route:** `/scan/[id]` - server-rendered scan result page
- **New DB table:** `cs_scans (id, identification_json, matches_json, image_url, created_at)`
- **After scan:** Save result to DB, generate short URL
- **OG meta tags** on scan page for rich social previews
- **"Share" button** in scan results modal
- **Files:** New `src/app/scan/[id]/page.tsx`, update scan API and modal

### 5. SEO Brand Pages
**Priority:** P2 | **Effort:** Medium
Static brand landing pages for organic search traffic.
- **New route:** `/brand/[slug]` - SSR page showing all products from a brand
- **Meta tags:** "Buy [Brand] Cigars UK - Compare Prices from 4+ Retailers"
- **Structured data:** Product schema for Google rich results
- **Sitemap:** Auto-generated `/sitemap.xml` with all brands + products
- **Files:** New `src/app/brand/[slug]/page.tsx`, `src/app/sitemap.ts`
- **No DB changes** - queries existing data

---

## ⚡ Medium Impact

### 6. Favourites / Wishlist
**Priority:** P2 | **Effort:** Small
Heart button to save favourite cigars.
- **localStorage only** - no auth needed
- **Heart icon** on product cards and detail page
- **New page:** `/favourites` showing saved products
- **Files:** New context/hook for favourites, update `CigarGrid.tsx` and detail page

### 7. Sort Options
**Priority:** P2 | **Effort:** Small
Add sorting to the product grid.
- **Options:** Price (low/high), Name (A-Z/Z-A), Most retailers, Biggest savings
- **UI:** Dropdown next to "Found X cigars" text
- **API:** Add `sort` param to `/api/cigars`
- **Files:** Update `src/app/api/cigars/route.ts` and `src/app/page.tsx`

### 8. Best Deals Page
**Priority:** P2 | **Effort:** Small
Curated page showing biggest price differences across retailers.
- **New route:** `/deals`
- **Query:** Products where `(max_price - min_price) / min_price` is highest
- **Show:** "Save £X by buying from [cheapest retailer] instead of [most expensive]"
- **Files:** New `src/app/deals/page.tsx`
- **No DB changes** - query uses existing min_price/max_price

### 9. Price Per Unit Length
**Priority:** P3 | **Effort:** Medium
Normalise price by cigar length for true value comparison.
- **Requires:** Scraping/adding cigar dimensions (length, ring gauge) to `cs_products`
- **New columns:** `length_mm`, `ring_gauge` on `cs_products`
- **UI:** Show "£X per inch" alongside price
- **Source:** Could extract from CGars product descriptions

### 10. Retailer Trust Indicators
**Priority:** P3 | **Effort:** Small
Show Trustpilot scores and retailer info.
- **Static data** - manually add retailer ratings to a config/DB table
- **UI:** Small trust badge next to retailer name on product detail page
- **Files:** Update `src/app/cigar/[id]/page.tsx`

---

## 🛠️ Technical

### 11. Scheduled Price Refresh
**Priority:** P2 | **Effort:** Medium
Keep prices current with weekly re-scraping.
- **OpenClaw cron job** or Vercel cron
- **Run existing scrapers** on a schedule (weekly for each retailer)
- **Detect** price changes, product removals, new products
- **Log** refresh results to a `cs_scrape_log` table
- **Alert** if a retailer scrape fails completely

### 12. Price History
**Priority:** P3 | **Effort:** Medium
Track price changes over time.
- **New DB table:** `cs_price_history (id, product_id, retailer, price, scraped_at)`
- **On each scrape:** Record current price to history table
- **UI:** Sparkline or chart on product detail page showing price trend
- **"Price dropped!" badges** on products with recent decreases

### 13. Stale Product Detection
**Priority:** P3 | **Effort:** Small
Auto-detect products that are no longer available.
- **Periodic check:** Visit product URLs, flag 404s
- **New column:** `last_verified` on `cs_prices`
- **UI:** Hide or de-emphasise products with all-stale prices
- **Reuse** the fix-and-purge pattern (Playwright + progress file)

---

## 🎯 Monetisation

### 14. Affiliate Links
**Priority:** P2 | **Effort:** Small
Add affiliate tracking to "Buy" links where retailers support it.
- **Research** which UK cigar retailers have affiliate programs
- **New column:** `affiliate_url` on `cs_prices` (or transform URL at render time)
- **Transparent:** Disclose affiliate relationship in footer

### 15. Sponsored Listings
**Priority:** P3 | **Effort:** Medium
Let retailers pay for featured/highlighted placement.
- **Highlighted product cards** with "Sponsored" badge
- **Top of search results** for sponsored products
- **Admin API** to manage sponsored products
- **Only implement when traffic justifies it**

### 16. Premium Scan Tier
**Priority:** P3 | **Effort:** Large
Rate-limit free scans, offer unlimited with account.
- **Free:** 5 scans per day (tracked by IP/fingerprint in localStorage)
- **Premium:** Unlimited scans, scan history sync, price alerts
- **Auth:** Simple email magic link (no passwords)
- **Payment:** Stripe for £2.99/month
- **Only implement when scan usage justifies it**

---

## Status Key
- **P1** = Do next
- **P2** = Do when P1s are done
- **P3** = Future / when traffic justifies
- ✅ = Done
- 🚧 = In progress
