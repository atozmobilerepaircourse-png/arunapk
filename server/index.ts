import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { registerRoutes } from "./routes";
import { startEmailScheduler } from "./lib/emailScheduler";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

const PRODUCTION_DOMAIN = "https://repair-backend-us-456751858632.us-central1.run.app";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    origins.add(PRODUCTION_DOMAIN);
    origins.add("https://mobile-repair-app-276b6.web.app");
    origins.add("https://www.atozmobilerepair.in");
    origins.add("https://mail.atozmobilerepair.in");
    origins.add("https://mobile-repair-app-276b6.web.app");
    origins.add("https://mobile-repair-app-276b6.firebaseapp.com");
    origins.add("https://repair-backend-3siuld7gbq-el.a.run.app");
    
    const origin = req.header("origin");
    if (origin && (origin.endsWith(".run.app") || origin.endsWith(".web.app") || origin.endsWith(".firebaseapp.com"))) {
      origins.add(origin);
    }

    if (process.env.ALLOWED_ORIGINS) {
      process.env.ALLOWED_ORIGINS.split(",").forEach((d) => {
        origins.add(d.trim());
      });
    }

    if (process.env.NODE_ENV !== "production") {
      if (process.env.REPLIT_DEV_DOMAIN) {
        origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
        origins.add(`wss://${process.env.REPLIT_DEV_DOMAIN}`);
      }
      if (process.env.REPLIT_DOMAINS) {
        process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
          origins.add(`https://${d.trim()}`);
          origins.add(`wss://${d.trim()}`);
        });
      }
    }


    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    const isCloudRun = origin?.endsWith(".run.app");

    if (
      origin &&
      (origins.has(origin) ||
        isLocalhost ||
        (process.env.NODE_ENV !== "production" && isCloudRun))
    ) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, expo-platform, x-session-token");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "500mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "500mb" }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  const distPath = path.resolve(process.cwd(), "dist");
  const hasWebBuild = fs.existsSync(path.join(distPath, "index.html"));

  log("Serving static Expo files with dynamic manifest routing");
  if (hasWebBuild) {
    log("Web build found in dist/ - serving web app for browser requests");
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/" && hasWebBuild) {
      return res.sendFile(path.join(distPath, "index.html"));
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use("/download", express.static(path.resolve(process.cwd(), "static-build")));
  if (hasWebBuild) {
    app.use(express.static(distPath));
  }
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupWebAppFallback(app: express.Application) {
  const distPath = path.resolve(process.cwd(), "dist");
  const indexPath = path.join(distPath, "index.html");
  if (!fs.existsSync(indexPath)) return;

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform) {
      return next();
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    res.sendFile(indexPath);
  });
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);

  // Ensure required tables exist (startup migration)
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_tokens (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        phone text NOT NULL UNIQUE,
        otp text NOT NULL,
        expires_at bigint NOT NULL,
        created_at bigint NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        type text NOT NULL DEFAULT 'ACCOUNT_LOCKED',
        user_id text NOT NULL,
        user_name text NOT NULL DEFAULT '',
        phone text NOT NULL DEFAULT '',
        reason text NOT NULL DEFAULT '',
        read integer NOT NULL DEFAULT 0,
        created_at bigint NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `);
    await pool.end();
    log("Startup migration: otp_tokens table ready");
  } catch (err) {
    log("Startup migration warning:", err);
  }

  const server = await registerRoutes(app);

  startEmailScheduler();

  setupWebAppFallback(app);

  if (process.env.NODE_ENV === "development") {
    const metroProxy = createProxyMiddleware({
      target: "http://localhost:8081",
      changeOrigin: true,
      ws: true,
      logger: undefined,
    });
    app.use((req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
        return next();
      }
      return metroProxy(req, res, next);
    });
    log("Dev proxy: non-API requests forwarded to Metro on port 8081");
  }

  setupErrorHandler(app);

  const devDefault = process.env.NODE_ENV === "production" ? "8080" : "5000";
  const port = parseInt(process.env.PORT || devDefault, 10);
  server.listen(port, "0.0.0.0", () => {
    log(`express server serving on port ${port}`);
  });

  // Allow up to 30 minutes for large video uploads (1.8GB @ 10Mbps ~= 25 min)
  server.timeout = 30 * 60 * 1000;
  server.keepAliveTimeout = 30 * 60 * 1000;
  server.headersTimeout = 31 * 60 * 1000;
})();
