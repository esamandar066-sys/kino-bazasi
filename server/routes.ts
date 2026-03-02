import type { Express } from "express";
import { type Server } from "http";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { setupAuth } from "./replit_integrations/auth/replitAuth";
import { api } from "@shared/routes";
import { z } from "zod";
import { startTelegramBot, getBotUsername, sendVerificationCode } from "./telegram-bot";
import { sendSmsCode } from "./twilio-sms";
import { scrapeAndSaveMovies, getAvailableCategories } from "./scraper";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

const TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID || "1123019731";
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: videoStorage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Faqat video fayllar qabul qilinadi (mp4, webm, ogg, mov, avi, mkv)"));
    }
  },
});

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

  app.use("/uploads", express.static(uploadsDir));

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

      const smsSent = await sendSmsCode(phoneNumber, code);
      if (smsSent) {
        return res.json({
          message: "Tasdiqlash kodi SMS orqali yuborildi",
          codeSentDirectly: true,
          method: "sms",
        });
      }

      const existingUser = await storage.getUserByPhone(phoneNumber);
      if (existingUser?.telegramChatId) {
        const sent = await sendVerificationCode(existingUser.telegramChatId, code, phoneNumber);
        if (sent) {
          return res.json({
            message: "Tasdiqlash kodi Telegram orqali yuborildi",
            codeSentDirectly: true,
            method: "telegram",
          });
        }
      }

      if (telegramUsername) {
        const userByTg = await storage.getUserByTelegramUsername(telegramUsername);
        if (userByTg?.telegramChatId) {
          await storage.upsertUserByPhone(phoneNumber, userByTg.telegramChatId, telegramUsername);
          const sent = await sendVerificationCode(userByTg.telegramChatId, code, phoneNumber);
          if (sent) {
            return res.json({
              message: "Tasdiqlash kodi Telegram orqali yuborildi",
              codeSentDirectly: true,
              method: "telegram",
            });
          }
        }
      }

      const botName = getBotUsername();
      if (botName) {
        const telegramBotUrl = `https://t.me/${botName}?start=verify_${phoneNumber}`;
        return res.json({
          message: "SMS yuborib bo'lmadi. Telegram bot orqali oling",
          telegramBotUrl,
          codeSentDirectly: false,
          method: "telegram_link",
        });
      }

      res.status(500).json({ message: "Kod yuborib bo'lmadi. Keyinroq urinib ko'ring." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Send code error:", err);
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

  app.post("/api/upload/video", isAnyAuthenticated, (req: any, res) => {
    upload.single("video")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "Fayl hajmi 500MB dan oshmasligi kerak" });
        }
        return res.status(400).json({ message: err.message });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ message: "Video fayl yuklanmadi" });
      }
      const videoUrl = `/uploads/${req.file.filename}`;
      res.json({ videoUrl });
    });
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

  app.post(api.movies.rate.path, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getMovie(id);
      if (!existing) {
        return res.status(404).json({ message: "Movie not found" });
      }

      const { score } = api.movies.rate.input.parse(req.body);
      const userId = getAuthUserId(req) || `anon_${req.ip || 'unknown'}`;

      const movie = await storage.rateMovie(id, userId, score);
      res.json(movie);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to rate movie" });
    }
  });

  app.get("/api/movies/:id/episodes", async (req, res) => {
    try {
      const movieId = Number(req.params.id);
      const eps = await storage.getEpisodes(movieId);
      res.json(eps);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch episodes" });
    }
  });

  app.post("/api/movies/:id/episodes", isAnyAuthenticated, async (req: any, res) => {
    try {
      const movieId = Number(req.params.id);
      const movie = await storage.getMovie(movieId);
      if (!movie) return res.status(404).json({ message: "Movie not found" });

      const userId = getAuthUserId(req);
      if (userId !== TELEGRAM_ADMIN_ID) {
        return res.status(403).json({ message: "Only admin can add episodes" });
      }

      const parsed = z.object({
        episodeNumber: z.number().min(1),
        title: z.string().nullable().optional(),
        videoUrl: z.string().min(1),
      }).parse(req.body);

      const ep = await storage.createEpisode({ movieId, episodeNumber: parsed.episodeNumber, title: parsed.title || null, videoUrl: parsed.videoUrl });
      res.status(201).json(ep);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create episode" });
    }
  });

  app.delete("/api/episodes/:id", isAnyAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteEpisode(Number(req.params.id));
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete episode" });
    }
  });

  app.get("/api/download-apk", (_req, res) => {
    const apkPath = path.join(uploadsDir, "Kinolar.apk");
    if (fs.existsSync(apkPath) && fs.statSync(apkPath).size > 0) {
      res.download(apkPath, "Kinolar.apk");
    } else {
      res.status(404).json({ message: "APK fayl hali yuklanmagan" });
    }
  });

  app.post("/api/upload-apk", isAnyAuthenticated, upload.single("apk"), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "APK fayl yuborilmadi" });
    }
    const dest = path.join(uploadsDir, "Kinolar.apk");
    fs.copyFileSync(req.file.path, dest);
    fs.unlinkSync(req.file.path);
    res.json({ message: "APK muvaffaqiyatli yuklandi", size: fs.statSync(dest).size });
  });

  return httpServer;
}
