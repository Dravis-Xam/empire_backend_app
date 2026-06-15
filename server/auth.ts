import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { api } from "@shared/routes";
import { z } from "zod";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import jwt from 'jsonwebtoken'

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
      sameSite: "none", 
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());


  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
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
      async (_accessToken, _refreshToken, profile, done) => {
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
    new LocalStrategy({ passReqToCallback: true }, async (req: any, username, password, done) => {
      try {
        const loginIdentifier = String(req.body?.username ?? req.body?.email ?? username ?? "").trim();
        let user = await storage.getUserByUsername(loginIdentifier);
        if (!user && loginIdentifier) {
          user = await storage.getUserByEmail(loginIdentifier);
        }

        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }

        // Accept seeded plain-text users for local demo environments.
        if (user.password === password) {
          return done(null, user);
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
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: `${process.env.LIVE_FRONTEND_URI}/login`,
    }),
    (req, res, next) => {
      // Ensure the user structure exists from Passport's processing layer
      if (!req.user) {
        return res.redirect(`${process.env.LIVE_FRONTEND_URI}/login`);
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
            return res.redirect(`${process.env.LIVE_FRONTEND_URI}/login`);
          }
          
          // Complete the sequence safely now that headers and store data match
          res.redirect(`${process.env.LIVE_FRONTEND_URI}/?token=${token}`);
        });
      });
    }
  );

  app.get(
    "/api/auth/facebook",
    passport.authenticate("facebook", {
      scope: ["email"],
    })
  );

  app.get(
    "/api/auth/facebook/callback",
    passport.authenticate("facebook", {
      failureRedirect: `${process.env.LIVE_FRONTEND_URI}/login`,
    }),
    (req, res) => {
      // Force an explicit save sequence prior to running the redirect
      req.session.save((err) => {
        if (err) {
          console.error("Session save failure during OAuth callback:", err);
          return res.redirect(`${process.env.LIVE_FRONTEND_URI}/login`);
        }
        res.redirect(`${process.env.LIVE_FRONTEND_URI}/`);
      });
    }
  );

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      req.login(user, (err) => {
        if (err) return next(err);
        req.session.save((saveErr: any) => {
          if (saveErr) return next(saveErr);
          res.status(200).json(user);
        });
      });
    })(req, res, next);
  });

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

      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid input" });
      }
      return next(err);
    }
  });

  app.post("/api/update-user", async(req, res, next) => {
    try {
      const normalizedBody = {
        ...req.body,
        username: req.body?.username ?? req.body?.email,
      };

      const input = api.auth.register.input.parse(normalizedBody);
      const existing = await storage.getUserByUsername(input.username);
      if (!existing) {
        return res.status(400).json({ message: "Username does not exist", field: "username" });
      }

      const updated = await storage.updateUser(normalizedBody?.id, normalizedBody);

      storage.createNotification({
        userId: updated.id,
        message: `Hey ${updated.name}. Your credentials have been updated. For any inquiries or complaints, call us or sms to <a href="0711489056">0711489056</a>`        
      })

      return res.status(200).json(updated);

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid input" });
      }
      return next(err);
    }
  })

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get("/api/user", async (req, res) => {
  // 1. Compatibility check: if a cookie session happened to get through, use it
    if (req.isAuthenticated()) {
      return res.json(req.user);
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

      return res.json(user);
    } catch (err) {
      return res.status(401).json({ message: "Session expired or invalid" });
    }
  });
}
