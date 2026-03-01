import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { setupAuth } from "./replit_integrations/auth/replitAuth";
import { api } from "@shared/routes";
import { z } from "zod";
import { startTelegramBot, getBotUsername, sendVerificationCode } from "./telegram-bot";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getAuthUserId(req: any): string | null {
  if (req.isAuthenticated?.() && req.user?.claims?.sub) {
    return req.user.claims.sub;
  }
  if (req.session?.phoneUserId) {
    return req.session.phoneUserId;
  }
  return null;
}

function isAnyAuthenticated(req: any, res: any, next: any) {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  startTelegramBot();

  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (req.isAuthenticated?.() && req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (user) return res.json(user);
      }

      if (req.session?.phoneUserId) {
        const [user] = await db.select().from(users).where(eq(users.id, req.session.phoneUserId));
        if (user) return res.json(user);
      }

      return res.status(401).json({ message: "Unauthorized" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post(api.phoneAuth.sendCode.path, async (req, res) => {
    try {
      const { phoneNumber, telegramUsername } = api.phoneAuth.sendCode.input.parse(req.body);
      const code = generateCode();
      await storage.createVerificationCode(phoneNumber, code);
      await storage.upsertUserByPhone(phoneNumber, undefined, telegramUsername);

      const botName = getBotUsername();
      if (!botName) {
        return res.status(500).json({ message: "Telegram bot hali ishga tushmagan. Biroz kuting." });
      }

      const existingUser = await storage.getUserByPhone(phoneNumber);
      if (existingUser?.telegramChatId) {
        const sent = await sendVerificationCode(existingUser.telegramChatId, code, phoneNumber);
        if (sent) {
          return res.json({
            message: "Tasdiqlash kodi Telegram botga yuborildi",
            codeSentDirectly: true,
          });
        }
      }

      const userByTg = await storage.getUserByTelegramUsername(telegramUsername);
      if (userByTg?.telegramChatId) {
        await storage.upsertUserByPhone(phoneNumber, userByTg.telegramChatId, telegramUsername);
        const sent = await sendVerificationCode(userByTg.telegramChatId, code, phoneNumber);
        if (sent) {
          return res.json({
            message: "Tasdiqlash kodi Telegram botga yuborildi",
            codeSentDirectly: true,
          });
        }
      }

      const telegramBotUrl = `https://t.me/${botName}?start=verify_${phoneNumber}`;

      res.json({
        message: "Avval Telegram botni oching, keyin kod yuboriladi",
        telegramBotUrl,
        codeSentDirectly: false,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Xatolik yuz berdi" });
    }
  });

  app.post(api.phoneAuth.verifyCode.path, async (req: any, res) => {
    try {
      const { phoneNumber, code } = api.phoneAuth.verifyCode.input.parse(req.body);
      const isValid = await storage.verifyCode(phoneNumber, code);

      if (!isValid) {
        return res.status(400).json({ message: "Kod noto'g'ri yoki muddati o'tgan" });
      }

      const user = await storage.upsertUserByPhone(phoneNumber);

      req.session.phoneUserId = user.id;
      req.session.save(() => {
        res.json({ message: "Muvaffaqiyatli kirildi!" });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Xatolik yuz berdi" });
    }
  });

  app.get("/api/auth/phone/check-telegram", async (req: any, res) => {
    try {
      const phoneNumber = req.query.phoneNumber as string;
      if (!phoneNumber) {
        return res.status(400).json({ verified: false });
      }

      const result = await storage.checkTelegramVerification(phoneNumber);
      if (result.verified && result.loginToken) {
        const user = await storage.upsertUserByPhone(phoneNumber);
        req.session.phoneUserId = user.id;
        req.session.save(() => {
          res.json({ verified: true });
        });
      } else {
        res.json({ verified: false });
      }
    } catch {
      res.json({ verified: false });
    }
  });

  app.get(api.categories.list.path, async (req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.get(api.movies.search.path, async (req, res) => {
    const q = req.query.q as string | undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const results = await storage.searchMovies(q, categoryId);
    res.json(results);
  });

  app.get(api.movies.list.path, async (req, res) => {
    const movs = await storage.getMovies();
    res.json(movs);
  });

  app.get(api.movies.get.path, async (req, res) => {
    const movie = await storage.getMovie(Number(req.params.id));
    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }
    res.json(movie);
  });

  app.post(api.movies.create.path, isAnyAuthenticated, async (req: any, res) => {
    try {
      const input = api.movies.create.input.parse(req.body);
      const userId = getAuthUserId(req)!;

      const movie = await storage.createMovie({
        ...input,
        userId,
      });
      res.status(201).json(movie);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Failed to create movie" });
    }
  });

  app.put(api.movies.update.path, isAnyAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const movie = await storage.getMovie(id);

      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      const userId = getAuthUserId(req)!;
      if (movie.userId !== userId) {
        return res.status(401).json({ message: "Unauthorized to edit this movie" });
      }

      const input = api.movies.update.input.parse(req.body);
      const updatedMovie = await storage.updateMovie(id, input);
      res.json(updatedMovie);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Failed to update movie" });
    }
  });

  app.delete(api.movies.delete.path, isAnyAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const movie = await storage.getMovie(id);

      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      const userId = getAuthUserId(req)!;
      if (movie.userId !== userId) {
        return res.status(401).json({ message: "Unauthorized to delete this movie" });
      }

      await storage.deleteMovie(id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete movie" });
    }
  });

  app.post(api.movies.rate.path, isAnyAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getMovie(id);
      if (!existing) {
        return res.status(404).json({ message: "Movie not found" });
      }

      const { score } = api.movies.rate.input.parse(req.body);
      const userId = getAuthUserId(req)!;

      const movie = await storage.rateMovie(id, userId, score);
      res.json(movie);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to rate movie" });
    }
  });

  return httpServer;
}
