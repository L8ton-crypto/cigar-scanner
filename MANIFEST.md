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

## New Features Added (2026-04-05)

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
- **cs_scrape_log** - Refresh logging (NEW: prices_added, new_products columns)
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
- Added automatic new product detection from scrapers
- Enhanced refresh system with fuzzy matching and safety limits  
- Built comprehensive data health monitoring dashboard
- Improved price change tracking with detailed statistics
- Added navigation link for data health monitoring