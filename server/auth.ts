import { api } from "@shared/routes";
import { User } from "@shared/schema";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { type Express } from "express";
import session from "express-session";
import jwt from 'jsonwebtoken';
import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import { promisify } from "util";
import { z } from "zod";
import { captureRedirectUri, getFrontendUrl } from "./auth-utils";
import { storage } from "./storage";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Render always runs behind a proxy and defaults NODE_ENV to production
  const isProduction = process.env.NODE_ENV === "production" || app.get("env") === "production";

  // Force Express to trust Render's reverse proxy headers (X-Forwarded-Proto, etc.)
  app.set("trust proxy", 1); 

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    proxy: true, // Hint to express-session that a proxy is trusted
    cookie: {
      httpOnly: true,
      secure: isProduction, // Must be true in production!
      sameSite: "lax", // Changed from "none" to "lax" for better compatibility
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  };

    // remove the global app.use(session...) / passport.initialize() / passport.session()
  const sessionMw = session(sessionSettings);
  app.use('/api', sessionMw, passport.initialize(), passport.session());

  // Apply the capture redirect middleware
  app.use(captureRedirectUri);

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/api/auth/google/callback",
        passReqToCallback: true, // Enable request in callback
      },
      async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          let user = await storage.getUserByGoogleId(profile.id);

          if (!user) {
            const email = profile.emails?.[0]?.value || "";

            if (!email) {
              throw new Error("Google profile did not return an email");
            }

            user = await storage.getUserByEmail(email);

            if (user) {
              await storage.updateUser(user.id, {
                googleId: profile.id,
                provider: "google",
              });
            } else {
              user = await storage.createUser({
                username: email,
                email,
                password: "",
                googleId: profile.id,
                provider: "google",
                name: profile.displayName,
              });
            }
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // TODO: UNDER DEVELOPMENT
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID!,
        clientSecret: process.env.FACEBOOK_APP_SECRET!,
        callbackURL: "/api/auth/facebook/callback",
        profileFields: ["id", "displayName", "emails"],
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          let user = await storage.getUserByFacebookId(profile.id);

          const email = profile.emails?.[0]?.value;

          if (!user) {
            user = email
              ? await storage.getUserByEmail(email)
              : undefined;

            if (user) {
              await storage.updateUser(user.id, {
                facebookId: profile.id,
                provider: "facebook",
              });
            } else {
              user = await storage.createUser({
                username: email || `fb_${profile.id}`,
                email,
                password: "",
                facebookId: profile.id,
                provider: "facebook",
                name: profile.displayName,
              });
            }
          }

          done(undefined, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  passport.use(
    new LocalStrategy({ passReqToCallback: true }, async (req: any, username: string, password: string, done: any) => {
      try {
        const loginIdentifier = String(req.body?.username ?? req.body?.email ?? username ?? "").trim();
        let user = await storage.getUserByUsername(loginIdentifier);
        if (!user && loginIdentifier) {
          user = await storage.getUserByEmail(loginIdentifier);
        }

        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }

        // Support hashed passwords for registered users.
        if (user?.password?.includes(".")) {
          const isValid = await comparePasswords(password, user.password);
          if (isValid) {
            return done(null, user);
          }
        }

        return done(null, false, { message: "Invalid password" });
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ?? false);
    } catch (err) {
      done(err);
    }
  });

  // Google OAuth routes
  app.get(
    "/api/auth/google",
    captureRedirectUri, // Capture redirect URI before OAuth
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/api/auth/failure",
    }),
    (req, res, next) => {
      // Ensure the user structure exists from Passport's processing layer
      if (!req.user) {
        return res.redirect(`${getFrontendUrl(req)}/login`);
      }

      // Explicitly serialize the authenticated user into the active request session
      req.login(req.user, (loginErr) => {
        if (loginErr) {
          console.error("Passport login serialization error:", loginErr);
          return next(loginErr);
        }

        const token = jwt.sign(
          { id: (req.user as any).id },
          process.env.SESSION_SECRET || "default_secret",
          { expiresIn: "7d" }
        );

        // Force a physical commit write operation to your session store database
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session database persistence write error:", saveErr);
            return res.redirect(`${getFrontendUrl(req)}/login`);
          }
          
          // Get the dynamic frontend URL
          const frontendUrl = getFrontendUrl(req);
          console.log(`Redirecting to: ${frontendUrl}/?token=${token}`);
          
          // Complete the sequence safely now that headers and store data match
          res.redirect(`${frontendUrl}/?token=${token}`);
        });
      });
    }
  );

  // Facebook OAuth routes
  app.get(
    "/api/auth/facebook",
    captureRedirectUri,
    passport.authenticate("facebook", {
      scope: ["email"],
    })
  );

  app.get(
    "/api/auth/facebook/callback",
    passport.authenticate("facebook", {
      failureRedirect: "/api/auth/failure",
    }),
    (req, res) => {
      const frontendUrl = getFrontendUrl(req);
      
      // Force an explicit save sequence prior to running the redirect
      req.session.save((err) => {
        if (err) {
          console.error("Session save failure during OAuth callback:", err);
          return res.redirect(`${frontendUrl}/login`);
        }
        
        const token = jwt.sign(
          { id: (req.user as any).id },
          process.env.SESSION_SECRET || "default_secret",
          { expiresIn: "7d" }
        );
        
        res.redirect(`${frontendUrl}/?token=${token}`);
      });
    }
  );

  // Auth failure handler
  app.get("/api/auth/failure", (req, res) => {
    const frontendUrl = getFrontendUrl(req);
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  });

  // Local login
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) return next(err);
      if (!user) {
        // Return the frontend URL in the error response for client-side redirect
        const frontendUrl = getFrontendUrl(req);
        return res.status(401).json({ 
          message: "Invalid credentials",
          redirectUri: `${frontendUrl}/login`
        });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        req.session.save((saveErr: any) => {
          if (saveErr) return next(saveErr);
          
          // Include the frontend URL in the response
          const frontendUrl = getFrontendUrl(req);
          res.status(200).json({
            user: toPublicUser(user),
            token: issueToken(user.id),
            redirectUri: frontendUrl,
          });
        });
      });
    })(req, res, next);
  });

  // Register
  app.post("/api/register", async (req, res, next) => {
    try {
      const normalizedBody = {
        ...req.body,
        username: req.body?.username ?? req.body?.email,
      };

      const input = api.auth.register.input.parse(normalizedBody);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists", field: "username" });
      }

      if (input.email) {
        const existingEmail = await storage.getUserByEmail(input.email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already exists", field: "email" });
        }
      }

      const created = await storage.createUser({
        ...input,
        password: await hashPassword(input?.password ?? ""),
      });

      storage.createNotification({
        userId: created.id,
        message: `Welcome ${created.name} to Empire Hub Phones. We are glad to have you. Feel free to explore our catalogue. For any inquiries or complaints, call us or sms to <a href="0711489056">0711489056</a>`        
      })

      // Include the frontend URL in the response
      const frontendUrl = getFrontendUrl(req);
      req.login(created, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.status(201).json({
          user: toPublicUser(created),
          token: issueToken(created.id),
          redirectUri: frontendUrl,
        });
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid input" });
      }
      return next(err);
    }
  });

  // Update user
  app.post("/api/update-user", authenticateRequest, async(req, res, next) => {
    try {
      const input = z.object({
        name: z.string().trim().min(1).optional(),
        email: z.string().email().optional(),
        username: z.string().trim().min(1).optional(),
      }).strict().parse(req.body);
      const updated = await storage.updateUser((req.user as User).id, input);

      storage.createNotification({
        userId: updated.id,
        message: `Hey ${updated.name}. Your credentials have been updated. For any inquiries or complaints, call us or sms to <a href="0711489056">0711489056</a>`        
      })

      return res.status(200).json(toPublicUser(updated));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid input" });
      }
      return next(err);
    }
  })

  // Logout
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out" });
    });
  });

  // Get current user with dynamic URL support
  app.get("/api/user", async (req, res) => {
    // 1. Compatibility check: if a cookie session happened to get through, use it
    if (req.isAuthenticated()) {
      const frontendUrl = getFrontendUrl(req);
      return res.json({ ...toPublicUser(req.user as User), frontendUrl });
    }

    // 2. Cross-domain check: look for your bearer authorization header token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    try {
      // Decode the token using your environment variable secret
      const decoded = jwt.verify(token, process.env.SESSION_SECRET || "default_secret") as { id: number };
      const user = await storage.getUser(decoded.id);

      if (!user) {
        return res.status(401).json({ message: "User account no longer exists" });
      }

      const frontendUrl = getFrontendUrl(req);
      return res.json({ ...toPublicUser(user), frontendUrl });
    } catch (err) {
      return res.status(401).json({ message: "Session expired or invalid" });
    }
  });
}

function issueToken(userId: number) {
  return jwt.sign({ id: userId }, process.env.SESSION_SECRET || "default_secret", { expiresIn: "7d" });
}

function toPublicUser(user: User) {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export async function authenticateRequest(req: any, _res: any, next: any) {
  if (req.isAuthenticated()) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();

  try {
    const decoded = jwt.verify(
      authHeader.slice("Bearer ".length),
      process.env.SESSION_SECRET || "default_secret",
    ) as { id: number };
    const user = await storage.getUser(decoded.id);
    if (user) req.user = user;
  } catch {
    // Let the route's authorization middleware return a consistent 401 response.
  }

  return next();
}