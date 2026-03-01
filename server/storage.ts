import { movies, type MovieResponse, type UpdateMovieRequest } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { users } from "@shared/models/auth";

export interface IStorage {
  getMovies(): Promise<MovieResponse[]>;
  getMovie(id: number): Promise<MovieResponse | undefined>;
  createMovie(movie: { title: string; description: string; imageUrl?: string | null; releaseYear?: number | null; userId: string }): Promise<MovieResponse>;
  updateMovie(id: number, updates: UpdateMovieRequest): Promise<MovieResponse>;
  deleteMovie(id: number): Promise<void>;
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
      })
      .from(movies)
      .leftJoin(users, eq(movies.userId, users.id))
      .orderBy(desc(movies.createdAt));
      
    return results.map(row => ({
      ...row.movie,
      user: row.user || undefined
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
      })
      .from(movies)
      .leftJoin(users, eq(movies.userId, users.id))
      .where(eq(movies.id, id));
      
    if (results.length === 0) return undefined;
    
    return {
      ...results[0].movie,
      user: results[0].user || undefined
    };
  }

  async createMovie(insertMovie: { title: string; description: string; imageUrl?: string | null; releaseYear?: number | null; userId: string }): Promise<MovieResponse> {
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
    await db
      .delete(movies)
      .where(eq(movies.id, id));
  }
}

export const storage = new DatabaseStorage();
