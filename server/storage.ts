import { movies, categories, ratings, type MovieResponse, type UpdateMovieRequest, type Category } from "@shared/schema";
import { verificationCodes, users, type VerificationCode, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, ilike, and, sql } from "drizzle-orm";

export interface IStorage {
  getMovies(): Promise<MovieResponse[]>;
  getMovie(id: number): Promise<MovieResponse | undefined>;
  searchMovies(query?: string, categoryId?: number): Promise<MovieResponse[]>;
  createMovie(movie: { title: string; description: string; imageUrl?: string | null; releaseYear?: number | null; categoryId?: number | null; userId: string }): Promise<MovieResponse>;
  updateMovie(id: number, updates: UpdateMovieRequest): Promise<MovieResponse>;
  deleteMovie(id: number): Promise<void>;
  rateMovie(movieId: number, userId: string, score: number): Promise<MovieResponse>;
  getCategories(): Promise<Category[]>;
  createCategory(name: string): Promise<Category>;
  createVerificationCode(phoneNumber: string, code: string): Promise<VerificationCode>;
  getLatestVerificationCode(phoneNumber: string): Promise<VerificationCode | undefined>;
  updateVerificationCodeChatId(id: number, chatId: string): Promise<void>;
  verifyCode(phoneNumber: string, code: string): Promise<boolean>;
  verifyViaTelegram(phoneNumber: string, code: string): Promise<string | null>;
  checkTelegramVerification(phoneNumber: string): Promise<{ verified: boolean; loginToken?: string }>;
  consumeLoginToken(token: string): Promise<string | null>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  upsertUserByPhone(phoneNumber: string, telegramChatId?: string): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getMovies(): Promise<MovieResponse[]> {
    const results = await db
      .select({
        movie: movies,
        user: {
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        category: {
          id: categories.id,
          name: categories.name,
        },
      })
      .from(movies)
      .leftJoin(users, eq(movies.userId, users.id))
      .leftJoin(categories, eq(movies.categoryId, categories.id))
      .orderBy(desc(movies.createdAt));

    return results.map(row => ({
      ...row.movie,
      user: row.user || undefined,
      category: row.category || null,
    }));
  }

  async getMovie(id: number): Promise<MovieResponse | undefined> {
    const results = await db
      .select({
        movie: movies,
        user: {
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        category: {
          id: categories.id,
          name: categories.name,
        },
      })
      .from(movies)
      .leftJoin(users, eq(movies.userId, users.id))
      .leftJoin(categories, eq(movies.categoryId, categories.id))
      .where(eq(movies.id, id));

    if (results.length === 0) return undefined;

    return {
      ...results[0].movie,
      user: results[0].user || undefined,
      category: results[0].category || null,
    };
  }

  async searchMovies(query?: string, categoryId?: number): Promise<MovieResponse[]> {
    const conditions = [];
    if (query) {
      conditions.push(ilike(movies.title, `%${query}%`));
    }
    if (categoryId) {
      conditions.push(eq(movies.categoryId, categoryId));
    }

    const results = await db
      .select({
        movie: movies,
        user: {
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        category: {
          id: categories.id,
          name: categories.name,
        },
      })
      .from(movies)
      .leftJoin(users, eq(movies.userId, users.id))
      .leftJoin(categories, eq(movies.categoryId, categories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(movies.createdAt));

    return results.map(row => ({
      ...row.movie,
      user: row.user || undefined,
      category: row.category || null,
    }));
  }

  async createMovie(insertMovie: { title: string; description: string; imageUrl?: string | null; releaseYear?: number | null; categoryId?: number | null; userId: string }): Promise<MovieResponse> {
    const [movie] = await db
      .insert(movies)
      .values(insertMovie)
      .returning();

    return this.getMovie(movie.id) as Promise<MovieResponse>;
  }

  async updateMovie(id: number, updates: UpdateMovieRequest): Promise<MovieResponse> {
    await db
      .update(movies)
      .set(updates)
      .where(eq(movies.id, id));

    return this.getMovie(id) as Promise<MovieResponse>;
  }

  async deleteMovie(id: number): Promise<void> {
    await db.delete(ratings).where(eq(ratings.movieId, id));
    await db.delete(movies).where(eq(movies.id, id));
  }

  async rateMovie(movieId: number, userId: string, score: number): Promise<MovieResponse> {
    const existing = await db
      .select()
      .from(ratings)
      .where(and(eq(ratings.movieId, movieId), eq(ratings.userId, userId)));

    if (existing.length > 0) {
      await db.update(ratings).set({ score }).where(eq(ratings.id, existing[0].id));
    } else {
      await db.insert(ratings).values({ movieId, userId, score });
    }

    const allRatings = await db.select().from(ratings).where(eq(ratings.movieId, movieId));
    const avg = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;

    await db.update(movies).set({
      rating: Math.round(avg * 10) / 10,
      ratingCount: allRatings.length,
    }).where(eq(movies.id, movieId));

    return this.getMovie(movieId) as Promise<MovieResponse>;
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(name: string): Promise<Category> {
    const [cat] = await db.insert(categories).values({ name }).returning();
    return cat;
  }

  async createVerificationCode(phoneNumber: string, code: string): Promise<VerificationCode> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const [vc] = await db
      .insert(verificationCodes)
      .values({ phoneNumber, code, expiresAt })
      .returning();
    return vc;
  }

  async getLatestVerificationCode(phoneNumber: string): Promise<VerificationCode | undefined> {
    const results = await db
      .select()
      .from(verificationCodes)
      .where(and(eq(verificationCodes.phoneNumber, phoneNumber), eq(verificationCodes.used, "false")))
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);
    return results[0];
  }

  async updateVerificationCodeChatId(id: number, chatId: string): Promise<void> {
    await db.update(verificationCodes).set({ telegramChatId: chatId }).where(eq(verificationCodes.id, id));
  }

  async verifyCode(phoneNumber: string, code: string): Promise<boolean> {
    const results = await db
      .select()
      .from(verificationCodes)
      .where(and(
        eq(verificationCodes.phoneNumber, phoneNumber),
        eq(verificationCodes.code, code),
        eq(verificationCodes.used, "false")
      ))
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);

    if (results.length === 0) return false;

    const vc = results[0];
    if (new Date() > vc.expiresAt) return false;

    await db.update(verificationCodes).set({ used: "true" }).where(eq(verificationCodes.id, vc.id));
    return true;
  }

  async verifyViaTelegram(phoneNumber: string, code: string): Promise<string | null> {
    const results = await db
      .select()
      .from(verificationCodes)
      .where(and(
        eq(verificationCodes.phoneNumber, phoneNumber),
        eq(verificationCodes.code, code),
        eq(verificationCodes.used, "false")
      ))
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);

    if (results.length === 0) return null;

    const vc = results[0];
    if (new Date() > vc.expiresAt) return null;

    const token = crypto.randomUUID();
    await db.update(verificationCodes).set({
      used: "true",
      verifiedViaTelegram: "true",
      loginToken: token,
    }).where(eq(verificationCodes.id, vc.id));

    return token;
  }

  async checkTelegramVerification(phoneNumber: string): Promise<{ verified: boolean; loginToken?: string }> {
    const results = await db
      .select()
      .from(verificationCodes)
      .where(and(
        eq(verificationCodes.phoneNumber, phoneNumber),
        eq(verificationCodes.verifiedViaTelegram, "true"),
      ))
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);

    if (results.length === 0) return { verified: false };

    const vc = results[0];
    if (new Date() > vc.expiresAt) return { verified: false };
    if (!vc.loginToken) return { verified: false };

    return { verified: true, loginToken: vc.loginToken };
  }

  async consumeLoginToken(token: string): Promise<string | null> {
    const results = await db
      .select()
      .from(verificationCodes)
      .where(and(
        eq(verificationCodes.loginToken, token),
        eq(verificationCodes.verifiedViaTelegram, "true"),
      ))
      .limit(1);

    if (results.length === 0) return null;

    const vc = results[0];
    if (new Date() > vc.expiresAt) return null;

    await db.update(verificationCodes).set({ loginToken: null }).where(eq(verificationCodes.id, vc.id));

    return vc.phoneNumber;
  }

  async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return results[0];
  }

  async upsertUserByPhone(phoneNumber: string, telegramChatId?: string): Promise<User> {
    const existing = await this.getUserByPhone(phoneNumber);
    if (existing) {
      if (telegramChatId) {
        await db.update(users).set({ telegramChatId, updatedAt: new Date() }).where(eq(users.id, existing.id));
      }
      const updated = await this.getUserByPhone(phoneNumber);
      return updated!;
    }

    const [newUser] = await db.insert(users).values({
      phoneNumber,
      telegramChatId,
      firstName: phoneNumber,
    }).returning();
    return newUser;
  }
}

export const storage = new DatabaseStorage();
