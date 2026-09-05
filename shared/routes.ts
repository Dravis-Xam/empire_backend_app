import { z } from 'zod';
import type { InsertDelivery, InsertNotification, InsertOrder, InsertProduct, InsertUser } from './schema';
import { deliveries, insertDeliverySchema, insertOrderSchema, insertPaymentSchema, insertProductSchema, insertSaleSchema, insertUserSchema, notifications, orders, products, purchaseOrders, users } from './schema';

export type { InsertDelivery, InsertNotification, InsertOrder, InsertProduct, InsertUser };


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
    getItem: {
      method: 'GET' as const,
      path: '/api/barcode/fetch-item/:barcode',
      responses: {
        200: z.custom<typeof products.$inferSelect>(),  // was z.array(...)
        404: errorSchemas.notFound,
      },
    },
    getProductsUsingBarcodes: {
      method: 'POST' as const,
      path: '/api/products/barcodes',
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect>()),
        404: errorSchemas.notFound
      }
    },
    createUsingMultipleBarcodes: {
      method: 'POST' as const,
      path: '/api/products/createwithbarcodes',
      input: z.array(insertProductSchema),
      responses: {
        201: z.array(z.custom<typeof products.$inferSelect>()),
        404: errorSchemas.notFound
      }
    },
    createUsingBarcode: {
      method: 'POST' as const,
      path: '/api/products/barcode/create-item',
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products/',
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    createBulk: {
      method: 'POST' as const,
      path: '/api/products/bulk',
      input: z.array(insertProductSchema),
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
    updateByBarcode: {
      method: 'PATCH' as const,
      path: '/api/products/barcode/:barcode',
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
    deleteBulk: {
      method: "POST" as const,
      path: '/api/products/delete/barcode',
      input: z.object({ barcodes: z.array(z.string()).min(1) }),
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }
    },
    deleteBulkId: {
      method: "POST" as const,
      path: "/api/products/delete/id",
      input: z.object({ ids: z.array(z.number().int()).min(1) }),
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }

    }
  },
  orders: {
    list: {
      method: 'GET' as const,
      path: '/api/orders',
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect>()),
      },
    },
    createSale: {
      method: 'POST' as const,
      path: '/api/orders/create-sale',
      input: insertSaleSchema,
      responses: {
        201: z.custom<typeof orders.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    createPayment: {
      method: 'POST' as const,
      path: '/api/orders/purchase',
      input: insertPaymentSchema,
      responses: {
        201: z.custom<typeof orders.$inferSelect>(),
        400: errorSchemas.validation,
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
  purchaseOrders: {
    list: {
      method: 'GET' as const,
      path: '/api/purchase-orders',
      responses: {
        200: z.array(z.custom<typeof purchaseOrders.$inferSelect>()),
      },
    },
    getItem: {
      method: 'GET' as const,
      path: '/api/purchase-orders/:id',
      responses: {
        200: z.custom<typeof purchaseOrders.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/purchase-orders',
      input: z.object({
        supplierName: z.string(),
        supplierEmail: z.string().email().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          quantity: z.number().min(1),
          unitCost: z.number().min(0),
        })),
      }),
      responses: {
        201: z.custom<typeof purchaseOrders.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    validate: {
      method: 'POST' as const,
      path: '/api/purchase-orders/:id/validate',
      responses: {
        200: z.custom<typeof purchaseOrders.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    send: {
      method: 'POST' as const,
      path: '/api/purchase-orders/:id/send',
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    complete: {
      method: 'POST' as const,
      path: '/api/purchase-orders/:id/complete',
      responses: {
        200: z.custom<typeof purchaseOrders.$inferSelect>(),
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
