# Kinolar Ilovasi - Movie Catalog Application

## Overview
A public movie catalog PWA app named "Kinolar Ilovasi" with a looping galaxy/space video background. Uses custom K-logo (red play button on black film strip). Admin (ID: 1123019731) can add/edit/delete movies from the web app and Telegram bot. All visitors can browse and rate movies without login.

## Architecture
- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui + Framer Motion
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL (Drizzle ORM)
- **Auth:** Admin-only (hardcoded admin ID check, no public login)
- **Bot:** Telegram bot with inline keyboard buttons for admin + users
- **PWA:** Service worker, manifest.json, installable on mobile devices

## Key Features
- Looping galaxy/space video background
- Public movie browsing and rating (no login required)
- **Serial/TV show support** with episode playlist, prev/next navigation
- Admin-only movie/episode CRUD from web app and Telegram bot
- Video playback: Google Drive, YouTube, Vimeo, OK.ru, Rutube, direct MP4 (all play in-app via iframe/embed)
- Video upload via web form (up to 2GB) and Telegram bot (up to 20MB, or URL)
- Image upload via Telegram bot (photo or URL)
- Movie scraping from external sources via Telegram bot
- Movie categories and search
- Star rating system (1-5, anonymous)
- APK download for Android installation
- Dark space-themed UI with blue-black tones
- PWA support (Android/iOS installable)
- Mobile-responsive design with safe area support

## Project Structure
```
shared/
  schema.ts          - Drizzle schema (movies, categories, ratings)
  models/auth.ts     - Auth schema (users, sessions, verification_codes)
  routes.ts          - API contract definitions

server/
  index.ts           - Express server entry
  db.ts              - Database connection
  storage.ts         - Database storage layer
  routes.ts          - API route handlers
  telegram-bot.ts    - Telegram bot service (admin + user features)
  twilio-sms.ts      - Twilio SMS service for verification codes
  scraper.ts         - Movie scraping module (metadata extraction)
  replit_integrations/auth/ - Replit Auth setup

client/src/
  App.tsx             - Router setup (/, /movie/:id)
  pages/Home.tsx      - Main movie listing with hero section
  pages/MovieDetail.tsx - Movie detail + rating + video player
  components/layout/Navbar.tsx - Navigation bar (admin add movie button)
  components/layout/StarsBackground.tsx - Animated galaxy canvas
  components/layout/InstallPrompt.tsx - PWA install prompt
  components/movies/MovieCard.tsx - Movie card with hover effects
  components/movies/MovieFormDialog.tsx - Add/edit movie form
  hooks/use-auth.ts   - Auth hook (admin detection)
  hooks/use-movies.ts - Movie data hooks

client/public/
  manifest.json       - PWA manifest
  sw.js               - Service worker
  icons/              - PWA icons (192px, 512px)
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Session encryption
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_ADMIN_ID` - Admin's Telegram user ID (1123019731)
- `REPLIT_DOMAINS` - Auto-set, used for app URLs in bot

## Admin
- Admin ID: 1123019731 (Telegram) / "1123019731" (web app userId)
- Web app: "Kino qo'shish" button visible only for admin
- Movie edit/delete buttons visible only for admin on detail page

## Telegram Bot
### Admin Features (inline buttons)
- Add movie (step-by-step: title, description, year, image/photo, video, category)
- Image upload: send photo or paste URL
- Video upload: send video file or paste URL
- List/view movies
- Delete movies (with confirmation)
- Manage categories
- View statistics with top rated movies
- Scrape movies from external sources

### Episode Management (Admin)
- "Qismlar" button on movie cards to view/manage episodes
- Add episode flow: episode number → title (optional) → video URL
- List all episodes for a movie with delete option
- Auto-sets isSerial flag when episodes are added
- Duplicate episode number validation

### User Features (inline buttons)
- Browse all movies
- Search movies by name
- Browse by category
- View top rated movies
- Balance check (referral earnings)
- Referral link generation and sharing
- Weekly contest leaderboard
- Withdrawal requests (min 1000 so'm)
- Direct links to view movie details in app

### Referral System
- Each user gets unique referral code (ref_{chatId}_{random})
- 500 so'm per successful referral
- Weekly contest: top referrer wins
- Withdrawal to card (min 10,000 so'm, admin approval required)
- Tables: referrals, withdrawals, bot_users (balance, referral_code, etc.)
