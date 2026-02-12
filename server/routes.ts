import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { ROLES, type InsertUser } from "@shared/schema";
import { pay, send_invoice_email } from "./pay";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Set up authentication (passport)
  setupAuth(app);

  // === SEED DATA ===
  await seedDatabase();

  // === PROTECTED ROUTE MIDDLEWARE ===
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  // === API ROUTES ===

  // PRODUCTS
  app.get(api.products.list.path, async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.post(api.products.create.path, requireAuth, async (req, res) => {
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
  });

  app.patch(api.products.update.path, requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const product = await storage.updateProduct(id, req.body);
    res.json(product);
  });

  app.delete(api.products.delete.path, requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await storage.deleteProduct(id);
    res.status(204).send();
  });

  // ORDERS
  app.get(api.orders.list.path, requireAuth, async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.post(api.orders.create.path, async (req, res) => {
    const input = api.orders.create.input.parse(req.body);
    const order = await storage.createOrder(input);

    // Create delivery if notification needed or just notify logic
    send_invoice_email(order);
    // Auto-create delivery for simplified logic
    await storage.createDelivery({
      orderId: order.id,
      status: 'pending',
      trackingInfo: `TRK-${Date.now()}`
    });

    res.status(201).json(order);
  });

  app.patch(api.orders.updateStatus.path, requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const input = api.orders.updateStatus.input.parse(req.body);

    if (req.body?.amount && req.body?.phone) {
      await pay(req.body);
    }

    const order = await storage.updateOrderStatus(id, input.status);
    res.json(order);
  });

  // DELIVERIES
  app.get(api.deliveries.list.path, requireAuth, async (req, res) => {
    const deliveries = await storage.getDeliveries();
    res.json(deliveries);
  });

  app.patch(api.deliveries.update.path, requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const delivery = await storage.updateDelivery(id, req.body);
    res.json(delivery);
  });

  // NOTIFICATIONS
  app.get(api.notifications.list.path, requireAuth, async (req, res) => {
    // Assuming req.user is populated by passport
    const userId = (req.user as any).id;
    const notes = await storage.getNotifications(userId);
    res.json(notes);
  });

  // CALLBACKS
  app.post(api.callbacks.mpesa.path, async (_req, res) => {
    res.status(200).json({ message: "M-Pesa callback received" });
  });

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
