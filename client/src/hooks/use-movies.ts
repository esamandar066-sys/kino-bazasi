import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertMovie, MovieResponse, UpdateMovieRequest, Category, Episode } from "@shared/schema";

export function useMovies() {
  return useQuery({
    queryKey: [api.movies.list.path],
    queryFn: async () => {
      const res = await fetch(api.movies.list.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch movies");
      }
      return (await res.json()) as MovieResponse[];
    },
  });
}

export function useSearchMovies(query: string, categoryId?: number) {
  return useQuery({
    queryKey: [api.movies.search.path, query, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (categoryId) params.set("categoryId", String(categoryId));
      const res = await fetch(`${api.movies.search.path}?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search movies");
      return (await res.json()) as MovieResponse[];
    },
    enabled: !!(query || categoryId),
  });
}

export function useMovie(id: number) {
  return useQuery({
    queryKey: [api.movies.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.movies.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch movie");
      return (await res.json()) as MovieResponse;
    },
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: [api.categories.list.path],
    queryFn: async () => {
      const res = await fetch(api.categories.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return (await res.json()) as Category[];
    },
  });
}

export function useCreateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertMovie) => {
      const res = await fetch(api.movies.create.path, {
        method: api.movies.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to create movie" }));
        throw new Error(error.message || "Failed to create movie");
      }
      return (await res.json()) as MovieResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.movies.list.path] });
    },
  });
}

export function useUpdateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateMovieRequest) => {
      const url = buildUrl(api.movies.update.path, { id });
      const res = await fetch(url, {
        method: api.movies.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to update movie" }));
        throw new Error(error.message || "Failed to update movie");
      }
      return (await res.json()) as MovieResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.movies.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.movies.get.path, data.id] });
    },
  });
}

export function useDeleteMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.movies.delete.path, { id });
      const res = await fetch(url, {
        method: api.movies.delete.method,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to delete movie" }));
        throw new Error(error.message || "Failed to delete movie");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.movies.list.path] });
    },
  });
}

export function useEpisodes(movieId: number) {
  return useQuery({
    queryKey: ['/api/movies', movieId, 'episodes'],
    queryFn: async () => {
      const res = await fetch(`/api/movies/${movieId}/episodes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch episodes");
      return (await res.json()) as Episode[];
    },
    enabled: !!movieId,
  });
}

export function useRateMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, score }: { id: number; score: number }) => {
      const url = buildUrl(api.movies.rate.path, { id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to rate movie" }));
        throw new Error(error.message || "Failed to rate movie");
      }
      return (await res.json()) as MovieResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.movies.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.movies.get.path, data.id] });
    },
  });
}
