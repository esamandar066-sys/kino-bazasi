# Kinolar - Movie Catalog Application

## Overview
A movie catalog application where users can register, login, browse movies, add movies, rate them, and manage content. Features Telegram bot integration for phone verification and admin movie management. PWA-enabled for Android/iOS.

## Architecture
- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL (Drizzle ORM)
- **Auth:** Replit Auth (Google login) + Phone auth via SMS (Twilio) with Telegram fallback
- **Bot:** Telegram bot with inline keyboard buttons for admin + users
- **PWA:** Service worker, manifest.json, installable on mobile devices

## Key Features
- Google login via Replit Auth
- Phone number login with SMS verification codes (Twilio), Telegram as fallback
- Movie CRUD operations
- Movie categories and search
- Star rating system (1-5)
- Telegram bot admin panel with inline keyboard buttons
- Telegram bot user panel (browse, search, view by category, top rated)
- Netflix-style dark UI
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
  replit_integrations/auth/ - Replit Auth setup

client/src/
  App.tsx             - Router setup
  pages/Home.tsx      - Main movie listing
  pages/Login.tsx     - Login page (phone + Google)
  pages/MovieDetail.tsx - Movie detail + rating
  components/layout/Navbar.tsx - Navigation bar (mobile responsive)
  components/layout/InstallPrompt.tsx - PWA install prompt
  components/movies/MovieCard.tsx - Movie card
  components/movies/MovieFormDialog.tsx - Add/edit movie form
  hooks/use-auth.ts   - Auth hook
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

## Telegram Bot
### Admin Features (inline buttons)
- Add movie (step-by-step with category selection)
- List/view movies
- Delete movies (with confirmation)
- Manage categories
- View statistics with top rated movies

### User Features (inline buttons)
- Browse all movies
- Search movies by name
- Browse by category
- View top rated movies
- Direct links to view movie details in app
