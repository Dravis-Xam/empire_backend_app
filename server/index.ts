import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
//import { serveStatic } from "./static";
import { createServer } from "http";
//import { setupAuth } from "./auth"; // Ensure this is imported here if it's not handled inside registerRoutes
import axios from 'axios';

const app = express();

// 1. Trust Render's upstream proxy headers (Crucial for secure session cookies)
const isProduction = process.env.NODE_ENV === "production" || app.get("env") === "production";
if (isProduction) {
  app.set("trust proxy", 1);
}

// 2. Strict CORS Configuration - Explicitly map your frontend origin
const allowedOrigins = [
  "https://empire-cp-1.vercel.app",
  "https://empire-cp-1.vercel.app/", // Accommodates trailing slashes cleanly
  process.env.FRONTEND_URI,
  process.env.LIVE_FRONTEND_URI
].filter(Boolean) as string[]; // Filters out undefined variables

// 2. Configure dynamic origin mapping
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests or matching origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`[CORS Error] Request blocked for origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Essential for session cookies over subdomains
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
}));

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// 3. Body Parsers must come BEFORE authentication and routing
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

// 4. Initialize Auth Session Layer here (If registerRoutes doesn't do it first thing)
// setupAuth(app); 

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const KEEP_ALIVE_URL = "https://empire-backend-app.onrender.com/api/health";

function startKeepAliveJob() {
  // 600,000 milliseconds = 10 minutes
  setInterval(async () => {
    try {
      console.log(`[Cron Job] Sending keep-alive ping to ${KEEP_ALIVE_URL}...`);
      const response = await axios.get(KEEP_ALIVE_URL);
      console.log(`[Cron Job] Server responded with status: ${response.status}`);
    } catch (error: any) {
      console.error(`[Cron Job] Keep-alive ping failed: ${error.message}`);
    }
  }, 600000); 
}

// Logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Routes and error handlers
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port },
    () => {
      log(`serving on port ${port}`);

      startKeepAliveJob();
    },
  );
})();