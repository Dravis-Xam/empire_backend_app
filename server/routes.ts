import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { ROLES, type InsertUser } from "@shared/schema";
import { pay, send_invoice_email } from "./pay";
import { wrapAsync } from "./error";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Set up authentication (passport)
  setupAuth(app);

  // === SEED DATA ===
  await seedDatabase();

  
  //health route
  app.get("/api/health", wrapAsync(async (_req, res) => {
    res.json("we are doing okay");
  }));

  // === PROTECTED ROUTE MIDDLEWARE ===
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  // === API ROUTES ===

  // PRODUCTS
  app.get(api.products.list.path, wrapAsync(async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  }));

  app.post(api.products.create.path, requireAuth, wrapAsync(async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  }));

  app.patch(api.products.update.path, requireAuth, wrapAsync(async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const product = await storage.updateProduct(id, req.body);
    res.json(product);
  }));

  app.delete(api.products.delete.path, requireAuth, wrapAsync(async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await storage.deleteProduct(id);
    res.status(204).send();
  }));

  // ORDERS
  app.get(api.orders.list.path, requireAuth, wrapAsync(async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  }));

  //make an order
  app.post(api.orders.create.path, requireAuth, wrapAsync(async (req, res) => {
    try {
      const input = api.orders.create.input.parse(req.body);
      const order = await storage.createOrder(input);

      const userid = (req.user as any).id;

      // If payment details are provided, initiate payment and return checkout URL
      let paymentResult: any = null;
      if (req.body?.amount && req.body?.phone) {
        paymentResult = await pay({ amount: Number(req.body.amount), phone: String(req.body.phone), userid, orderId: order.id });
      }

      const username = await storage.getUser(order.userId).then(value => value?.name)
      storage.createNotification({
        userId: order.userId,
        message: `Hey ${username}, you have made a new order. <a href="/orders/${order.id}">Tap here to view details</a> For any inquiries or complaints, call us or sms to <a href="0711489056">0711489056</a>`        
      })

      // If payment was NOT initiated, send invoice and auto-create delivery immediately.
      // If payment was initiated, `pay` already created a notification about the payment initiation.
      if (!paymentResult) {
        send_invoice_email(order);
        await storage.createDelivery({
          orderId: order.id,
          status: 'pending',
          trackingInfo: `TRK-${Date.now()}`
        });
        return res.status(201).json(order);
      }

      // Return order with payment info (checkout URL if available)
      return res.status(201).json({ order, payment: paymentResult });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
    }));

  app.patch(api.orders.updateStatus.path, requireAuth, wrapAsync(async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const input = api.orders.updateStatus.input.parse(req.body);
    const order = await storage.updateOrderStatus(id, input.status);
    res.json(order);
  }));

  // DELIVERIES
  app.get(api.deliveries.list.path, requireAuth, wrapAsync(async (req, res) => {
    const deliveries = await storage.getDeliveries();
    res.json(deliveries);
  }));

  app.patch(api.deliveries.update.path, requireAuth, wrapAsync(async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const delivery = await storage.updateDelivery(id, req.body);
    res.json(delivery);
  }));

  // NOTIFICATIONS
  app.get(api.notifications.list.path, requireAuth, wrapAsync(async (req, res) => {
    // Assuming req.user is populated by passport
    const userId = (req.user as any).id;
    const notes = await storage.getNotifications(userId);
    res.json(notes);
  }));

  // CALLBACKS
  app.post(api.callbacks.mpesa.path, wrapAsync(async (req, res) => {
    try {
      const body = req.body || {};

      // Try to determine orderId from common fields
      const orderId = Number(body.orderId || body.order_id || body?.data?.orderId || body?.data?.order_id);

      if (!Number.isNaN(orderId) && orderId > 0) {
        const payments = await storage.getPaymentsForOrder(orderId);
        if (payments && payments.length > 0) {
          const payment = payments[0];

          // Here we assume the callback represents a successful payment; in real integrations,
          // inspect the provider-specific payload to determine success/failure.
          await storage.updatePayment(payment.id, { status: 'completed', providerResponse: body as any });

          // Update order status to processing
          await storage.updateOrderStatus(orderId, 'processing');

          // Create delivery if none exists for the order
          const existingDelivery = await storage.getDeliveryByOrder(orderId);
          if (!existingDelivery) {
            await storage.createDelivery({
              orderId: orderId,
              status: 'pending',
              trackingInfo: `TRK-${Date.now()}`
            });
          }

          // Notify user
          await storage.createNotification({
            userId: payment.userId,
            message: `Payment received for order #${orderId}. Your order is being processed.`
          });
        }
      }

      return res.status(200).json({ message: 'M-Pesa callback processed' });
    } catch (err) {
      console.error('Callback processing failed:', err);
      return res.status(500).json({ message: 'Callback processing failed' });
    }
  }));

  return httpServer;
}

async function seedDatabase() {
  const existingUsers = await storage.getUserByUsername("admin");
  if (!existingUsers) {
    console.log("Seeding database...");
    
    // 1. Create Users for each Role
    const roles = Object.values(ROLES);
    for (const role of roles) {
      await storage.createUser({
        username: role,
        password: role, // In real app, this would be hashed by auth layer, but here we'll handle it
        role: role,
        name: `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
        email: `${role}@example.com`
      });
    }

    // 2. Create Products
    await storage.createProduct({
      name: "iPhone 15 Pro",
      description: "The latest iPhone",
      price: "999.00",
      category: "phone",
      stock: 50,
      imageUrl: "https://images.unsplash.com/photo-1696446701796-da61225697cc?w=800&q=80"
    });
    
    await storage.createProduct({
      name: "MacBook Air M3",
      description: "Super thin, super fast",
      price: "1299.00",
      category: "laptop",
      stock: 20,
      imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca4?w=800&q=80"
    });

    await storage.createProduct({
      name: "AirPods Pro",
      description: "Noise cancelling earbuds",
      price: "249.00",
      category: "accessory",
      stock: 100,
      imageUrl: "https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=800&q=80"
    });

    console.log("Seeding complete!");
  }
}
