import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_ID = Number(process.env.TELEGRAM_ADMIN_ID!);

let bot: TelegramBot | null = null;
let botUsername: string = "";

export function getBotUsername(): string {
  return botUsername;
}

export function getBot(): TelegramBot | null {
  return bot;
}

export async function sendVerificationCode(chatId: string, code: string): Promise<boolean> {
  if (!bot) return false;
  try {
    await bot.sendMessage(
      Number(chatId),
      `Sizning tasdiqlash kodingiz: *${code}*\n\nKod 5 daqiqa ichida amal qiladi.`,
      { parse_mode: "Markdown" }
    );
    return true;
  } catch (err) {
    console.error("Failed to send verification code via Telegram:", err);
    return false;
  }
}

function isAdmin(chatId: number): boolean {
  return chatId === ADMIN_ID;
}

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
      const pendingCode = await storage.getLatestVerificationCode(phoneNumber);

      if (pendingCode) {
        await storage.updateVerificationCodeChatId(pendingCode.id, String(chatId));
        await bot!.sendMessage(
          chatId,
          `Salom! Sizning telefon raqamingiz: *${phoneNumber}*\n\nTasdiqlash kodingiz: *${pendingCode.code}*\n\nKodni ilovaga kiriting.`,
          { parse_mode: "Markdown" }
        );
      } else {
        await bot!.sendMessage(chatId, "Tasdiqlash kodi topilmadi. Iltimos, qaytadan urinib ko'ring.");
      }
      return;
    }

    if (isAdmin(chatId)) {
      await bot!.sendMessage(
        chatId,
        `Salom, Admin! Kinolar ilovasini boshqarish uchun quyidagi buyruqlardan foydalaning:\n\n` +
        `/add_movie - Yangi kino qo'shish\n` +
        `/list_movies - Kinolar ro'yxati\n` +
        `/delete_movie [id] - Kinoni o'chirish\n` +
        `/categories - Kategoriyalar ro'yxati\n` +
        `/add_category [nomi] - Yangi kategoriya qo'shish\n` +
        `/stats - Statistika\n` +
        `/help - Yordam`,
        { parse_mode: "Markdown" }
      );
    } else {
      await bot!.sendMessage(
        chatId,
        "Salom! Kinolar ilovasiga xush kelibsiz.\n\nTasdiqlash kodi olish uchun ilovadan telefon raqamingizni kiriting."
      );
    }
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
      await bot!.sendMessage(chatId, "Bu bot faqat tasdiqlash kodlarini yuborish uchun ishlatiladi.");
      return;
    }
    await bot!.sendMessage(
      chatId,
      `Admin buyruqlari:\n\n` +
      `/add_movie - Yangi kino qo'shish (qadam-baqadam)\n` +
      `/list_movies - Barcha kinolar ro'yxati\n` +
      `/delete_movie [id] - Kinoni o'chirish\n` +
      `/categories - Kategoriyalar ro'yxati\n` +
      `/add_category [nomi] - Yangi kategoriya\n` +
      `/stats - Statistika`
    );
  });

  const adminState: Map<number, { step: string; data: any }> = new Map();

  bot.onText(/\/add_movie/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
      await bot!.sendMessage(chatId, "Bu buyruq faqat admin uchun.");
      return;
    }
    adminState.set(chatId, { step: "title", data: {} });
    await bot!.sendMessage(chatId, "Kino nomini kiriting:");
  });

  bot.onText(/\/list_movies/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const movies = await storage.getMovies();
    if (movies.length === 0) {
      await bot!.sendMessage(chatId, "Hozircha kinolar yo'q.");
      return;
    }

    let text = "Kinolar ro'yxati:\n\n";
    for (const movie of movies) {
      const catName = movie.category?.name || "Kategoriyasiz";
      text += `*${movie.id}.* ${movie.title} (${movie.releaseYear || "?"}) - ${catName}\n`;
    }
    await bot!.sendMessage(chatId, text, { parse_mode: "Markdown" });
  });

  bot.onText(/\/delete_movie (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const id = Number(match?.[1]);
    if (isNaN(id)) {
      await bot!.sendMessage(chatId, "ID raqam bo'lishi kerak. Masalan: /delete_movie 1");
      return;
    }

    try {
      const movie = await storage.getMovie(id);
      if (!movie) {
        await bot!.sendMessage(chatId, `${id}-ID bilan kino topilmadi.`);
        return;
      }
      await storage.deleteMovie(id);
      await bot!.sendMessage(chatId, `"${movie.title}" kinosi o'chirildi.`);
    } catch (err) {
      await bot!.sendMessage(chatId, "Xatolik yuz berdi.");
    }
  });

  bot.onText(/\/categories/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const cats = await storage.getCategories();
    if (cats.length === 0) {
      await bot!.sendMessage(chatId, "Kategoriyalar yo'q. /add_category [nomi] bilan qo'shing.");
      return;
    }
    let text = "Kategoriyalar:\n\n";
    for (const cat of cats) {
      text += `${cat.id}. ${cat.name}\n`;
    }
    await bot!.sendMessage(chatId, text);
  });

  bot.onText(/\/add_category (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const name = match?.[1]?.trim();
    if (!name) {
      await bot!.sendMessage(chatId, "Kategoriya nomini kiriting. Masalan: /add_category Drama");
      return;
    }

    try {
      const cat = await storage.createCategory(name);
      await bot!.sendMessage(chatId, `"${cat.name}" kategoriyasi qo'shildi (ID: ${cat.id}).`);
    } catch (err) {
      await bot!.sendMessage(chatId, "Bu kategoriya allaqachon mavjud yoki xatolik yuz berdi.");
    }
  });

  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const movies = await storage.getMovies();
    const cats = await storage.getCategories();
    await bot!.sendMessage(
      chatId,
      `Statistika:\n\nKinolar soni: ${movies.length}\nKategoriyalar: ${cats.length}`
    );
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    if (msg.text?.startsWith("/")) return;

    const state = adminState.get(chatId);
    if (!state) return;

    const text = msg.text || "";

    switch (state.step) {
      case "title":
        state.data.title = text;
        state.step = "description";
        await bot!.sendMessage(chatId, "Kino haqida qisqacha ta'rif yozing:");
        break;
      case "description":
        state.data.description = text;
        state.step = "year";
        await bot!.sendMessage(chatId, "Chiqarilgan yilini kiriting (masalan: 2024):");
        break;
      case "year":
        state.data.releaseYear = Number(text) || null;
        state.step = "image";
        await bot!.sendMessage(chatId, "Rasm URL manzilini kiriting (yoki 'skip' deb yozing):");
        break;
      case "image":
        state.data.imageUrl = text.toLowerCase() === "skip" ? null : text;
        state.step = "category";
        const cats = await storage.getCategories();
        if (cats.length > 0) {
          let catList = "Kategoriyani tanlang (ID kiriting yoki 'skip'):\n\n";
          cats.forEach(c => catList += `${c.id}. ${c.name}\n`);
          await bot!.sendMessage(chatId, catList);
        } else {
          state.data.categoryId = null;
          state.step = "confirm";
          await bot!.sendMessage(
            chatId,
            `Kino ma'lumotlari:\nNomi: ${state.data.title}\nTa'rif: ${state.data.description}\nYil: ${state.data.releaseYear || "?"}\n\nTasdiqlash: "ha" yoki "yo'q"`,
          );
        }
        break;
      case "category":
        const catId = Number(text);
        state.data.categoryId = isNaN(catId) || text.toLowerCase() === "skip" ? null : catId;
        state.step = "confirm";
        await bot!.sendMessage(
          chatId,
          `Kino ma'lumotlari:\nNomi: ${state.data.title}\nTa'rif: ${state.data.description}\nYil: ${state.data.releaseYear || "?"}\nKategoriya ID: ${state.data.categoryId || "yo'q"}\n\nTasdiqlash: "ha" yoki "yo'q"`,
        );
        break;
      case "confirm":
        if (text.toLowerCase() === "ha") {
          try {
            const movie = await storage.createMovie({
              title: state.data.title,
              description: state.data.description,
              releaseYear: state.data.releaseYear,
              imageUrl: state.data.imageUrl,
              categoryId: state.data.categoryId,
              userId: String(ADMIN_ID),
            });
            await bot!.sendMessage(chatId, `"${movie?.title}" kinosi muvaffaqiyatli qo'shildi! (ID: ${movie?.id})`);
          } catch (err) {
            await bot!.sendMessage(chatId, "Xatolik yuz berdi. Qaytadan urinib ko'ring.");
          }
        } else {
          await bot!.sendMessage(chatId, "Bekor qilindi.");
        }
        adminState.delete(chatId);
        break;
    }
  });
}
