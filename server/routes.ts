import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { setupAuth } from "./replit_integrations/auth/replitAuth";
import { api } from "@shared/routes";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Set up authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.movies.list.path, async (req, res) => {
    const movies = await storage.getMovies();
    res.json(movies);
  });

  app.get(api.movies.get.path, async (req, res) => {
    const movie = await storage.getMovie(Number(req.params.id));
    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }
    res.json(movie);
  });

  app.post(api.movies.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.movies.create.input.parse(req.body);
      const userId = req.user.claims.sub;
      
      const movie = await storage.createMovie({
        ...input,
        userId
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

  app.put(api.movies.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const movie = await storage.getMovie(id);
      
      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      if (movie.userId !== req.user.claims.sub) {
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

  app.delete(api.movies.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const movie = await storage.getMovie(id);
      
      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }

      if (movie.userId !== req.user.claims.sub) {
        return res.status(401).json({ message: "Unauthorized to delete this movie" });
      }

      await storage.deleteMovie(id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete movie" });
    }
  });

  return httpServer;
}
