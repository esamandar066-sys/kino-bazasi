import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_ID = Number(process.env.TELEGRAM_ADMIN_ID!);

let bot: TelegramBot | null = null;
let botUsername: string = "";
const userChatIds: Map<string, number> = new Map();

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

  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.getMe().then((me) => {
    botUsername = me.username || "";
    console.log(`Telegram bot started: @${botUsername}`);
  });

  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match?.[1]?.trim();

    if (param && param.startsWith("verify_")) {
      const phoneNumber = param.replace("verify_", "");
      userChatIds.set(phoneNumber, chatId);

      await storage.upsertUserByPhone(phoneNumber, String(chatId));

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
            { text: "\u{1F465} Foydalanuvchi rejimi", callback_data: "user_menu" }
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

    const text = [
      `\u{1F3AC} *${movie.title}*`,
      ``,
      `\u{1F4C5} Yil: ${year}`,
      `\u{1F4C1} Kategoriya: ${catName}`,
      `\u{2B50} Reyting: ${rating} (${movie.ratingCount || 0} baho)`,
      ``,
      `${movie.description?.substring(0, 200)}${movie.description?.length > 200 ? "..." : ""}`
    ].join("\n");

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "\u{1F440} Batafsil ko'rish", url: appUrl }]
    ];

    if (showAdminButtons) {
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
    await bot!.answerCallbackQuery(query.id);

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
      const topMovies = [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);

      let topText = "";
      topMovies.forEach((m, i) => {
        topText += `  ${i + 1}. ${m.title} - \u{2B50}${m.rating?.toFixed(1) || "0"}\n`;
      });

      await bot!.sendMessage(chatId, [
        `\u{1F4CA} *Statistika*`,
        ``,
        `\u{1F3AC} Kinolar: ${movies.length}`,
        `\u{1F4C1} Kategoriyalar: ${cats.length}`,
        ``,
        `\u{1F3C6} *Top kinolar:*`,
        topText || "  Hozircha baholangan kino yo'q"
      ].join("\n"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{25C0} Orqaga", callback_data: "admin_menu" }]]
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
        `\u{1F5BC} Rasm: ${state.data.imageUrl ? "Bor" : "Yo'q"}`
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

    if (data === "confirm_add_yes") {
      const state = adminState.get(chatId);
      if (!state || state.step !== "confirm") return;

      try {
        const movie = await storage.createMovie({
          title: state.data.title,
          description: state.data.description,
          releaseYear: state.data.releaseYear,
          imageUrl: state.data.imageUrl,
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
  });

  // Handle text messages for step-by-step flows and movie lookup by ID
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    if (msg.text?.startsWith("/")) return;

    const text = msg.text || "";
    const state = adminState.get(chatId);

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
        await bot!.sendMessage(chatId, `\u{1F5BC} Rasm URL manzilini kiriting:`, {
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
          `\u{1F5BC} Rasm: ${state.data.imageUrl ? "Bor" : "Yo'q"}`
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
      await bot!.answerCallbackQuery(query.id);
      state.data.releaseYear = null;
      state.step = "image";
      await bot!.sendMessage(chatId, `\u{1F5BC} Rasm URL manzilini kiriting:`, {
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
      await bot!.answerCallbackQuery(query.id);
      state.data.imageUrl = null;
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
