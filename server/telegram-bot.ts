import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { scrapeAndSaveMovies, getAvailableCategories } from "./scraper";
import { db } from "./db";
import { botUsers } from "@shared/schema";
import { eq, sql, count, gte, and } from "drizzle-orm";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_ID = Number(process.env.TELEGRAM_ADMIN_ID!);

let bot: TelegramBot | null = null;
let botUsername: string = "";
const userChatIds: Map<string, number> = new Map();

async function trackBotUser(msg: TelegramBot.Message) {
  const chatId = String(msg.chat.id);
  const username = msg.from?.username || null;
  const firstName = msg.from?.first_name || null;
  const lastName = msg.from?.last_name || null;
  try {
    await db.insert(botUsers)
      .values({ chatId, username, firstName, lastName })
      .onConflictDoUpdate({
        target: botUsers.chatId,
        set: { username, firstName, lastName, lastActive: new Date() }
      });
  } catch (e) {}
}

let dailyReportTimer: NodeJS.Timeout | null = null;

async function sendDailyReport() {
  if (!bot) return;
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalResult] = await db.select({ count: count() }).from(botUsers);
    const totalUsers = totalResult?.count || 0;

    const [newUsersResult] = await db.select({ count: count() }).from(botUsers)
      .where(gte(botUsers.createdAt, yesterday));
    const newUsers = newUsersResult?.count || 0;

    const [activeResult] = await db.select({ count: count() }).from(botUsers)
      .where(gte(botUsers.lastActive, yesterday));
    const activeUsers = activeResult?.count || 0;

    const movies = await storage.getMovies();
    const totalRatings = movies.reduce((sum, m) => sum + (m.ratingCount || 0), 0);

    const dateStr = `${yesterday.getDate().toString().padStart(2, '0')}.${(yesterday.getMonth() + 1).toString().padStart(2, '0')}.${yesterday.getFullYear()}`;

    await bot.sendMessage(ADMIN_ID, [
      `\u{1F4CA} *Kunlik hisobot*`,
      `\u{1F4C5} ${dateStr}`,
      ``,
      `\u{1F465} Jami foydalanuvchilar: ${totalUsers}`,
      `\u{1F195} Yangi qo'shilganlar: ${newUsers}`,
      `\u{1F7E2} Faol foydalanuvchilar: ${activeUsers}`,
      ``,
      `\u{1F3AC} Jami kinolar: ${movies.length}`,
      `\u{2B50} Jami baholar: ${totalRatings}`,
    ].join("\n"), { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("Daily report error:", err?.message || err);
  }
}

function scheduleDailyReport() {
  if (dailyReportTimer) clearTimeout(dailyReportTimer);

  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();

  dailyReportTimer = setTimeout(() => {
    sendDailyReport();
    setInterval(sendDailyReport, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log(`Daily report scheduled in ${Math.round(msUntilMidnight / 60000)} minutes`);
}

export function getBotUsername(): string {
  return botUsername;
}

export function getBot(): TelegramBot | null {
  return bot;
}

export async function sendVerificationCode(chatId: string, code: string, phoneNumber: string): Promise<boolean> {
  if (!bot) return false;
  try {
    await bot.sendMessage(Number(chatId), [
      `\u{1F512} *Tasdiqlash kodi*`,
      ``,
      `Telefon: \`${phoneNumber}\``,
      `Kod: *${code}*`,
      ``,
      `\u{23F3} Kod 5 daqiqa ichida amal qiladi.`,
      ``,
      `\u{2B07} Quyidagi tugmani bosib tasdiqlang yoki kodni ilovaga kiriting.`
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u{2705} Tasdiqlash", callback_data: `telegram_verify_${phoneNumber}_${code}` }],
          [{ text: "\u{1F3AC} Ilovaga o'tish", url: `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "kinolar.replit.app"}` }]
        ]
      }
    });
    return true;
  } catch (err) {
    console.error("Failed to send verification code via Telegram:", err);
    return false;
  }
}

function isAdmin(chatId: number): boolean {
  return chatId === ADMIN_ID;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

const adminState: Map<number, { step: string; data: any }> = new Map();

export function startTelegramBot(): void {
  if (!BOT_TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not set, skipping bot startup");
    return;
  }

  if (bot) {
    try {
      bot.stopPolling();
      bot.removeAllListeners();
    } catch {}
    bot = null;
  }

  bot = new TelegramBot(BOT_TOKEN, { polling: { params: { timeout: 10 }, interval: 2000 } });

  bot.on("polling_error", (err: any) => {
    if (err?.message?.includes("409 Conflict")) {
      console.log("Another bot instance detected, will retry...");
    } else {
      console.error("Polling error:", err?.message || err);
    }
  });

  bot.getMe().then((me) => {
    botUsername = me.username || "";
    console.log(`Telegram bot started: @${botUsername}`);
    scheduleDailyReport();
  });

  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match?.[1]?.trim();
    trackBotUser(msg);

    if (param && param.startsWith("verify_")) {
      const phoneNumber = param.replace("verify_", "");
      userChatIds.set(phoneNumber, chatId);

      const tgUsername = msg.from?.username || "";
      await storage.upsertUserByPhone(phoneNumber, String(chatId), tgUsername);

      const pendingCode = await storage.getLatestVerificationCode(phoneNumber);
      if (pendingCode) {
        await storage.updateVerificationCodeChatId(pendingCode.id, String(chatId));
        await sendVerificationCode(String(chatId), pendingCode.code, phoneNumber);
      } else {
        await bot!.sendMessage(chatId, "\u{274C} Tasdiqlash kodi topilmadi.\n\nIltimos, ilovadan qaytadan kod so'rang.", {
          reply_markup: {
            inline_keyboard: [[
              { text: "\u{1F504} Qayta urinish", url: `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "kinolar.replit.app"}/login` }
            ]]
          }
        });
      }
      return;
    }

    if (isAdmin(chatId)) {
      await sendAdminMenu(chatId);
    } else {
      await sendUserMenu(chatId);
    }
  });

  async function sendAdminMenu(chatId: number) {
    await bot!.sendMessage(chatId, [
      `\u{1F3AC} *Kinolar Admin Panel*`,
      ``,
      `Xush kelibsiz, Admin!`,
      `Quyidagi tugmalar orqali boshqaring:`
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "\u{2795} Kino qo'shish", callback_data: "admin_add_movie" },
            { text: "\u{1F4CB} Kinolar ro'yxati", callback_data: "admin_list_movies" }
          ],
          [
            { text: "\u{1F4C1} Kategoriyalar", callback_data: "admin_categories" },
            { text: "\u{2795} Kategoriya qo'shish", callback_data: "admin_add_category" }
          ],
          [
            { text: "\u{1F4CA} Statistika", callback_data: "admin_stats" },
            { text: "\u{1F5D1} Kino o'chirish", callback_data: "admin_delete_movie" }
          ],
          [
            { text: "\u{1F465} Foydalanuvchilar", callback_data: "admin_users" },
            { text: "\u{1F310} Kinolar yuklash", callback_data: "admin_scrape" }
          ],
          [
            { text: "\u{1F4E2} Xabar yuborish", callback_data: "admin_broadcast" }
          ],
          [
            { text: "\u{1F464} Foydalanuvchi rejimi", callback_data: "user_menu" }
          ]
        ]
      }
    });
  }

  async function sendUserMenu(chatId: number) {
    await bot!.sendMessage(chatId, [
      `\u{1F3AC} *Kinolar*`,
      ``,
      `Xush kelibsiz! Kinolarni ko'ring va izlang.`
    ].join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "\u{1F525} Barcha kinolar", callback_data: "user_all_movies" },
            { text: "\u{1F50D} Kino qidirish", callback_data: "user_search" }
          ],
          [
            { text: "\u{1F4C1} Kategoriyalar", callback_data: "user_categories" },
            { text: "\u{2B50} Top reytinglar", callback_data: "user_top_rated" }
          ],
          [
            { text: "\u{1F310} Ilovani ochish", url: `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "kinolar.replit.app"}` }
          ]
        ]
      }
    });
  }

  async function sendMovieCard(chatId: number, movie: any, showAdminButtons: boolean = false) {
    const rating = movie.rating ? `${movie.rating.toFixed(1)}/5` : "Baholanmagan";
    const catName = movie.category?.name || "Kategoriyasiz";
    const year = movie.releaseYear || "?";
    const appUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "kinolar.replit.app"}/movie/${movie.id}`;

    const hasVideo = movie.videoUrl ? "\u{1F3AC} Video: Bor" : "";
    const lines = [
      `\u{1F3AC} *${movie.title}*`,
      ``,
      `\u{1F4C5} Yil: ${year}`,
      `\u{1F4C1} Kategoriya: ${catName}`,
      `\u{2B50} Reyting: ${rating} (${movie.ratingCount || 0} baho)`,
    ];
    if (hasVideo) lines.push(hasVideo);
    lines.push(``, `${movie.description?.substring(0, 200)}${movie.description?.length > 200 ? "..." : ""}`);
    const text = lines.join("\n");

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "\u{1F440} Batafsil ko'rish", url: appUrl }]
    ];

    if (showAdminButtons) {
      keyboard.push([
        { text: "\u{1F4FA} Qismlar", callback_data: `episodes_${movie.id}` },
      ]);
      keyboard.push([
        { text: "\u{1F5D1} O'chirish", callback_data: `confirm_delete_${movie.id}` },
      ]);
    }

    keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: isAdmin(chatId) ? "admin_menu" : "user_menu" }]);

    if (movie.imageUrl) {
      try {
        await bot!.sendPhoto(chatId, movie.imageUrl, {
          caption: text,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      } catch {
        // fallback to text if photo fails
      }
    }

    await bot!.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    const data = query.data || "";
    try { await bot!.answerCallbackQuery(query.id); } catch (e) {}

    try {
    if (data.startsWith("telegram_verify_")) {
      const parts = data.replace("telegram_verify_", "").split("_");
      const code = parts.pop()!;
      const phoneNumber = parts.join("_");

      const token = await storage.verifyViaTelegram(phoneNumber, code);
      if (token) {
        await storage.upsertUserByPhone(phoneNumber, String(chatId));

        const appUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "kinolar.replit.app"}`;

        await bot!.sendMessage(chatId, [
          `\u{2705} *Muvaffaqiyatli tasdiqlandi!*`,
          ``,
          `Telefon: \`${phoneNumber}\``,
          ``,
          `Ilova avtomatik kiradi. Agar kirmasa, quyidagi tugmani bosing.`
        ].join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F3AC} Ilovani ochish", url: appUrl }],
              [{ text: "\u{1F3E0} Bosh menyu", callback_data: isAdmin(chatId) ? "admin_menu" : "user_menu" }]
            ]
          }
        });
      } else {
        await bot!.sendMessage(chatId, "\u{274C} Kod eskirgan yoki allaqachon ishlatilgan. Ilovadan qayta kod so'rang.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F504} Ilovaga o'tish", url: `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "kinolar.replit.app"}/login` }]
            ]
          }
        });
      }
      return;
    }

    // Admin actions
    if (data === "admin_menu") {
      await sendAdminMenu(chatId);
      return;
    }

    if (data === "admin_add_movie") {
      if (!isAdmin(chatId)) return;
      adminState.set(chatId, { step: "title", data: {} });
      await bot!.sendMessage(chatId, [
        `\u{2795} *Yangi kino qo'shish*`,
        ``,
        `Kino nomini kiriting:`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]]
        }
      });
      return;
    }

    if (data === "admin_cancel") {
      adminState.delete(chatId);
      await bot!.sendMessage(chatId, "\u{274C} Bekor qilindi.");
      await sendAdminMenu(chatId);
      return;
    }

    if (data === "admin_list_movies") {
      const movies = await storage.getMovies();
      if (movies.length === 0) {
        await bot!.sendMessage(chatId, "\u{1F4ED} Hozircha kinolar yo'q.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{2795} Kino qo'shish", callback_data: "admin_add_movie" }],
              [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
            ]
          }
        });
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (const movie of movies.slice(0, 20)) {
        const rating = movie.rating ? `\u{2B50}${movie.rating.toFixed(1)}` : "";
        keyboard.push([
          { text: `${movie.title} (${movie.releaseYear || "?"}) ${rating}`, callback_data: `view_movie_${movie.id}` }
        ]);
      }
      keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]);

      await bot!.sendMessage(chatId, `\u{1F4CB} *Kinolar ro'yxati* (${movies.length} ta)`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    if (data === "admin_categories") {
      const cats = await storage.getCategories();
      if (cats.length === 0) {
        await bot!.sendMessage(chatId, "\u{1F4ED} Kategoriyalar yo'q.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{2795} Kategoriya qo'shish", callback_data: "admin_add_category" }],
              [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
            ]
          }
        });
        return;
      }

      let text = `\u{1F4C1} *Kategoriyalar* (${cats.length} ta)\n\n`;
      cats.forEach(c => text += `  \u{2022} ${c.name}\n`);

      await bot!.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{2795} Yangi kategoriya", callback_data: "admin_add_category" }],
            [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
          ]
        }
      });
      return;
    }

    if (data === "admin_add_category") {
      if (!isAdmin(chatId)) return;
      adminState.set(chatId, { step: "category_name", data: {} });
      await bot!.sendMessage(chatId, [
        `\u{2795} *Yangi kategoriya*`,
        ``,
        `Kategoriya nomini kiriting:`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]]
        }
      });
      return;
    }

    if (data === "admin_stats") {
      const movies = await storage.getMovies();
      const cats = await storage.getCategories();
      const [userCountResult] = await db.select({ count: count() }).from(botUsers);
      const totalUsers = userCountResult?.count || 0;
      const topMovies = [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
      const totalRatings = movies.reduce((sum, m) => sum + (m.ratingCount || 0), 0);
      const serialCount = movies.filter(m => m.isSerial).length;

      let topText = "";
      topMovies.forEach((m, i) => {
        topText += `  ${i + 1}. ${m.title} - \u{2B50}${m.rating?.toFixed(1) || "0"} (${m.ratingCount || 0} baho)\n`;
      });

      await bot!.sendMessage(chatId, [
        `\u{1F4CA} *Statistika*`,
        ``,
        `\u{1F465} Bot foydalanuvchilari: ${totalUsers}`,
        `\u{1F3AC} Kinolar: ${movies.length}`,
        `\u{1F4FA} Seriallar: ${serialCount}`,
        `\u{1F4C1} Kategoriyalar: ${cats.length}`,
        `\u{2B50} Jami baholar: ${totalRatings}`,
        ``,
        `\u{1F3C6} *Top 5 kino:*`,
        topText || "  Hozircha baholangan kino yo'q"
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]]
        }
      });
      return;
    }

    if (data === "admin_users") {
      if (!isAdmin(chatId)) return;
      const allUsers = await db.select().from(botUsers).orderBy(botUsers.lastActive);
      const total = allUsers.length;
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const activeToday = allUsers.filter(u => u.lastActive && u.lastActive > oneDayAgo).length;
      const activeWeek = allUsers.filter(u => u.lastActive && u.lastActive > oneWeekAgo).length;

      const recentUsers = allUsers.slice(-10).reverse();
      let userList = "";
      recentUsers.forEach((u, i) => {
        const name = escapeMarkdown([u.firstName, u.lastName].filter(Boolean).join(" ") || "Nomsiz");
        const uname = u.username ? `@${escapeMarkdown(u.username)}` : "";
        userList += `  ${i + 1}. ${name} ${uname}\n`;
      });

      await bot!.sendMessage(chatId, [
        `\u{1F465} *Foydalanuvchilar*`,
        ``,
        `\u{1F4CA} Jami: ${total}`,
        `\u{1F7E2} Bugun faol: ${activeToday}`,
        `\u{1F535} Hafta faol: ${activeWeek}`,
        ``,
        `\u{1F551} *Oxirgi foydalanuvchilar:*`,
        userList || "  Hozircha foydalanuvchilar yo'q"
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{1F4CB} To'liq ro'yxat", callback_data: "admin_users_full" }],
            [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
          ]
        }
      });
      return;
    }

    if (data === "admin_users_full") {
      if (!isAdmin(chatId)) return;
      const allUsers = await db.select().from(botUsers).orderBy(botUsers.createdAt);
      if (allUsers.length === 0) {
        await bot!.sendMessage(chatId, "\u{1F4ED} Hozircha foydalanuvchilar yo'q.", {
          reply_markup: { inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_users" }]] }
        });
        return;
      }
      let msgText = `\u{1F465} *Barcha foydalanuvchilar (${allUsers.length}):*\n\n`;
      allUsers.forEach((u, i) => {
        const name = escapeMarkdown([u.firstName, u.lastName].filter(Boolean).join(" ") || "Nomsiz");
        const uname = u.username ? ` (@${escapeMarkdown(u.username)})` : "";
        msgText += `${i + 1}. ${name}${uname}\n`;
      });
      if (msgText.length > 4000) msgText = msgText.substring(0, 4000) + "\n...";
      await bot!.sendMessage(chatId, msgText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_users" }]] }
      });
      return;
    }

    if (data === "admin_broadcast") {
      if (!isAdmin(chatId)) return;
      adminState.set(chatId, { step: "broadcast_message", data: {} });
      await bot!.sendMessage(chatId, [
        `\u{1F4E2} *Xabar yuborish*`,
        ``,
        `Barcha foydalanuvchilarga yuboriladigan xabarni yozing:`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]]
        }
      });
      return;
    }

    if (data === "admin_delete_movie") {
      if (!isAdmin(chatId)) return;
      const movies = await storage.getMovies();
      if (movies.length === 0) {
        await bot!.sendMessage(chatId, "\u{1F4ED} O'chirish uchun kino yo'q.", {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]]
          }
        });
        return;
      }
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (const movie of movies.slice(0, 20)) {
        keyboard.push([
          { text: `\u{1F5D1} ${movie.title} (${movie.releaseYear || "?"})`, callback_data: `confirm_delete_${movie.id}` }
        ]);
      }
      keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]);

      await bot!.sendMessage(chatId, `\u{1F5D1} *O'chirish uchun kino tanlang:*`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    if (data.startsWith("confirm_delete_")) {
      if (!isAdmin(chatId)) return;
      const id = Number(data.replace("confirm_delete_", ""));
      const movie = await storage.getMovie(id);
      if (!movie) {
        await bot!.sendMessage(chatId, "\u{274C} Kino topilmadi.");
        return;
      }

      await bot!.sendMessage(chatId, `\u{26A0} *"${movie.title}"* kinoni o'chirasizmi?`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "\u{2705} Ha, o'chirish", callback_data: `do_delete_${id}` },
              { text: "\u{274C} Yo'q", callback_data: "admin_menu" }
            ]
          ]
        }
      });
      return;
    }

    if (data.startsWith("do_delete_")) {
      if (!isAdmin(chatId)) return;
      const id = Number(data.replace("do_delete_", ""));
      try {
        const movie = await storage.getMovie(id);
        await storage.deleteMovie(id);
        await bot!.sendMessage(chatId, `\u{2705} "${movie?.title}" kinosi o'chirildi!`, {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]]
          }
        });
      } catch {
        await bot!.sendMessage(chatId, "\u{274C} Xatolik yuz berdi.");
      }
      return;
    }

    // View movie (shared between admin and user)
    if (data.startsWith("view_movie_")) {
      const id = Number(data.replace("view_movie_", ""));
      const movie = await storage.getMovie(id);
      if (!movie) {
        await bot!.sendMessage(chatId, "\u{274C} Kino topilmadi.");
        return;
      }
      await sendMovieCard(chatId, movie, isAdmin(chatId));
      return;
    }

    // User actions
    if (data === "user_menu") {
      await sendUserMenu(chatId);
      return;
    }

    if (data === "user_all_movies") {
      const movies = await storage.getMovies();
      if (movies.length === 0) {
        await bot!.sendMessage(chatId, "\u{1F4ED} Hozircha kinolar yo'q.", {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "user_menu" }]]
          }
        });
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (const movie of movies.slice(0, 20)) {
        const rating = movie.rating ? `\u{2B50}${movie.rating.toFixed(1)}` : "";
        const cat = movie.category?.name ? `[${movie.category.name}]` : "";
        keyboard.push([
          { text: `${movie.title} (${movie.releaseYear || "?"}) ${rating} ${cat}`, callback_data: `view_movie_${movie.id}` }
        ]);
      }
      keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: "user_menu" }]);

      await bot!.sendMessage(chatId, `\u{1F525} *Barcha kinolar* (${movies.length} ta)`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    if (data === "user_search") {
      adminState.set(chatId, { step: "user_search_query", data: {} });
      await bot!.sendMessage(chatId, [
        `\u{1F50D} *Kino qidirish*`,
        ``,
        `Kino nomini yozing:`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{274C} Bekor qilish", callback_data: "user_menu" }]]
        }
      });
      return;
    }

    if (data === "user_categories") {
      const cats = await storage.getCategories();
      if (cats.length === 0) {
        await bot!.sendMessage(chatId, "\u{1F4ED} Kategoriyalar yo'q.", {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "user_menu" }]]
          }
        });
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (const cat of cats) {
        keyboard.push([
          { text: `\u{1F4C1} ${cat.name}`, callback_data: `user_cat_${cat.id}` }
        ]);
      }
      keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: "user_menu" }]);

      await bot!.sendMessage(chatId, `\u{1F4C1} *Kategoriya tanlang:*`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    if (data.startsWith("user_cat_")) {
      const catId = Number(data.replace("user_cat_", ""));
      const movies = await storage.searchMovies(undefined, catId);
      const cats = await storage.getCategories();
      const catName = cats.find(c => c.id === catId)?.name || "?";

      if (movies.length === 0) {
        await bot!.sendMessage(chatId, `\u{1F4ED} "${catName}" kategoriyasida kino yo'q.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{25C0} Kategoriyalar", callback_data: "user_categories" }],
              [{ text: "\u{1F3E0} Bosh menyu", callback_data: "user_menu" }]
            ]
          }
        });
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (const movie of movies.slice(0, 15)) {
        const rating = movie.rating ? `\u{2B50}${movie.rating.toFixed(1)}` : "";
        keyboard.push([
          { text: `${movie.title} (${movie.releaseYear || "?"}) ${rating}`, callback_data: `view_movie_${movie.id}` }
        ]);
      }
      keyboard.push([{ text: "\u{25C0} Kategoriyalar", callback_data: "user_categories" }]);

      await bot!.sendMessage(chatId, `\u{1F4C1} *${catName}* (${movies.length} ta kino)`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    if (data === "user_top_rated") {
      const allMovies = await storage.getMovies();
      const topMovies = [...allMovies].filter(m => (m.rating || 0) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);

      if (topMovies.length === 0) {
        await bot!.sendMessage(chatId, "\u{2B50} Hozircha baholangan kino yo'q.", {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "user_menu" }]]
          }
        });
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      topMovies.forEach((movie, i) => {
        keyboard.push([
          { text: `${i + 1}. ${movie.title} \u{2B50}${movie.rating?.toFixed(1)} (${movie.ratingCount} baho)`, callback_data: `view_movie_${movie.id}` }
        ]);
      });
      keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: "user_menu" }]);

      await bot!.sendMessage(chatId, `\u{1F3C6} *Top reytinglar:*`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    if (data === "admin_scrape") {
      if (!isAdmin(chatId)) return;
      const cats = getAvailableCategories();
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (let i = 0; i < cats.length; i += 2) {
        const row: TelegramBot.InlineKeyboardButton[] = [
          { text: cats[i].name, callback_data: `scrape_cat_${cats[i].key}` }
        ];
        if (cats[i + 1]) {
          row.push({ text: cats[i + 1].name, callback_data: `scrape_cat_${cats[i + 1].key}` });
        }
        keyboard.push(row);
      }
      keyboard.push([{ text: "\u{1F525} Barchasi (asosiy sahifa)", callback_data: "scrape_cat_all" }]);
      keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]);

      await bot!.sendMessage(chatId, [
        `\u{1F310} *Kinolar yuklash*`,
        ``,
        `Qaysi kategoriyadan yuklash kerak?`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    if (data.startsWith("scrape_cat_")) {
      if (!isAdmin(chatId)) return;
      const catKey = data.replace("scrape_cat_", "");
      adminState.set(chatId, {
        step: "scrape_limit",
        data: { category: catKey === "all" ? undefined : catKey }
      });

      await bot!.sendMessage(chatId, [
        `\u{1F522} Nechta kino yuklash kerak?`,
        ``,
        `Raqam kiriting (1-50):`
      ].join("\n"), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "5 ta", callback_data: "scrape_limit_5" },
              { text: "10 ta", callback_data: "scrape_limit_10" },
              { text: "20 ta", callback_data: "scrape_limit_20" }
            ],
            [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
          ]
        }
      });
      return;
    }

    if (data.startsWith("scrape_limit_")) {
      if (!isAdmin(chatId)) return;
      const state = adminState.get(chatId);
      if (!state || state.step !== "scrape_limit") return;

      const limit = Number(data.replace("scrape_limit_", ""));
      adminState.delete(chatId);

      await bot!.sendMessage(chatId, `\u{23F3} Kinolar yuklanmoqda... (${limit} tagacha)`);

      try {
        const result = await scrapeAndSaveMovies({
          category: state.data.category,
          limit,
          userId: String(ADMIN_ID),
        });

        const lines = [
          `\u{2705} *Yuklash yakunlandi!*`,
          ``,
          `\u{2795} Qo'shildi: ${result.added}`,
          `\u{23ED} O'tkazildi (mavjud): ${result.skipped}`,
          `\u{274C} Xatolik: ${result.errors}`,
        ];

        if (result.movies.length > 0) {
          lines.push(``, `*Yangi kinolar:*`);
          result.movies.forEach((m, i) => lines.push(`  ${i + 1}. ${m}`));
        }

        await bot!.sendMessage(chatId, lines.join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F310} Yana yuklash", callback_data: "admin_scrape" }],
              [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
            ]
          }
        });
      } catch (err) {
        console.error("Scrape error:", err);
        await bot!.sendMessage(chatId, `\u{274C} Yuklashda xatolik yuz berdi: ${(err as Error).message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F504} Qayta urinish", callback_data: "admin_scrape" }],
              [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
            ]
          }
        });
      }
      return;
    }

    // Category selection during add_movie
    if (data.startsWith("select_cat_")) {
      const state = adminState.get(chatId);
      if (!state || state.step !== "category") return;
      const catId = data.replace("select_cat_", "");
      state.data.categoryId = catId === "skip" ? null : Number(catId);
      state.step = "confirm";

      const cats = await storage.getCategories();
      const catName = state.data.categoryId ? cats.find(c => c.id === state.data.categoryId)?.name || "?" : "Yo'q";

      await bot!.sendMessage(chatId, [
        `\u{1F4DD} *Kino ma'lumotlari:*`,
        ``,
        `\u{1F3AC} Nomi: ${state.data.title}`,
        `\u{1F4C4} Ta'rif: ${state.data.description?.substring(0, 100)}...`,
        `\u{1F4C5} Yil: ${state.data.releaseYear || "?"}`,
        `\u{1F4C1} Kategoriya: ${catName}`,
        `\u{1F5BC} Rasm: ${state.data.imageUrl ? "Bor" : "Yo'q"}`,
        `\u{1F3AC} Video: ${state.data.videoUrl ? "Bor" : "Yo'q"}`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "\u{2705} Tasdiqlash", callback_data: "confirm_add_yes" },
              { text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }
            ]
          ]
        }
      });
      return;
    }

    if (data.startsWith("episodes_")) {
      if (!isAdmin(chatId)) return;
      const movieId = Number(data.replace("episodes_", ""));
      const movie = await storage.getMovie(movieId);
      if (!movie) {
        await bot!.sendMessage(chatId, "\u{274C} Kino topilmadi.");
        return;
      }
      const eps = await storage.getEpisodes(movieId);
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      if (eps.length === 0) {
        await bot!.sendMessage(chatId, [
          `\u{1F4FA} *${movie.title}* - Qismlar`,
          ``,
          `Hozircha qismlar yo'q.`
        ].join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{2795} Qism qo'shish", callback_data: `add_episode_${movieId}` }],
              [{ text: "\u{25C0} Orqaga", callback_data: `view_movie_${movieId}` }]
            ]
          }
        });
      } else {
        let text = `\u{1F4FA} *${movie.title}* - Qismlar (${eps.length} ta)\n\n`;
        for (const ep of eps) {
          text += `  ${ep.episodeNumber}-qism${ep.title ? `: ${ep.title}` : ""}\n`;
          keyboard.push([
            { text: `\u{1F5D1} ${ep.episodeNumber}-qism`, callback_data: `delete_episode_${ep.id}_${movieId}` }
          ]);
        }
        keyboard.push([{ text: "\u{2795} Qism qo'shish", callback_data: `add_episode_${movieId}` }]);
        keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: `view_movie_${movieId}` }]);

        await bot!.sendMessage(chatId, text, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      return;
    }

    if (data.startsWith("add_episode_")) {
      if (!isAdmin(chatId)) return;
      const movieId = Number(data.replace("add_episode_", ""));
      adminState.set(chatId, { step: "episode_number", data: { movieId } });
      await bot!.sendMessage(chatId, [
        `\u{2795} *Yangi qism qo'shish*`,
        ``,
        `Qism raqamini kiriting:`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{274C} Bekor qilish", callback_data: `episodes_${movieId}` }]]
        }
      });
      return;
    }

    if (data.startsWith("delete_episode_")) {
      if (!isAdmin(chatId)) return;
      const parts = data.replace("delete_episode_", "").split("_");
      const epId = Number(parts[0]);
      const movieId = Number(parts[1]);
      try {
        await storage.deleteEpisode(epId);
        await bot!.sendMessage(chatId, "\u{2705} Qism o'chirildi!");
        const movie = await storage.getMovie(movieId);
        if (movie) {
          const eps = await storage.getEpisodes(movieId);
          const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

          if (eps.length === 0) {
            await bot!.sendMessage(chatId, [
              `\u{1F4FA} *${movie.title}* - Qismlar`,
              ``,
              `Hozircha qismlar yo'q.`
            ].join("\n"), {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "\u{2795} Qism qo'shish", callback_data: `add_episode_${movieId}` }],
                  [{ text: "\u{25C0} Orqaga", callback_data: `view_movie_${movieId}` }]
                ]
              }
            });
          } else {
            let text = `\u{1F4FA} *${movie.title}* - Qismlar (${eps.length} ta)\n\n`;
            for (const ep of eps) {
              text += `  ${ep.episodeNumber}-qism${ep.title ? `: ${ep.title}` : ""}\n`;
              keyboard.push([
                { text: `\u{1F5D1} ${ep.episodeNumber}-qism`, callback_data: `delete_episode_${ep.id}_${movieId}` }
              ]);
            }
            keyboard.push([{ text: "\u{2795} Qism qo'shish", callback_data: `add_episode_${movieId}` }]);
            keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: `view_movie_${movieId}` }]);

            await bot!.sendMessage(chatId, text, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: keyboard }
            });
          }
        }
      } catch {
        await bot!.sendMessage(chatId, "\u{274C} Xatolik yuz berdi.");
      }
      return;
    }

    if (data.startsWith("skip_episode_title_")) {
      if (!isAdmin(chatId)) return;
      const state = adminState.get(chatId);
      if (!state || state.step !== "episode_title") return;
      state.data.episodeTitle = null;
      state.step = "episode_video";
      await bot!.sendMessage(chatId, `\u{1F3AC} Video URL manzilini kiriting:`, {
        reply_markup: {
          inline_keyboard: [[{ text: "\u{274C} Bekor qilish", callback_data: `episodes_${state.data.movieId}` }]]
        }
      });
      return;
    }

    if (data === "confirm_add_yes") {
      const state = adminState.get(chatId);
      if (!state || state.step !== "confirm") return;

      try {
        const movie = await storage.createMovie({
          title: state.data.title,
          description: state.data.description,
          releaseYear: state.data.releaseYear,
          imageUrl: state.data.imageUrl,
          videoUrl: state.data.videoUrl,
          categoryId: state.data.categoryId,
          userId: String(ADMIN_ID),
        });
        adminState.delete(chatId);

        await bot!.sendMessage(chatId, [
          `\u{2705} *Kino qo'shildi!*`,
          ``,
          `\u{1F3AC} ${movie?.title}`,
          `ID: ${movie?.id}`
        ].join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{2795} Yana qo'shish", callback_data: "admin_add_movie" }],
              [{ text: "\u{25C0} Bosh menyu", callback_data: "admin_menu" }]
            ]
          }
        });
      } catch {
        adminState.delete(chatId);
        await bot!.sendMessage(chatId, "\u{274C} Xatolik yuz berdi.", {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]]
          }
        });
      }
      return;
    }
    } catch (err: any) {
      console.error("Callback query error:", err?.message || err);
      try { await bot!.sendMessage(chatId, "Xatolik yuz berdi. Qaytadan urinib ko'ring."); } catch (e) {}
    }
  });

  bot.on("photo", async (msg) => {
    const chatId = msg.chat.id;
    const state = adminState.get(chatId);
    if (!state || state.step !== "image") return;

    try {
      const photos = msg.photo!;
      const largest = photos[photos.length - 1];
      const fileLink = await bot!.getFileLink(largest.file_id);

      const fs = await import("fs");
      const path = await import("path");
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const filePath = path.join(uploadsDir, fileName);

      const response = await fetch(fileLink);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const imageUrl = `/uploads/${fileName}`;
      state.data.imageUrl = imageUrl;
      state.step = "video";

      await bot!.sendMessage(chatId, `\u{2705} Rasm yuklandi!`);
      await bot!.sendMessage(chatId, `\u{1F3AC} Video URL manzilini kiriting yoki video fayl yuboring:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{23ED} O'tkazish", callback_data: "skip_video" }],
            [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
          ]
        }
      });
    } catch (err) {
      console.error("Photo download error:", err);
      await bot!.sendMessage(chatId, `\u{274C} Rasm yuklab olib bo'lmadi. URL kiriting yoki qaytadan yuboring.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{23ED} O'tkazish", callback_data: "select_cat_skip_image" }],
            [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
          ]
        }
      });
    }
  });

  bot.on("video", async (msg) => {
    const chatId = msg.chat.id;
    const state = adminState.get(chatId);
    if (!state || state.step !== "video") return;

    try {
      const video = msg.video!;
      const maxSize = 20 * 1024 * 1024;
      if (video.file_size && video.file_size > maxSize) {
        const sizeMB = (video.file_size / (1024 * 1024)).toFixed(0);
        await bot!.sendMessage(chatId, [
          `\u{274C} Video hajmi juda katta (${sizeMB} MB).`,
          ``,
          `Telegram bot orqali faqat 20MB gacha fayl yuklab olish mumkin.`,
          ``,
          `\u{1F4A1} *Katta video uchun:*`,
          `1. Videoni Google Drive ga yuklang`,
          `2. "Har kimga ochiq" qiling`,
          `3. Havolani shu yerga yuboring`,
          ``,
          `Yoki boshqa video hosting (YouTube, OK.ru) havolasini yuboring.`
        ].join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{23ED} O'tkazish", callback_data: "skip_video" }],
              [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }],
            ]
          }
        });
        return;
      }
      const fileId = video.file_id;
      const fileLink = await bot!.getFileLink(fileId);

      const fs = await import("fs");
      const path = await import("path");
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
      const filePath = path.join(uploadsDir, fileName);

      const response = await fetch(fileLink);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const videoUrl = `/uploads/${fileName}`;
      state.data.videoUrl = videoUrl;
      state.step = "category";

      await bot!.sendMessage(chatId, `\u{2705} Video yuklandi!`);
      await showCategorySelection(chatId);
    } catch (err) {
      console.error("Video download error:", err);
      await bot!.sendMessage(chatId, `\u{274C} Video yuklab olib bo'lmadi. URL kiriting yoki qaytadan yuboring.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{23ED} O'tkazish", callback_data: "skip_video" }],
            [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
          ]
        }
      });
    }
  });

  bot.on("document", async (msg) => {
    const chatId = msg.chat.id;
    const state = adminState.get(chatId);
    if (!state) return;

    const doc = msg.document!;
    const mime = doc.mime_type || "";

    if (state.step === "image" && mime.startsWith("image/")) {
      try {
        const fileLink = await bot!.getFileLink(doc.file_id);
        const fs = await import("fs");
        const path = await import("path");
        const uploadsDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const ext = path.extname(doc.file_name || ".jpg") || ".jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const filePath = path.join(uploadsDir, fileName);

        const response = await fetch(fileLink);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        state.data.imageUrl = `/uploads/${fileName}`;
        state.step = "video";

        await bot!.sendMessage(chatId, `\u{2705} Rasm yuklandi!`);
        await bot!.sendMessage(chatId, `\u{1F3AC} Video URL manzilini kiriting yoki video fayl yuboring:`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{23ED} O'tkazish", callback_data: "skip_video" }],
              [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
            ]
          }
        });
      } catch (err) {
        console.error("Document image download error:", err);
        await bot!.sendMessage(chatId, `\u{274C} Rasm yuklab olib bo'lmadi. Qaytadan yuboring.`);
      }
      return;
    }

    if (state.step !== "video") return;

    if (!mime.startsWith("video/")) {
      await bot!.sendMessage(chatId, "\u{274C} Faqat video fayllar qabul qilinadi.");
      return;
    }

    const maxSize = 20 * 1024 * 1024;
    if (doc.file_size && doc.file_size > maxSize) {
      const sizeMB = (doc.file_size / (1024 * 1024)).toFixed(0);
      await bot!.sendMessage(chatId, [
        `\u{274C} Video hajmi juda katta (${sizeMB} MB).`,
        ``,
        `\u{1F4A1} Google Drive yoki boshqa hosting havolasini yuboring.`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{23ED} O'tkazish", callback_data: "skip_video" }],
          ]
        }
      });
      return;
    }

    try {
      const fileLink = await bot!.getFileLink(doc.file_id);
      const fs = await import("fs");
      const path = await import("path");
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const ext = path.extname(doc.file_name || ".mp4") || ".mp4";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const filePath = path.join(uploadsDir, fileName);

      const response = await fetch(fileLink);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const videoUrl = `/uploads/${fileName}`;
      state.data.videoUrl = videoUrl;
      state.step = "category";

      await bot!.sendMessage(chatId, `\u{2705} Video yuklandi!`);
      await showCategorySelection(chatId);
    } catch (err) {
      console.error("Document video download error:", err);
      await bot!.sendMessage(chatId, `\u{274C} Video yuklab olib bo'lmadi. URL kiriting yoki qaytadan yuboring.`);
    }
  });

  // Handle text messages for step-by-step flows and movie lookup by ID
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    trackBotUser(msg);
    if (msg.text?.startsWith("/")) return;
    if (msg.video || msg.document || msg.photo) return;

    const text = msg.text || "";
    const state = adminState.get(chatId);

    if (state?.step === "broadcast_message") {
      if (!isAdmin(chatId)) return;
      const broadcastText = text.trim();
      if (!broadcastText) return;
      const allUsers = await db.select().from(botUsers);
      let sent = 0;
      let failed = 0;
      for (const user of allUsers) {
        try {
          await bot!.sendMessage(Number(user.chatId), broadcastText);
          sent++;
        } catch (e) {
          failed++;
        }
      }
      adminState.delete(chatId);
      await bot!.sendMessage(chatId, [
        `\u{2705} *Xabar yuborildi!*`,
        ``,
        `\u{1F4E8} Yuborildi: ${sent}`,
        `\u{274C} Xato: ${failed}`,
        `\u{1F465} Jami: ${allUsers.length}`
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]]
        }
      });
      return;
    }

    if (!state) {
      const trimmed = text.trim();
      if (/^\d+$/.test(trimmed)) {
        const movieId = Number(trimmed);
        const movie = await storage.getMovie(movieId);
        if (movie) {
          await sendMovieCard(chatId, movie, isAdmin(chatId));
        } else {
          await bot!.sendMessage(chatId, `\u{274C} ${movieId}-ID bilan kino topilmadi.\n\nKino qidirish uchun nomini yozing yoki menyu tugmalarini ishlating.`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "\u{1F525} Barcha kinolar", callback_data: "user_all_movies" }],
                [{ text: "\u{1F50D} Kino qidirish", callback_data: "user_search" }],
                [{ text: "\u{1F3E0} Bosh menyu", callback_data: isAdmin(chatId) ? "admin_menu" : "user_menu" }]
              ]
            }
          });
        }
        return;
      }

      const movies = await storage.searchMovies(trimmed);
      if (movies.length > 0) {
        const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
        for (const movie of movies.slice(0, 10)) {
          const rating = movie.rating ? `\u{2B50}${movie.rating.toFixed(1)}` : "";
          keyboard.push([
            { text: `${movie.title} (${movie.releaseYear || "?"}) ${rating}`, callback_data: `view_movie_${movie.id}` }
          ]);
        }
        keyboard.push([{ text: "\u{1F3E0} Bosh menyu", callback_data: isAdmin(chatId) ? "admin_menu" : "user_menu" }]);

        await bot!.sendMessage(chatId, `\u{1F50D} *"${trimmed}"* bo'yicha natijalar:`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        await bot!.sendMessage(chatId, `\u{1F50D} "${trimmed}" bo'yicha hech narsa topilmadi.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F525} Barcha kinolar", callback_data: "user_all_movies" }],
              [{ text: "\u{1F3E0} Bosh menyu", callback_data: isAdmin(chatId) ? "admin_menu" : "user_menu" }]
            ]
          }
        });
      }
      return;
    }

    if (state.step === "scrape_limit") {
      const parsed = Number(text);
      if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        await bot!.sendMessage(chatId, "1 dan 50 gacha raqam kiriting:", {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "5 ta", callback_data: "scrape_limit_5" },
                { text: "10 ta", callback_data: "scrape_limit_10" },
                { text: "20 ta", callback_data: "scrape_limit_20" }
              ],
              [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
            ]
          }
        });
        return;
      }
      const limit = parsed;
      adminState.delete(chatId);

      await bot!.sendMessage(chatId, `\u{23F3} Kinolar yuklanmoqda... (${limit} tagacha)`);

      try {
        const result = await scrapeAndSaveMovies({
          category: state.data.category,
          limit,
          userId: String(ADMIN_ID),
        });

        const lines = [
          `\u{2705} *Yuklash yakunlandi!*`,
          ``,
          `\u{2795} Qo'shildi: ${result.added}`,
          `\u{23ED} O'tkazildi (mavjud): ${result.skipped}`,
          `\u{274C} Xatolik: ${result.errors}`,
        ];

        if (result.movies.length > 0) {
          lines.push(``, `*Yangi kinolar:*`);
          result.movies.forEach((m, i) => lines.push(`  ${i + 1}. ${m}`));
        }

        await bot!.sendMessage(chatId, lines.join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F310} Yana yuklash", callback_data: "admin_scrape" }],
              [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
            ]
          }
        });
      } catch (err) {
        console.error("Scrape error:", err);
        await bot!.sendMessage(chatId, `\u{274C} Yuklashda xatolik: ${(err as Error).message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F504} Qayta urinish", callback_data: "admin_scrape" }],
              [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
            ]
          }
        });
      }
      return;
    }

    // User search flow
    if (state.step === "user_search_query") {
      adminState.delete(chatId);
      const movies = await storage.searchMovies(text);
      if (movies.length === 0) {
        await bot!.sendMessage(chatId, `\u{1F50D} "${text}" bo'yicha hech narsa topilmadi.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F50D} Qayta qidirish", callback_data: "user_search" }],
              [{ text: "\u{25C0} Orqaga", callback_data: "user_menu" }]
            ]
          }
        });
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
      for (const movie of movies.slice(0, 15)) {
        const rating = movie.rating ? `\u{2B50}${movie.rating.toFixed(1)}` : "";
        keyboard.push([
          { text: `${movie.title} (${movie.releaseYear || "?"}) ${rating}`, callback_data: `view_movie_${movie.id}` }
        ]);
      }
      keyboard.push([{ text: "\u{1F50D} Qayta qidirish", callback_data: "user_search" }]);
      keyboard.push([{ text: "\u{25C0} Orqaga", callback_data: "user_menu" }]);

      await bot!.sendMessage(chatId, `\u{1F50D} *"${text}"* bo'yicha natijalar (${movies.length} ta):`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    // Admin category add flow
    if (state.step === "category_name") {
      adminState.delete(chatId);
      try {
        const cat = await storage.createCategory(text.trim());
        await bot!.sendMessage(chatId, `\u{2705} "${cat.name}" kategoriyasi qo'shildi!`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{2795} Yana qo'shish", callback_data: "admin_add_category" }],
              [{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]
            ]
          }
        });
      } catch {
        await bot!.sendMessage(chatId, "\u{274C} Bu kategoriya allaqachon mavjud yoki xatolik yuz berdi.", {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]]
          }
        });
      }
      return;
    }

    if (state.step === "episode_number") {
      if (!isAdmin(chatId)) return;
      const num = Number(text);
      if (isNaN(num) || num < 1) {
        await bot!.sendMessage(chatId, "\u{274C} Iltimos, to'g'ri raqam kiriting (1 dan boshlab):");
        return;
      }
      state.data.episodeNumber = num;
      state.step = "episode_title";
      await bot!.sendMessage(chatId, `\u{1F4DD} Qism nomini kiriting:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{23ED} O'tkazish", callback_data: `skip_episode_title_${state.data.movieId}` }],
            [{ text: "\u{274C} Bekor qilish", callback_data: `episodes_${state.data.movieId}` }]
          ]
        }
      });
      return;
    }

    if (state.step === "episode_title") {
      if (!isAdmin(chatId)) return;
      state.data.episodeTitle = text.trim();
      state.step = "episode_video";
      await bot!.sendMessage(chatId, `\u{1F3AC} Video URL manzilini kiriting:`, {
        reply_markup: {
          inline_keyboard: [[{ text: "\u{274C} Bekor qilish", callback_data: `episodes_${state.data.movieId}` }]]
        }
      });
      return;
    }

    if (state.step === "episode_video") {
      if (!isAdmin(chatId)) return;
      let videoUrl = text.trim();
      if (videoUrl.includes("<iframe") || videoUrl.includes("&lt;iframe")) {
        const srcMatch = videoUrl.match(/src=["']([^"']+)["']/);
        if (srcMatch) {
          videoUrl = srcMatch[1].startsWith("//") ? "https:" + srcMatch[1] : srcMatch[1];
        }
      }
      const movieId = state.data.movieId;
      try {
        await storage.createEpisode({
          movieId,
          episodeNumber: state.data.episodeNumber,
          title: state.data.episodeTitle || null,
          videoUrl,
        });
        adminState.delete(chatId);
        await bot!.sendMessage(chatId, [
          `\u{2705} *Qism qo'shildi!*`,
          ``,
          `\u{1F4FA} ${state.data.episodeNumber}-qism${state.data.episodeTitle ? `: ${state.data.episodeTitle}` : ""}`
        ].join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{2795} Yana qism qo'shish", callback_data: `add_episode_${movieId}` }],
              [{ text: "\u{25C0} Orqaga", callback_data: `episodes_${movieId}` }]
            ]
          }
        });
      } catch {
        adminState.delete(chatId);
        await bot!.sendMessage(chatId, "\u{274C} Xatolik yuz berdi.", {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: `episodes_${movieId}` }]]
          }
        });
      }
      return;
    }

    // Admin add movie step-by-step
    if (!isAdmin(chatId)) return;

    switch (state.step) {
      case "title":
        state.data.title = text;
        state.step = "description";
        await bot!.sendMessage(chatId, `\u{1F4C4} Kino haqida ta'rif yozing:`, {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]]
          }
        });
        break;
      case "description":
        state.data.description = text;
        state.step = "year";
        await bot!.sendMessage(chatId, `\u{1F4C5} Chiqarilgan yilini kiriting:`, {
          reply_markup: {
            inline_keyboard: [[{ text: "\u{23ED} O'tkazish", callback_data: "select_cat_skip_year" }]]
          }
        });
        break;
      case "year":
        state.data.releaseYear = Number(text) || null;
        state.step = "image";
        await bot!.sendMessage(chatId, `\u{1F5BC} Rasm URL kiriting yoki rasm yuboring:`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{23ED} O'tkazish", callback_data: "select_cat_skip_image" }],
              [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
            ]
          }
        });
        break;
      case "image":
        state.data.imageUrl = text;
        state.step = "video";
        await bot!.sendMessage(chatId, `\u{1F3AC} Video URL manzilini kiriting yoki video fayl yuboring:`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{23ED} O'tkazish", callback_data: "skip_video" }],
              [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
            ]
          }
        });
        break;
      case "video":
        let videoInput = text.trim();
        if (videoInput.includes("<iframe") || videoInput.includes("&lt;iframe")) {
          const srcMatch = videoInput.match(/src=["']([^"']+)["']/);
          if (srcMatch) {
            videoInput = srcMatch[1].startsWith("//") ? "https:" + srcMatch[1] : srcMatch[1];
          }
        }
        state.data.videoUrl = videoInput;
        state.step = "category";
        await showCategorySelection(chatId);
        break;
      case "category":
        const catId = Number(text);
        state.data.categoryId = isNaN(catId) ? null : catId;
        state.step = "confirm";
        const cats2 = await storage.getCategories();
        const catName = state.data.categoryId ? cats2.find(c => c.id === state.data.categoryId)?.name || "?" : "Yo'q";

        await bot!.sendMessage(chatId, [
          `\u{1F4DD} *Kino ma'lumotlari:*`,
          ``,
          `\u{1F3AC} Nomi: ${state.data.title}`,
          `\u{1F4C4} Ta'rif: ${state.data.description?.substring(0, 100)}...`,
          `\u{1F4C5} Yil: ${state.data.releaseYear || "?"}`,
          `\u{1F4C1} Kategoriya: ${catName}`,
          `\u{1F5BC} Rasm: ${state.data.imageUrl ? "Bor" : "Yo'q"}`,
          `\u{1F3AC} Video: ${state.data.videoUrl ? "Bor" : "Yo'q"}`
        ].join("\n"), {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "\u{2705} Tasdiqlash", callback_data: "confirm_add_yes" },
                { text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }
              ]
            ]
          }
        });
        break;
    }
  });

  // Handle skip callbacks during add_movie
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;
    const data = query.data || "";

    if (data === "select_cat_skip_year") {
      const state = adminState.get(chatId);
      if (!state) return;
      try { await bot!.answerCallbackQuery(query.id); } catch (e) {}
      state.data.releaseYear = null;
      state.step = "image";
      await bot!.sendMessage(chatId, `\u{1F5BC} Rasm URL kiriting yoki rasm yuboring:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{23ED} O'tkazish", callback_data: "select_cat_skip_image" }],
            [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
          ]
        }
      });
      return;
    }

    if (data === "select_cat_skip_image") {
      const state = adminState.get(chatId);
      if (!state) return;
      try { await bot!.answerCallbackQuery(query.id); } catch (e) {}
      state.data.imageUrl = null;
      state.step = "video";
      await bot!.sendMessage(chatId, `\u{1F3AC} Video URL manzilini kiriting yoki video fayl yuboring:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{23ED} O'tkazish", callback_data: "skip_video" }],
            [{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]
          ]
        }
      });
      return;
    }

    if (data === "skip_video") {
      const state = adminState.get(chatId);
      if (!state) return;
      try { await bot!.answerCallbackQuery(query.id); } catch (e) {}
      state.data.videoUrl = null;
      state.step = "category";
      await showCategorySelection(chatId);
      return;
    }
  });

  async function showCategorySelection(chatId: number) {
    const cats = await storage.getCategories();
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    if (cats.length > 0) {
      for (let i = 0; i < cats.length; i += 2) {
        const row: TelegramBot.InlineKeyboardButton[] = [
          { text: cats[i].name, callback_data: `select_cat_${cats[i].id}` }
        ];
        if (cats[i + 1]) {
          row.push({ text: cats[i + 1].name, callback_data: `select_cat_${cats[i + 1].id}` });
        }
        keyboard.push(row);
      }
    }
    keyboard.push([{ text: "\u{23ED} O'tkazish", callback_data: "select_cat_skip" }]);
    keyboard.push([{ text: "\u{274C} Bekor qilish", callback_data: "admin_cancel" }]);

    await bot!.sendMessage(chatId, `\u{1F4C1} *Kategoriyani tanlang:*`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // Help for users
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    if (isAdmin(chatId)) {
      await sendAdminMenu(chatId);
    } else {
      await sendUserMenu(chatId);
    }
  });

  bot.onText(/\/movies/, async (msg) => {
    const chatId = msg.chat.id;
    const movies = await storage.getMovies();
    if (movies.length === 0) {
      await bot!.sendMessage(chatId, "\u{1F4ED} Hozircha kinolar yo'q.");
      return;
    }
    const keyboard: TelegramBot.InlineKeyboardButton[][] = movies.slice(0, 20).map(movie => [{
      text: `${movie.title} (${movie.releaseYear || "?"}) ${movie.rating ? `\u{2B50}${movie.rating.toFixed(1)}` : ""}`,
      callback_data: `view_movie_${movie.id}`
    }]);
    keyboard.push([{ text: "\u{25C0} Bosh menyu", callback_data: isAdmin(chatId) ? "admin_menu" : "user_menu" }]);

    await bot!.sendMessage(chatId, `\u{1F3AC} *Kinolar:*`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });
  });
}
