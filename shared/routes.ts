import { z } from 'zod';
import { insertMovieSchema, movies } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  movies: {
    list: {
      method: 'GET' as const,
      path: '/api/movies' as const,
      responses: {
        200: z.array(z.custom<any>()), // Will be MovieResponse
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/movies/:id' as const,
      responses: {
        200: z.custom<any>(), // Will be MovieResponse
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/movies' as const,
      input: insertMovieSchema,
      responses: {
        201: z.custom<any>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/movies/:id' as const,
      input: insertMovieSchema.partial(),
      responses: {
        200: z.custom<any>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/movies/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type MovieInput = z.infer<typeof api.movies.create.input>;
export type MovieUpdateInput = z.infer<typeof api.movies.update.input>;
export type ValidationError = z.infer<typeof errorSchemas.validation>;
export type NotFoundError = z.infer<typeof errorSchemas.notFound>;
