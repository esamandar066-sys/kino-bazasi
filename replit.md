# Kinolar - Movie Catalog Application

## Overview
A public movie catalog with animated galaxy/stars background. Admin (ID: 1123019731) can add/edit/delete movies from the web app and Telegram bot. All visitors can browse and rate movies without login.

## Architecture
- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui + Framer Motion
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL (Drizzle ORM)
- **Auth:** Admin-only (hardcoded admin ID check, no public login)
- **Bot:** Telegram bot with inline keyboard buttons for admin + users
- **PWA:** Service worker, manifest.json, installable on mobile devices

## Key Features
- Animated galaxy/stars canvas background (shooting stars, nebula, pulsing stars)
- Public movie browsing and rating (no login required)
- Admin-only movie CRUD from web app and Telegram bot
- Video upload via web form (file upload or URL) and Telegram bot
- Image upload via Telegram bot (photo or URL)
- Video player on movie detail page (HTML5 video + YouTube/Vimeo embed)
- Movie scraping from external sources via Telegram bot
- Movie categories and search
- Star rating system (1-5, anonymous)
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

### User Features (inline buttons)
- Browse all movies
- Search movies by name
- Browse by category
- View top rated movies
- Direct links to view movie details in app
