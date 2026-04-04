import { z } from 'zod';
import { insertUserSchema, insertProductSchema, insertOrderSchema, insertDeliverySchema, insertNotificationSchema, users, products, orders, deliveries, notifications } from './schema';
import type { InsertUser, InsertProduct, InsertOrder, InsertDelivery, InsertNotification } from './schema';

export type { InsertUser, InsertProduct, InsertOrder, InsertDelivery, InsertNotification };

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
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products',
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products',
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/products/:id',
      input: insertProductSchema.partial(),
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/products/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  orders: {
    list: {
      method: 'GET' as const,
      path: '/api/orders',
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/orders',
      input: insertOrderSchema,
      responses: {
        201: z.custom<typeof orders.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/orders/:id/status',
      input: z.object({ status: z.string() }),
      responses: {
        200: z.custom<typeof orders.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  deliveries: {
    list: {
      method: 'GET' as const,
      path: '/api/deliveries',
      responses: {
        200: z.array(z.custom<typeof deliveries.$inferSelect>()),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/deliveries/:id',
      input: insertDeliverySchema.partial(),
      responses: {
        200: z.custom<typeof deliveries.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications',
      responses: {
        200: z.array(z.custom<typeof notifications.$inferSelect>()),
      },
    },
  },
  callbacks: {
    mpesa: {
      method: 'POST' as const,
      path: '/api/callbacks/mpesa',
      responses: {
        200: z.object({ message: z.string() }),
      },
      }
  }
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
