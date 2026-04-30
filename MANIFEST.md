# CigarScanner App Manifest

**Live URL:** https://cigar-scanner-app.vercel.app  
**GitHub:** L8ton-crypto/cigar-scanner  
**Stack:** Next.js 16 + React + TypeScript + Tailwind + Neon PostgreSQL  

## Pages & Features

### Core Pages
- **/** - Homepage with scan, search, and recent scans
- **/brands** - Browse cigars by brand
- **/deals** - Current deals and offers
- **/favourites** - User favourites (localStorage)
- **/alerts** - Price alerts management
- **/history** - Scan history
- **/price-changes** - Price changes tracking with filters
- **/refresh** - Data health dashboard (NEW)

### Dynamic Pages
- **/brand/[slug]** - Brand-specific cigar listings (237+ brands)
- **/cigar/[id]** - Individual cigar details with price comparison
- **/scan/[id]** - Scan result details

### API Routes
- **/api/cigars** - Product search with filters
- **/api/brands** - Brand listings
- **/api/scan** - Cigar identification
- **/api/price-changes** - Price change tracking
- **/api/refresh** - Scheduled price refresh (cron auth)
- **/api/refresh-status** - Retailer status monitoring
- **/api/alerts** - Price alerts management

## New Features Added (2026-04-08)

### Price History & Trends
1. **Price Snapshots** - Automatic recording of price history during refresh cycles
2. **90-Day Tracking** - Historical price data stored for trend analysis
3. **Sparkline Charts** - Visual price trend indicators on product detail pages
4. **Price Drop Badges** - Green "Price Drop" badges on products with recent decreases (7 days)
5. **Trend Analysis** - Percentage change indicators with up/down arrows

### Enhanced User Experience
- **Price History Section** - New section on cigar detail pages showing retailer price trends
- **Visual Indicators** - Sparkline charts for quick trend identification
- **Recent Drop Detection** - Automatic flagging of products with recent price reductions
- **Mobile Responsive** - Clean sparklines optimized for mobile viewing

## Previous Features (2026-04-05)

### Enhanced Refresh System
1. **New Product Detection** - Automatically detects and adds new cigars from scrapes
2. **Fuzzy Matching** - Handles name variations and normalisation differences  
3. **Safety Limits** - Max 50 new products per retailer to prevent matching errors
4. **Enhanced Stats** - Tracks new products and added prices in scrape logs

### Data Health Dashboard (/refresh)
- **Freshness Indicator** - Visual status of last data refresh
- **Retailer Status Cards** - Per-retailer health with run times, success/error counts
- **Price Changes Summary** - 7-day overview of price movements
- **Error Monitoring** - Real-time error tracking from scrapers

### Updated APIs
- **refresh-status** - Enhanced with new product counts and error details
- **price-changes** - Added summary mode for dashboard statistics

## Database Schema

### Core Tables
- **cs_products** - Product catalog (name, brand, prices, retailer_count)
- **cs_prices** - Price data per retailer (price, url, last_verified)
- **cs_price_history** - Price snapshots over time (NEW: 90-day historical tracking)
- **cs_scrape_log** - Refresh logging (prices_added, new_products columns)
- **cs_price_changes** - Price change tracking (price_change, new_product types)

### Scraping & Alerts
- **cs_scans** - Scan identification results
- **cs_alerts** - User price alerts

## Data Sources

### Retailers (6 scrapers)
- GQ Tobaccos
- House of Cigars  
- Sautter
- Rebellion
- Turmeaus
- Smoke King

### Refresh Schedule
- **Weekly:** Monday mornings, staggered per retailer
- **Manual:** /api/refresh with CRON_SECRET auth
- **Monitoring:** /refresh dashboard for health tracking

## Theme
- **Dark mode** - Deep greens (#0a1a10, #1a3a2a) 
- **Gold accents** - #c9a84c for highlights
- **Green text** - #8aaa7a for secondary content
- **Mobile-first** - Responsive design throughout

## Recent Enhancements
- **Price History Tracking** - Automatic snapshots during refresh cycles with 90-day retention
- **Visual Trend Analysis** - SVG sparkline charts showing price movements over time
- **Price Drop Detection** - Real-time flagging of products with recent price decreases
- **Enhanced Product Grid** - Visual badges for recently reduced products
- **Improved Detail Pages** - Comprehensive price history section with trend indicators
- Automatic new product detection from scrapers
- Enhanced refresh system with fuzzy matching and safety limits  
- Built comprehensive data health monitoring dashboard
- Improved price change tracking with detailed statistics


## Sponsored Listings (task-52, 2026-04-30)

Manually managed monetisation hook. The feature is invisible until an admin
inserts a row into `cs_sponsored` - intentional, so we never ship fake seed
data and the UI stays unchanged for real users until a real sponsor exists.

### Activation

1. Confirm `CRON_SECRET` is set on Vercel (it is, used by other admin routes).
2. Visit `/admin/sponsored` in a browser, paste the CRON_SECRET, add a row.
3. Or hit the API directly:

```
curl -X POST https://cigar-scanner-app.vercel.app/api/admin/sponsored \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 123, "sponsor_name": "Brand Co", "weight": 10}'
```

### Schema

`cs_sponsored` (id, product_id, sponsor_name, notes, weight, active, start_at,
end_at, created_at, updated_at). A row is "live" when active=true and within
its start/end window. Index on (active, end_at) keeps the per-request lookup
cheap.

### Surfaces

- Product card on the home grid: gold ribbon over the bottom of the image,
  optional sponsor name on the right, subtle gold ring around the card.
- Cigar detail page: gold pill below the brand line.

### API

- `GET    /api/admin/sponsored`              list rows (joined with product name)
- `POST   /api/admin/sponsored`              create
- `PATCH  /api/admin/sponsored/[id]`         update (active toggle, dates, etc.)
- `DELETE /api/admin/sponsored/[id]`         hard delete

All four require `Authorization: Bearer <CRON_SECRET>` or `?key=<CRON_SECRET>`.
