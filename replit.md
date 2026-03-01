# Kinolar - Movie Catalog Application

## Overview
A movie catalog application where users can register, login, browse movies, add movies, rate them, and manage content. Features Telegram bot integration for phone verification and admin movie management.

## Architecture
- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL (Drizzle ORM)
- **Auth:** Replit Auth (Google login) + Phone auth via Telegram bot
- **Bot:** Telegram bot for verification codes and admin management

## Key Features
- Google login via Replit Auth
- Phone number login with Telegram verification codes
- Movie CRUD operations
- Movie categories and search
- Star rating system (1-5)
- Telegram bot admin panel for managing movies
- Netflix-style dark UI

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
  telegram-bot.ts    - Telegram bot service
  replit_integrations/auth/ - Replit Auth setup

client/src/
  App.tsx             - Router setup
  pages/Home.tsx      - Main movie listing
  pages/Login.tsx     - Login page (phone + Google)
  pages/MovieDetail.tsx - Movie detail + rating
  components/layout/Navbar.tsx - Navigation bar
  components/movies/MovieCard.tsx - Movie card
  components/movies/MovieFormDialog.tsx - Add/edit movie form
  hooks/use-auth.ts   - Auth hook
  hooks/use-movies.ts - Movie data hooks
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Session encryption
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_ADMIN_ID` - Admin's Telegram user ID (1123019731)

## Telegram Bot Commands (Admin only)
- `/start` - Welcome message
- `/add_movie` - Add movie step-by-step
- `/list_movies` - List all movies
- `/delete_movie [id]` - Delete movie
- `/categories` - List categories
- `/add_category [name]` - Add category
- `/stats` - Statistics
