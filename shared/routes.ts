import { z } from 'zod';
import { insertMovieSchema } from './schema';

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
        200: z.array(z.custom<any>()),
      },
    },
    search: {
      method: 'GET' as const,
      path: '/api/movies/search' as const,
      input: z.object({ q: z.string().optional(), categoryId: z.string().optional() }),
      responses: {
        200: z.array(z.custom<any>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/movies/:id' as const,
      responses: {
        200: z.custom<any>(),
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
    rate: {
      method: 'POST' as const,
      path: '/api/movies/:id/rate' as const,
      input: z.object({ score: z.number().min(1).max(5) }),
      responses: {
        200: z.custom<any>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories' as const,
      responses: {
        200: z.array(z.custom<any>()),
      },
    },
  },
  phoneAuth: {
    sendCode: {
      method: 'POST' as const,
      path: '/api/auth/phone/send-code' as const,
      input: z.object({ phoneNumber: z.string().min(9), telegramUsername: z.string().min(1) }),
      responses: {
        200: z.object({ message: z.string(), telegramBotUrl: z.string() }),
        400: errorSchemas.validation,
      },
    },
    verifyCode: {
      method: 'POST' as const,
      path: '/api/auth/phone/verify' as const,
      input: z.object({ phoneNumber: z.string(), code: z.string().length(6) }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
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
