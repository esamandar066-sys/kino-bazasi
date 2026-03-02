import { pgTable, text, serial, integer, timestamp, varchar, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const movies = pgTable("movies", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  releaseYear: integer("release_year"),
  categoryId: integer("category_id"),
  userId: varchar("user_id").notNull(),
  rating: real("rating").default(0),
  ratingCount: integer("rating_count").default(0),
  isSerial: boolean("is_serial").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(),
  movieId: integer("movie_id").notNull(),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title"),
  videoUrl: text("video_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  movieId: integer("movie_id").notNull(),
  userId: varchar("user_id").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMovieSchema = createInsertSchema(movies).omit({ id: true, createdAt: true, userId: true, rating: true, ratingCount: true }).extend({
  videoUrl: z.string().nullable().optional().refine(
    (val) => !val || val.startsWith("/uploads/") || val.startsWith("https://") || val.startsWith("http://"),
    { message: "Video URL noto'g'ri formatda" }
  ),
});
export const insertEpisodeSchema = createInsertSchema(episodes).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });

export type Movie = typeof movies.$inferSelect;
export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type UpdateMovieRequest = Partial<InsertMovie>;
export type Category = typeof categories.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;

export type MovieResponse = Movie & {
  user?: { email: string | null; firstName: string | null; lastName: string | null };
  category?: { id: number; name: string } | null;
};
