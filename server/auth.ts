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
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    proxy: true, // Hint to express-session that a proxy is trusted
    cookie: {
      httpOnly: true,
      secure: isProduction, // Must be true in production!
      sameSite: isProduction ? "none" : "lax", 
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
      failureRedirect: `${process.env.FRONTEND_URI}/login`,
    }),
    (req, res) => {
      // Force an explicit save sequence prior to running the redirect
      req.session.save((err) => {
        if (err) {
          console.error("Session save failure during OAuth callback:", err);
          return res.redirect(`${process.env.FRONTEND_URI}/login`);
        }
        res.redirect(`${process.env.FRONTEND_URI}/`);
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
      failureRedirect: `${process.env.FRONTEND_URI}/login`,
    }),
    (req, res) => {
      // Force an explicit save sequence prior to running the redirect
      req.session.save((err) => {
        if (err) {
          console.error("Session save failure during OAuth callback:", err);
          return res.redirect(`${process.env.FRONTEND_URI}/login`);
        }
        res.redirect(`${process.env.FRONTEND_URI}/`);
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

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    res.json(req.user);
  });
}
