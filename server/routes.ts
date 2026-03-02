import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { getFirestore } from "./firebase-admin";
import { db } from "./db";
import OpenAI from "openai";
import { notifyAllUsers, notifyNewPost, notifyUser } from "./push-notifications";
import { profiles, conversations, messages, posts, jobs, reels, products, orders, subscriptionSettings, courses, courseChapters, courseVideos, courseEnrollments, dubbedVideos, ads, liveChatMessages, liveClasses, courseNotices, sessions, payments, teacherPayouts, appSettings, videoProgress, livePolls, livePollVotes, emailCampaigns, otpTokens } from "@shared/schema";
import { sendWelcomeEmail } from "./lib/sendEmail";
import { eq, or, and, desc, gt, lt, sql, ne, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import Razorpay from "razorpay";
import twilio from "twilio";

const googleAuthTokens = new Map<string, { email: string; name: string; createdAt: number }>();

function getGoogleClientSecret(): string | undefined {
  const raw = process.env.GOOGLE_CLIENT_SECRET;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.web?.client_secret) return parsed.web.client_secret;
    if (parsed?.installed?.client_secret) return parsed.installed.client_secret;
    if (parsed?.client_secret) return parsed.client_secret;
  } catch {}
  return raw;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of googleAuthTokens) {
    if (now - val.createdAt > 5 * 60 * 1000) googleAuthTokens.delete(key);
  }
}, 60000);

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY || '';
const BUNNY_STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME || '';
const BUNNY_STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || 'sg';
const BUNNY_STORAGE_ENDPOINT = BUNNY_STORAGE_REGION === 'de' 
  ? 'https://storage.bunnycdn.com' 
  : `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com`;
const BUNNY_CDN_URL = `https://Mobistorage.b-cdn.net`;
const bunnyAvailable = !!(BUNNY_STORAGE_API_KEY && BUNNY_STORAGE_ZONE_NAME);

if (bunnyAvailable) {
  console.log(`[Bunny] Storage initialized: zone=${BUNNY_STORAGE_ZONE_NAME}, region=${BUNNY_STORAGE_REGION}`);
} else {
  console.log('[Bunny] Missing BUNNY_STORAGE_API_KEY or BUNNY_STORAGE_ZONE_NAME, using local disk storage');
}

async function uploadToStorage(buffer: Buffer, filename: string): Promise<string> {
  if (bunnyAvailable) {
    try {
      const url = `${BUNNY_STORAGE_ENDPOINT}/${BUNNY_STORAGE_ZONE_NAME}/${filename}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'AccessKey': BUNNY_STORAGE_API_KEY,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(buffer.length),
        },
        body: buffer,
        duplex: 'half',
      } as any);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Bunny upload failed: ${response.status} ${response.statusText} ${text}`);
      }
      console.log(`[Bunny] Uploaded: ${filename} (${buffer.length} bytes)`);
      return `${BUNNY_CDN_URL}/${filename}`;
    } catch (error) {
      console.error("[Bunny] Upload failed, falling back to local:", error);
    }
  }
  const localFilename = filename.replace(/^(images|videos)\//, "");
  const filePath = path.join(uploadsDir, localFilename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${localFilename}`;
}

async function uploadStreamToStorage(
  readStream: NodeJS.ReadableStream,
  filename: string,
  contentType: string
): Promise<string> {
  if (bunnyAvailable) {
    const chunks: Buffer[] = [];
    for await (const chunk of readStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      throw new Error(`Stream produced 0 bytes for ${filename}`);
    }
    const url = `${BUNNY_STORAGE_ENDPOINT}/${BUNNY_STORAGE_ZONE_NAME}/${filename}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(buffer.length),
      },
      body: buffer,
      duplex: 'half',
    } as any);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Bunny stream upload failed: ${response.status} ${response.statusText} ${text}`);
    }
    const cdnUrl = `${BUNNY_CDN_URL}/${filename}`;
    const verifyRes = await fetch(cdnUrl, { method: 'HEAD' });
    const contentLength = verifyRes.headers.get('content-length');
    if (contentLength === '0') {
      console.warn(`[Bunny] WARNING: CDN reports 0 bytes for ${filename}, retrying with file read...`);
      const retryRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'AccessKey': BUNNY_STORAGE_API_KEY,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(buffer.length),
        },
        body: buffer,
        duplex: 'half',
      } as any);
      if (!retryRes.ok) {
        throw new Error(`Bunny retry upload failed: ${retryRes.status}`);
      }
    }
    console.log(`[Bunny] Stream uploaded: ${filename} (${buffer.length} bytes)`);
    return cdnUrl;
  }
  throw new Error("Bunny.net not available for stream upload");
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const memStorage = multer.memoryStorage();

const upload = multer({
  storage: memStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});

const videoUpload = multer({
  storage: memStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});


// OTP is now stored in the database (otpTokens table) for persistence across restarts

function sanitizeImageUrls(images: string[]): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter(url => {
    if (typeof url !== 'string') return false;
    if (url.startsWith('file://') || url.startsWith('content://') || url.startsWith('data:')) return false;
    // Support bunny.net CDN URLs
    if (url.includes('b-cdn.net')) return true;
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/') || url.startsWith('/api/files/') || url.startsWith('/api/gcs/');
  });
}

function sanitizeImageUrl(url: string): string {
  if (typeof url !== 'string') return '';
  if (url.startsWith('file://') || url.startsWith('content://') || url.startsWith('data:')) return '';
  // Support bunny.net CDN URLs
  if (url.includes('b-cdn.net')) return url;
  return url;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendWhatsAppOTP(phone: string, otp: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhone) {
    console.log(`[OTP] Twilio credentials not set. OTP for ${phone}: ${otp}`);
    return false;
  }

  const formattedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/^91/, "")}`;
  const client = twilio(accountSid, authToken);

  try {
    console.log(`[OTP] Sending WhatsApp OTP to ${formattedPhone}`);
    const message = await client.messages.create({
      body: `Your Mobi verification code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
      from: `whatsapp:${twilioPhone}`,
      to: `whatsapp:${formattedPhone}`,
    });
    console.log(`[OTP] WhatsApp OTP sent successfully, SID: ${message.sid}`);
    return true;
  } catch (waError: any) {
    console.warn(`[OTP] WhatsApp failed: ${waError?.message}. Falling back to SMS...`);
    try {
      const smsMessage = await client.messages.create({
        body: `Your Mobi verification code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
        from: twilioPhone,
        to: formattedPhone,
      });
      console.log(`[OTP] SMS fallback sent successfully, SID: ${smsMessage.sid}`);
      return true;
    } catch (smsError: any) {
      console.error("[OTP] Both WhatsApp and SMS failed:", smsError?.message || smsError);
      return false;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ========== File serving ==========
  app.use("/uploads", (await import("express")).default.static(uploadsDir));
  app.use("/assets", (await import("express")).default.static(path.join(process.cwd(), "server/templates")));

  async function proxyBunnyFile(folder: string, filename: string, res: any, req?: any) {
    if (!bunnyAvailable) {
      return res.status(404).json({ success: false, message: "Storage not available" });
    }
    const storageUrl = `${BUNNY_STORAGE_ENDPOINT}/${BUNNY_STORAGE_ZONE_NAME}/${folder}/${filename}`;
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4',
      '.mov': 'video/quicktime', '.webm': 'video/webm', '.MOV': 'video/quicktime',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    const headers: Record<string, string> = { 'AccessKey': BUNNY_STORAGE_API_KEY };
    if (req?.headers?.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await fetch(storageUrl, { headers });
    if (!response.ok && response.status !== 206) {
      return res.status(response.status).json({ success: false, message: "File not found" });
    }

    res.set('Content-Type', contentType);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');

    const cl = response.headers.get('content-length');
    if (cl) res.set('Content-Length', cl);
    const cr = response.headers.get('content-range');
    if (cr) res.set('Content-Range', cr);

    res.status(response.status === 206 ? 206 : 200);
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  }

  app.get("/api/gcs/:folder/:filename", async (req, res) => {
    try {
      const { folder, filename } = req.params;
      if (!folder || !filename) {
        return res.status(404).json({ success: false, message: "File not found" });
      }
      if (req.query.proxy === '1' && bunnyAvailable) {
        return proxyBunnyFile(folder, filename, res, req);
      }
      if (bunnyAvailable) {
        const cdnUrl = `${BUNNY_CDN_URL}/${folder}/${filename}`;
        return res.redirect(302, cdnUrl);
      }
      return proxyBunnyFile(folder, filename, res, req);
    } catch (error) {
      console.error("[Files] Serve error:", error);
      return res.status(500).json({ success: false, message: "Failed to retrieve file" });
    }
  });

  app.get("/api/gcs-url/:folder/:filename", async (req, res) => {
    try {
      const { folder, filename } = req.params;
      if (!folder || !filename) {
        return res.status(404).json({ success: false, message: "File not found" });
      }
      if (bunnyAvailable) {
        return res.json({ url: `${BUNNY_CDN_URL}/${folder}/${filename}` });
      }
      return res.status(404).json({ success: false, message: "Failed to get URL" });
    } catch (error) {
      console.error("[Files] URL error:", error);
      return res.status(500).json({ success: false, message: "Failed to get URL" });
    }
  });

  app.get("/api/files/:folder/:filename", async (req, res) => {
    try {
      const { folder, filename } = req.params;
      if (!folder || !filename) {
        return res.status(400).json({ success: false, message: "File path required" });
      }
      return proxyBunnyFile(folder, filename, res);
    } catch (error) {
      console.error("[Files] Download error:", error);
      return res.status(500).json({ success: false, message: "Failed to retrieve file" });
    }
  });

  app.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
      const filename = `images/${randomUUID()}${path.extname(req.file.originalname)}`;
      const url = await uploadToStorage(req.file.buffer, filename);
      res.json({ success: true, url });
    } catch (error) {
      console.error("[Upload] Error:", error);
      res.status(500).json({ success: false, message: "Upload failed" });
    }
  });

  app.post("/api/upload-video", videoUpload.single("video"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
      const filename = `videos/${randomUUID()}${path.extname(req.file.originalname)}`;
      const url = await uploadToStorage(req.file.buffer, filename);
      res.json({ success: true, url });
    } catch (error) {
      console.error("[Upload Video] Error:", error);
      res.status(500).json({ success: false, message: "Upload failed" });
    }
  });

  app.post("/api/upload-base64", async (req, res) => {
    try {
      const { base64, mimeType } = req.body;
      if (!base64) {
        return res.status(400).json({ success: false, message: "No image data provided" });
      }
      const ext = (mimeType || "image/jpeg").includes("png") ? ".png" : ".jpg";
      const storageName = `images/${randomUUID()}${ext}`;
      const buffer = Buffer.from(base64, "base64");
      const imageUrl = await uploadToStorage(buffer, storageName);
      console.log(`[Upload] Base64 image saved: ${imageUrl} (${buffer.length} bytes)`);
      return res.json({ success: true, url: imageUrl });
    } catch (error) {
      console.error("[Upload] Base64 error:", error);
      return res.status(500).json({ success: false, message: "Upload failed" });
    }
  });

  // ========== OTP routes ==========
  app.post("/api/otp/send", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || typeof phone !== "string" || phone.length < 10) {
        return res.status(400).json({ success: false, message: "Valid phone number is required" });
      }

      const cleanPhone = phone.replace(/\D/g, "");
      const otp = generateOTP();
      const expiresAt = Date.now() + 5 * 60 * 1000;

      // Persist OTP in database so it survives server restarts
      await db.delete(otpTokens).where(eq(otpTokens.phone, cleanPhone));
      await db.insert(otpTokens).values({ phone: cleanPhone, otp, expiresAt });

      const sent = await sendWhatsAppOTP(cleanPhone, otp);

      console.log(`[OTP] Generated for ${cleanPhone}: ${otp} | Sent: ${sent}`);

      return res.json({
        success: true,
        message: sent ? "OTP sent via WhatsApp" : "OTP generated",
        sent,
      });
    } catch (error: any) {
      console.error("[OTP] Send error:", error?.message || error, error?.stack?.split('\n').slice(0,3).join(' '));
      return res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
  });

  app.post("/api/otp/verify", async (req, res) => {
    try {
      const { phone, otp, deviceId } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ success: false, message: "Phone and OTP are required" });
      }

      const cleanPhone = phone.replace(/\D/g, "");

      // Fetch OTP from database
      const storedRows = await db.select().from(otpTokens).where(eq(otpTokens.phone, cleanPhone));
      const stored = storedRows[0];

      if (!stored) {
        return res.status(400).json({ success: false, message: "OTP not found. Please request a new one." });
      }

      if (Date.now() > stored.expiresAt) {
        await db.delete(otpTokens).where(eq(otpTokens.phone, cleanPhone));
        return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
      }

      if (stored.otp !== otp) {
        return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
      }

      await db.delete(otpTokens).where(eq(otpTokens.phone, cleanPhone));

      const allProfilesList = await db.select().from(profiles);
      const existingProfile = allProfilesList.find(p => p.phone.replace(/\D/g, "") === cleanPhone);

      if (existingProfile && existingProfile.blocked === 1) {
        return res.json({
          success: false,
          message: "Your account has been blocked. Please contact admin for support.",
        });
      }

      if (existingProfile && deviceId && existingProfile.role === "technician") {
        const currentDeviceId = existingProfile.deviceId || "";
        const deviceChangeCount = existingProfile.deviceChangeCount || 0;

        if (currentDeviceId && currentDeviceId !== deviceId) {
          const deviceLockSettings = await db.select().from(appSettings).where(eq(appSettings.key, "device_lock_enabled"));
          const deviceLockEnabled = deviceLockSettings.length > 0 && deviceLockSettings[0].value === "true";
          
          const priceSettings = await db.select().from(appSettings).where(eq(appSettings.key, "device_lock_price"));
          const deviceChangePrice = priceSettings.length > 0 ? parseInt(priceSettings[0].value) || 100 : 100;

          if (deviceChangeCount >= 2 && deviceLockEnabled) {
            return res.json({
              success: true,
              message: "Device change requires payment",
              requiresDevicePayment: true,
              deviceChangeCount,
              deviceChangePrice,
              sessionToken: "",
            });
          }
          
          await db.update(profiles).set({
            deviceId: deviceId,
            deviceChangeCount: deviceChangeCount + 1,
          }).where(eq(profiles.id, existingProfile.id));
        } else if (!currentDeviceId) {
          await db.update(profiles).set({ deviceId: deviceId }).where(eq(profiles.id, existingProfile.id));
        }
      }

      const sessionToken = randomUUID();
      await db.delete(sessions).where(eq(sessions.phone, cleanPhone));
      await db.insert(sessions).values({
        phone: cleanPhone,
        sessionToken,
      });

      return res.json({ success: true, message: "Phone number verified successfully", sessionToken });
    } catch (error) {
      console.error("[OTP] Verify error:", error);
      return res.status(500).json({ success: false, message: "Verification failed" });
    }
  });

  app.post("/api/session/validate", async (req, res) => {
    try {
      const { sessionToken, phone } = req.body;
      if (!sessionToken || !phone) {
        return res.json({ valid: false });
      }
      const cleanPhone = phone.replace(/\D/g, "");
      const result = await db.select().from(sessions).where(
        and(eq(sessions.sessionToken, sessionToken), eq(sessions.phone, cleanPhone))
      );
      return res.json({ valid: result.length > 0 });
    } catch (error) {
      console.error("[Session] Validate error:", error);
      return res.json({ valid: false });
    }
  });

  function sendGoogleErrorPage(res: any, errorMsg: string) {
    console.error("[Google Auth] Error:", errorMsg);
    return res.status(400).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign-in Error</title>
<style>body{background:#0D0D0F;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,sans-serif}
.c{text-align:center;padding:24px}h2{color:#FF6B35;margin:0 0 12px}p{color:#aaa;margin:0 0 20px;font-size:15px}
.sub{color:#666;font-size:13px}</style></head>
<body><div class="c">
<h2>Sign-in Failed</h2>
<p>${errorMsg}</p>
<p class="sub">Please go back to the Mobi app and try again</p>
</div></body></html>`);
  }

  // ========== Google auth login URL generator ==========
  app.post("/api/auth/google/get-login-url", (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ success: false, message: "Token required" });
      const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!clientId) return res.status(500).json({ success: false, message: "Google OAuth not configured" });
      const devDomain = "repair-backend-us-456751858632.us-central1.run.app";
      const redirectUri = `https://${devDomain}/api/auth/google/callback`;
      const stateObj = { token };
      const stateStr = Buffer.from(JSON.stringify(stateObj)).toString('base64');
      const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile&state=${encodeURIComponent(stateStr)}&prompt=select_account`;
      console.log("[Google Auth] Generated login URL with redirect_uri:", redirectUri);
      return res.json({ success: true, url: googleUrl });
    } catch (error) {
      console.error("[Google Auth] get-login-url error:", error);
      return res.status(500).json({ success: false, message: "Failed to generate URL" });
    }
  });

  // ========== Google auth return URL registration ==========
  const googleReturnUrls = new Map<string, string>();

  app.post("/api/auth/google/set-return-url", (req, res) => {
    const { token, returnUrl } = req.body;
    if (token && returnUrl) {
      googleReturnUrls.set(token, returnUrl);
      console.log("[Google Auth] Stored return URL for token:", token.substring(0, 8), "url:", returnUrl.substring(0, 80));
    }
    return res.json({ success: true });
  });

  app.get("/api/admin/chat-settings", async (req, res) => {
    try {
      const settings = await db.select().from(appSettings);
      const repliesSetting = settings.find(s => s.key === "community_replies_enabled");
      const communityEnabled = repliesSetting ? repliesSetting.value !== "false" : true;
      const messageDelay = parseInt(settings.find(s => s.key === "chat_message_delay")?.value || "0");
      return res.json({
        success: true,
        community_replies_enabled: communityEnabled,
        chat_message_delay: messageDelay
      });
    } catch (error) {
      console.error("[Admin] Get chat settings error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch chat settings" });
    }
  });

  app.post("/api/admin/chat-settings", async (req, res) => {
    try {
      const { community_replies_enabled, chat_message_delay } = req.body;
      
      if (community_replies_enabled !== undefined) {
        const val = String(community_replies_enabled === true || community_replies_enabled === "true");
        await db.insert(appSettings)
          .values({ key: "community_replies_enabled", value: val })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: val } });
      }
      
      if (chat_message_delay !== undefined) {
        await db.insert(appSettings)
          .values({ key: "chat_message_delay", value: String(chat_message_delay) })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: String(chat_message_delay) } });
      }
      
      return res.json({ success: true });
    } catch (error) {
      console.error("[Admin] Update chat settings error:", error);
      return res.status(500).json({ success: false, message: "Failed to update chat settings" });
    }
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state, error: googleError } = req.query;
      console.log("[Google Auth] Callback received, code:", !!code, "state:", !!state, "error:", googleError);

      if (googleError) {
        return sendGoogleErrorPage(res, `Google returned error: ${googleError}`);
      }

      if (!code) {
        return sendGoogleErrorPage(res, "No authorization code received from Google.");
      }

      const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const clientSecret = getGoogleClientSecret();

      console.log("[Google Auth] clientId:", clientId);
      console.log("[Google Auth] clientSecret length:", clientSecret?.length, "starts:", clientSecret?.substring(0, 7));

      if (!clientId || !clientSecret) {
        return sendGoogleErrorPage(res, "Google OAuth is not configured on the server.");
      }

      const devDomain = "repair-backend-us-456751858632.us-central1.run.app";
      const redirectUri = `https://${devDomain}/api/auth/google/callback`;
      console.log("[Google Auth] Using redirect_uri:", redirectUri);

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });

      const tokenData = await tokenRes.json() as any;
      console.log("[Google Auth] Token exchange status:", tokenRes.status, "has access_token:", !!tokenData.access_token);

      if (!tokenData.access_token) {
        console.error("[Google Auth] Token exchange failed:", JSON.stringify(tokenData));
        return sendGoogleErrorPage(res, tokenData.error_description || "Failed to authenticate with Google. The redirect URI may not match.");
      }

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json() as any;

      if (!userInfo.email) {
        return sendGoogleErrorPage(res, "Could not get email from your Google account.");
      }

      const email = userInfo.email;
      const name = userInfo.name || '';
      console.log("[Google Auth] Success for email:", email);

      // Send welcome email asynchronously
      sendWelcomeEmail(email, name).catch(err => console.error("[Email] Async error:", err));

      let clientToken = randomUUID();
      let returnUrl = '';
      try {
        if (state) {
          const safeState = (state as string).replace(/ /g, '+');
          const stateStr = Buffer.from(safeState, 'base64').toString('utf-8');
          const stateObj = JSON.parse(stateStr);
          if (stateObj.token) clientToken = stateObj.token;
          if (stateObj.returnUrl) returnUrl = stateObj.returnUrl;
        }
      } catch (e) {
        console.error("[Google Auth] State parse error:", e);
      }

      if (!returnUrl && googleReturnUrls.has(clientToken)) {
        returnUrl = googleReturnUrls.get(clientToken)!;
        googleReturnUrls.delete(clientToken);
        console.log("[Google Auth] Got return URL from pre-registered map:", returnUrl.substring(0, 80));
      }
      googleAuthTokens.set(clientToken, { email, name, createdAt: Date.now() });

      if (returnUrl) {
        const separator = returnUrl.includes('?') ? '&' : '?';
        const deepLink = `${returnUrl}${separator}email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
        console.log("[Google Auth] Redirecting to deep link:", deepLink);
        return res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Returning to Mobi...</title>
<style>body{background:#0D0D0F;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui}
.c{text-align:center;padding:24px}h2{color:#FF6B35;margin:0 0 12px}p{color:#ccc;margin:8px 0}
.spinner{width:40px;height:40px;border:4px solid #333;border-top:4px solid #FF6B35;border-radius:50%;animation:spin 1s linear infinite;margin:20px auto}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
</head><body><div class="c">
<div class="spinner"></div>
<h2>Returning to Mobi...</h2>
<p>If the app doesn't open automatically,<br>tap the button below.</p>
<a href="${deepLink}" style="display:inline-block;margin-top:20px;padding:14px 32px;background:#FF6B35;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600">Open Mobi App</a>
</div>
<script>
setTimeout(function(){window.location.href="${deepLink}"},500);
setTimeout(function(){window.location.href="${deepLink}"},2000);
</script>
</body></html>`);
      }

      return res.redirect(`/api/auth/google/success?token=${clientToken}`);
    } catch (error) {
      console.error("[Google Auth] Callback error:", error);
      return sendGoogleErrorPage(res, "An unexpected error occurred during sign-in.");
    }
  });

  // ========== Google auth check ==========
  app.get("/api/auth/google/success", (req, res) => {
    const { token } = req.query;
    if (!token || !googleAuthTokens.has(token as string)) {
      return res.status(400).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#0D0D0F;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui}
.c{text-align:center}a{color:#FF6B35}</style></head>
<body><div class="c"><p>Session expired. Please try again.</p><a href="/">Go back</a></div></body></html>`);
    }

    return res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signed In</title>
<style>body{background:#0D0D0F;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,sans-serif}
.c{text-align:center;padding:24px}.icon{font-size:56px;margin-bottom:16px;color:#FF6B35}
h2{margin:0 0 12px;font-size:24px;color:#FF6B35}p{color:#ccc;margin:0 0 8px;font-size:16px;line-height:1.5}
.btn{display:inline-block;margin-top:24px;padding:16px 40px;background:#FF6B35;color:#fff;text-decoration:none;border-radius:12px;font-size:18px;font-weight:700}
.sub{color:#888;font-size:13px;margin-top:20px}</style>
</head>
<body><div class="c">
<div class="icon">&#10003;</div>
<h2>Signed in successfully!</h2>
<p>Now switch back to the Mobi app.<br>Your sign-in will complete automatically.</p>
<p style="color:#FF6B35;font-size:18px;font-weight:700;margin-top:24px">Swipe up from the bottom<br>and tap Expo Go in recent apps</p>
<p class="sub">The app will detect your sign-in<br>and continue automatically</p>
</div></body></html>`);
  });

  app.get("/api/auth/google/done", (req, res) => {
    const { email, name: gname } = req.query;
    return res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign-in Successful</title>
<style>body{background:#0D0D0F;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,sans-serif}
.c{text-align:center;padding:24px}.icon{font-size:48px;margin-bottom:16px;color:#FF6B35}
h2{margin:0 0 8px;font-size:22px;color:#FF6B35}p{color:#aaa;margin:0 0 16px;font-size:15px}</style>
</head>
<body><div class="c">
<div class="icon">&#10003;</div>
<h2>Signed in successfully!</h2>
<p>Returning to Mobi app...</p>
</div>
<script>setTimeout(function(){window.close();},800);</script>
</body></html>`);
  });

  app.post("/api/auth/google/process-code", async (req, res) => {
    try {
      const { code, state } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, message: "No authorization code" });
      }

      const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const clientSecret = getGoogleClientSecret();

      if (!clientId || !clientSecret) {
        return res.status(500).json({ success: false, message: "Google OAuth not configured" });
      }

      const devDomain = "repair-backend-us-456751858632.us-central1.run.app";
      const redirectUri = `https://${devDomain}/api/auth/google/callback`;
      console.log("[Google Auth] process-code redirect_uri:", redirectUri);

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });

      const tokenData = await tokenRes.json() as any;
      console.log("[Google Auth] process-code token status:", tokenRes.status, "has access_token:", !!tokenData.access_token);

      if (!tokenData.access_token) {
        console.error("[Google Auth] process-code token failed:", JSON.stringify(tokenData));
        return res.status(400).json({ success: false, message: tokenData.error_description || "Token exchange failed" });
      }

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json() as any;

      if (!userInfo.email) {
        return res.status(400).json({ success: false, message: "Could not get email" });
      }

      const email = userInfo.email;
      const name = userInfo.name || '';
      console.log("[Google Auth] process-code success:", email);

      // Send welcome email asynchronously
      sendWelcomeEmail(email, name).catch(err => console.error("[Email] Async error:", err));

      let clientToken = randomUUID();
      try {
        if (state) {
          const stateStr = Buffer.from(state as string, 'base64').toString('utf-8');
          const stateObj = JSON.parse(stateStr);
          if (stateObj.token) clientToken = stateObj.token;
        }
      } catch (e) {}
      googleAuthTokens.set(clientToken, { email, name, createdAt: Date.now() });

      return res.json({ success: true, token: clientToken, email, name });
    } catch (error) {
      console.error("[Google Auth] process-code error:", error);
      return res.status(500).json({ success: false, message: "Server error during authentication" });
    }
  });

  app.post("/api/auth/google/exchange", (req, res) => {
    const { token } = req.body;
    if (!token || !googleAuthTokens.has(token as string)) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
    const data = googleAuthTokens.get(token as string)!;
    googleAuthTokens.delete(token as string);
    return res.json({ success: true, email: data.email, name: data.name });
  });

  app.post("/api/auth/send-welcome-email", async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ success: false, message: "Email is required" });
      }
      sendWelcomeEmail(email, name || "there").catch(err => console.error("[Email] Async welcome error:", err));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Send welcome email error:", error);
      return res.status(500).json({ success: false, message: "Failed to send email" });
    }
  });

  app.post("/api/auth/check-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ success: false, message: "Email is required" });
      }
      const allProfiles = await db.select().from(profiles);
      const found = allProfiles.find(p => p.email && p.email.toLowerCase() === email.toLowerCase());

      if (found) {
        return res.json({
          success: true,
          exists: true,
          profile: { ...found, skills: JSON.parse(found.skills) },
        });
      }
      return res.json({ success: true, exists: false });
    } catch (error) {
      console.error("[Auth] Check email error:", error);
      return res.status(500).json({ success: false, message: "Failed to check email" });
    }
  });

  app.post("/api/auth/google-phone-login", async (req, res) => {
    try {
      const { email, phone, deviceId } = req.body;
      if (!email || !phone) {
        return res.status(400).json({ success: false, message: "Email and phone are required" });
      }
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number" });
      }

      const allProfiles = await db.select().from(profiles);
      const foundByEmail = allProfiles.find(p => p.email && p.email.toLowerCase() === email.toLowerCase());
      const foundByPhone = allProfiles.find(p => p.phone.replace(/\D/g, "") === cleanPhone);

      if (foundByEmail) {
        if (foundByEmail.blocked) {
          return res.json({ success: false, message: "Your account has been blocked by admin." });
        }
        const sToken = require("crypto").randomBytes(32).toString("hex");
        await db.insert(sessions).values({ phone: foundByEmail.phone, sessionToken: sToken, createdAt: Date.now() });
        return res.json({
          success: true,
          exists: true,
          profile: { ...foundByEmail, skills: JSON.parse(foundByEmail.skills) },
          sessionToken: sToken,
        });
      }

      if (foundByPhone) {
        if (foundByPhone.blocked) {
          return res.json({ success: false, message: "Your account has been blocked by admin." });
        }
        if (!foundByPhone.email) {
          await db.update(profiles).set({ email }).where(eq(profiles.id, foundByPhone.id));
        }
        const sToken = require("crypto").randomBytes(32).toString("hex");
        await db.insert(sessions).values({ phone: foundByPhone.phone, sessionToken: sToken, createdAt: Date.now() });
        return res.json({
          success: true,
          exists: true,
          profile: { ...foundByPhone, skills: JSON.parse(foundByPhone.skills) },
          sessionToken: sToken,
        });
      }

      const sToken = require("crypto").randomBytes(32).toString("hex");
      await db.insert(sessions).values({ phone: cleanPhone, sessionToken: sToken, createdAt: Date.now() });
      return res.json({ success: true, exists: false, sessionToken: sToken });
    } catch (error) {
      console.error("[Auth] Google phone login error:", error);
      return res.status(500).json({ success: false, message: "Failed to process login" });
    }
  });

  // ========== Phone login check ==========
  app.post("/api/auth/check-phone", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ success: false, message: "Phone number is required" });
      }
      const cleanPhone = phone.replace(/\D/g, "");
      const allProfiles = await db.select().from(profiles);
      const found = allProfiles.find(p => p.phone.replace(/\D/g, "") === cleanPhone);

      if (found) {
        return res.json({
          success: true,
          exists: true,
          profile: { ...found, skills: JSON.parse(found.skills) },
        });
      }
      return res.json({ success: true, exists: false });
    } catch (error) {
      console.error("[Auth] Check phone error:", error);
      return res.status(500).json({ success: false, message: "Failed to check phone" });
    }
  });

  // ========== Profile routes ==========
  app.post("/api/profiles", async (req, res) => {
    try {
      const { id, name, phone, email, role, skills, city, state, experience, shopName, bio, avatar,
              sellType, teachType, shopAddress, gstNumber, aadhaarNumber, panNumber, latitude, longitude, locationSharing, deviceId } = req.body;
      if (!id || !name || !phone || !role) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const profileData = {
        name, phone, role,
        email: email || "",
        skills: JSON.stringify(skills || []),
        city: city || "", state: state || "",
        experience: experience || "",
        shopName: shopName || "",
        bio: bio || "",
        avatar: avatar || "",
        sellType: sellType || "",
        teachType: teachType || "",
        shopAddress: shopAddress || "",
        gstNumber: gstNumber || "",
        aadhaarNumber: aadhaarNumber || "",
        panNumber: panNumber || "",
        latitude: latitude || "",
        longitude: longitude || "",
        locationSharing: locationSharing || "true",
      };

      const existing = await db.select().from(profiles).where(eq(profiles.id, id));
      if (existing.length > 0) {
        await db.update(profiles).set(profileData).where(eq(profiles.id, id));
      } else {
        await db.insert(profiles).values({
          id, ...profileData, deviceId: deviceId || "", createdAt: Date.now(),
        });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("[Profile] Save error:", error);
      return res.status(500).json({ success: false, message: "Failed to save profile" });
    }
  });

  app.get("/api/profiles", async (_req, res) => {
    try {
      const allProfiles = await db.select().from(profiles);
      const parsed = allProfiles.map(p => ({
        ...p,
        skills: JSON.parse(p.skills),
      }));
      return res.json(parsed);
    } catch (error) {
      console.error("[Profile] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get profiles" });
    }
  });

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const result = await db.select().from(profiles).where(eq(profiles.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, message: "Profile not found" });
      }
      const p = result[0];
      return res.json({ ...p, skills: JSON.parse(p.skills) });
    } catch (error) {
      console.error("[Profile] Get error:", error);
      return res.status(500).json({ success: false, message: "Failed to get profile" });
    }
  });

  app.post("/api/profiles/:id/location", async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      const id = req.params.id;
      if (!id) return res.status(400).json({ success: false });
      await db.update(profiles).set({ latitude: latitude || "", longitude: longitude || "" }).where(eq(profiles.id, id));
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  });

  app.post("/api/notifications/token", async (req, res) => {
    try {
      const { userId, token } = req.body;
      if (!userId || !token) return res.status(400).json({ success: false, message: "Missing userId or token" });
      await db.update(profiles).set({ pushToken: token }).where(eq(profiles.id, userId));
      console.log(`[Push] Token saved for user ${userId}`);
      return res.json({ success: true });
    } catch (error) {
      console.error("[Push] Token save error:", error);
      return res.status(500).json({ success: false });
    }
  });

  // In-memory live chat presence store: userId -> { name, role, avatar, lastSeen }
  const liveChatPresence = new Map<string, { name: string; role: string; avatar: string; lastSeen: number }>();
  const LIVE_CHAT_PRESENCE_TTL = 45 * 1000; // 45 seconds

  app.post("/api/live-chat/presence", async (req, res) => {
    try {
      const { userId, name, role, avatar } = req.body;
      if (!userId) return res.status(400).json({ success: false });
      liveChatPresence.set(userId, { name: name || '', role: role || '', avatar: avatar || '', lastSeen: Date.now() });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  });

  app.delete("/api/live-chat/presence", async (req, res) => {
    try {
      const { userId } = req.body;
      if (userId) liveChatPresence.delete(userId);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  });

  app.get("/api/live-chat/online-users", async (_req, res) => {
    try {
      const now = Date.now();
      const active: { id: string; name: string; role: string; avatar: string }[] = [];
      for (const [id, u] of liveChatPresence) {
        if (now - u.lastSeen < LIVE_CHAT_PRESENCE_TTL) {
          active.push({ id, name: u.name, role: u.role, avatar: u.avatar });
        } else {
          liveChatPresence.delete(id);
        }
      }
      return res.json(active);
    } catch (error) {
      return res.status(500).json([]);
    }
  });

  app.post("/api/heartbeat", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false });
      const now = Date.now();
      await db.update(profiles).set({ lastSeen: now }).where(eq(profiles.id, userId));
      return res.json({ success: true, timestamp: now });
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  });

  app.get("/api/stats/online", async (_req, res) => {
    try {
      const allProfiles = await db.select().from(profiles);
      const now = Date.now();
      const ONLINE_THRESHOLD = 5 * 60 * 1000;

      const stats: Record<string, { registered: number; online: number }> = {
        technician: { registered: 0, online: 0 },
        teacher: { registered: 0, online: 0 },
        supplier: { registered: 0, online: 0 },
        job_provider: { registered: 0, online: 0 },
        customer: { registered: 0, online: 0 },
      };

      for (const p of allProfiles) {
        const role = p.role as string;
        if (stats[role]) {
          stats[role].registered++;
          if (p.lastSeen && now - p.lastSeen < ONLINE_THRESHOLD) {
            stats[role].online++;
          }
        }
      }

      return res.json(stats);
    } catch (error) {
      console.error("[Stats] Online stats error:", error);
      return res.status(500).json({ success: false });
    }
  });

  // ========== Subscription Settings routes ==========
  app.get("/api/subscription-settings", async (_req, res) => {
    try {
      const settings = await db.select().from(subscriptionSettings);
      if (settings.length === 0) {
        const defaults = [
          { id: 'sub_technician', role: 'technician', enabled: 0, amount: "99", period: "monthly", commissionPercent: "0" },
          { id: 'sub_teacher', role: 'teacher', enabled: 0, amount: "0", period: "monthly", commissionPercent: "30" },
          { id: 'sub_supplier', role: 'supplier', enabled: 0, amount: "999", period: "monthly", commissionPercent: "0" },
        ];
        for (const d of defaults) {
          await db.insert(subscriptionSettings).values({ ...d, updatedAt: Date.now() });
        }
        return res.json(defaults.map(d => ({ ...d, updatedAt: Date.now() })));
      }
      return res.json(settings);
    } catch (error) {
      console.error("[Subscription] Get error:", error);
      return res.status(500).json({ success: false });
    }
  });

  app.patch("/api/subscription-settings/:role", async (req, res) => {
    try {
      const { role } = req.params;
      const { enabled, amount, period, commissionPercent } = req.body;
      const id = `sub_${role}`;
      const existing = await db.select().from(subscriptionSettings).where(eq(subscriptionSettings.id, id));
      const updateData: any = { updatedAt: Date.now() };
      if (enabled !== undefined) updateData.enabled = enabled;
      if (amount !== undefined) updateData.amount = amount;
      if (period !== undefined) updateData.period = period;
      if (commissionPercent !== undefined) updateData.commissionPercent = commissionPercent;

      if (existing.length > 0) {
        await db.update(subscriptionSettings).set(updateData).where(eq(subscriptionSettings.id, id));
      } else {
        await db.insert(subscriptionSettings).values({
          id, role, enabled: enabled || 0, amount: amount || "0", period: period || "monthly", commissionPercent: commissionPercent || "0", updatedAt: Date.now(),
        });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("[Subscription] Update error:", error);
      return res.status(500).json({ success: false });
    }
  });

  // ========== Products/Listings routes ==========
  app.get("/api/products", async (req, res) => {
    try {
      const { userId, role } = req.query;
      let allProducts;
      if (userId) {
        allProducts = await db.select().from(products).where(eq(products.userId, userId as string)).orderBy(desc(products.createdAt));
      } else if (role) {
        allProducts = await db.select().from(products).where(eq(products.userRole, role as string)).orderBy(desc(products.createdAt));
      } else {
        allProducts = await db.select().from(products).orderBy(desc(products.createdAt));
      }
      const parsed = allProducts.map(p => ({
        ...p,
        images: JSON.parse(p.images),
        likes: JSON.parse(p.likes),
      }));
      return res.json(parsed);
    } catch (error) {
      console.error("[Products] Get error:", error);
      return res.status(500).json({ success: false });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const result = await db.select().from(products).where(eq(products.id, req.params.id));
      if (result.length === 0) return res.status(404).json({ success: false, message: "Not found" });
      const p = result[0];
      await db.update(products).set({ views: (p.views || 0) + 1 }).where(eq(products.id, req.params.id));
      return res.json({ ...p, images: JSON.parse(p.images), likes: JSON.parse(p.likes), views: (p.views || 0) + 1 });
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { id, userId, userName, userRole, userAvatar, title, description, price, category, images, city, state, inStock, deliveryInfo, contactPhone, videoUrl } = req.body;
      if (!userId || !title) return res.status(400).json({ success: false, message: "Missing required fields" });
      if (userRole !== 'teacher' && userRole !== 'supplier') return res.status(403).json({ success: false, message: "Only teachers and suppliers can list products" });

      const productId = id || randomUUID();
      const existing = await db.select().from(products).where(eq(products.id, productId));

      if (existing.length > 0) {
        await db.update(products).set({
          title, description, price: price || "0", category: category || "other",
          images: JSON.stringify(images || []), city: city || "", state: state || "",
          inStock: inStock ?? 1, deliveryInfo: deliveryInfo || "", contactPhone: contactPhone || "",
          videoUrl: videoUrl || "",
        }).where(eq(products.id, productId));
      } else {
        await db.insert(products).values({
          id: productId, userId, userName, userRole, userAvatar: userAvatar || "",
          title, description: description || "", price: price || "0", category: category || "other",
          images: JSON.stringify(images || []), city: city || "", state: state || "",
          inStock: inStock ?? 1, deliveryInfo: deliveryInfo || "", contactPhone: contactPhone || "",
          videoUrl: videoUrl || "",
        });
      }
      return res.json({ success: true, id: productId });
    } catch (error) {
      console.error("[Products] Create error:", error);
      return res.status(500).json({ success: false });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const result = await db.select().from(products).where(eq(products.id, req.params.id));
      if (result.length > 0) {
        try {
          const imgs: string[] = JSON.parse(result[0].images);
          for (const imgUrl of imgs) {
            if (imgUrl.startsWith('/uploads/')) {
              const filePath = path.resolve(process.cwd(), imgUrl.slice(1));
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          }
        } catch (e) {}
      }
      await db.delete(products).where(eq(products.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  });

  app.post("/api/products/:id/like", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false });
      const result = await db.select().from(products).where(eq(products.id, req.params.id));
      if (result.length === 0) return res.status(404).json({ success: false });
      const likes: string[] = JSON.parse(result[0].likes);
      const idx = likes.indexOf(userId);
      if (idx >= 0) likes.splice(idx, 1); else likes.push(userId);
      await db.update(products).set({ likes: JSON.stringify(likes) }).where(eq(products.id, req.params.id));
      return res.json({ success: true, likes });
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  });

  // ========== Orders routes ==========
  app.post("/api/orders", async (req, res) => {
    try {
      const { productId, productTitle, productPrice, productImage, productCategory, buyerId, buyerName, buyerPhone, buyerCity, buyerState, sellerId, sellerName, sellerRole, quantity, totalAmount, shippingAddress, buyerNotes } = req.body;
      if (!productId || !buyerId || !sellerId) return res.status(400).json({ success: false, message: "Missing required fields" });

      const orderId = randomUUID();
      const now = Date.now();
      await db.insert(orders).values({
        id: orderId, productId, productTitle: productTitle || "", productPrice: productPrice || "0",
        productImage: productImage || "", productCategory: productCategory || "",
        buyerId, buyerName: buyerName || "", buyerPhone: buyerPhone || "",
        buyerCity: buyerCity || "", buyerState: buyerState || "",
        sellerId, sellerName: sellerName || "", sellerRole: sellerRole || "",
        quantity: quantity || 1, totalAmount: totalAmount || "0", status: "pending",
        shippingAddress: shippingAddress || "", buyerNotes: buyerNotes || "", sellerNotes: "",
        updatedAt: now, createdAt: now,
      });
      const created = await db.select().from(orders).where(eq(orders.id, orderId));
      return res.json({ success: true, order: created[0] });
    } catch (error) {
      console.error("[Orders] Create error:", error);
      return res.status(500).json({ success: false, message: "Failed to create order" });
    }
  });

  app.get("/api/orders", async (req, res) => {
    try {
      const { buyerId, sellerId } = req.query;
      let result;
      if (buyerId) {
        result = await db.select().from(orders).where(eq(orders.buyerId, buyerId as string)).orderBy(desc(orders.createdAt));
      } else if (sellerId) {
        result = await db.select().from(orders).where(eq(orders.sellerId, sellerId as string)).orderBy(desc(orders.createdAt));
      } else {
        result = await db.select().from(orders).orderBy(desc(orders.createdAt));
      }
      return res.json(result);
    } catch (error) {
      console.error("[Orders] List error:", error);
      return res.status(500).json({ success: false });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const result = await db.select().from(orders).where(eq(orders.id, req.params.id));
      if (result.length === 0) return res.status(404).json({ success: false, message: "Order not found" });
      return res.json(result[0]);
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status, sellerNotes } = req.body;
      const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled', 'rejected'];
      if (!status || !validStatuses.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

      const result = await db.select().from(orders).where(eq(orders.id, req.params.id));
      if (result.length === 0) return res.status(404).json({ success: false, message: "Order not found" });

      const updateData: any = { status, updatedAt: Date.now() };
      if (sellerNotes !== undefined) updateData.sellerNotes = sellerNotes;
      await db.update(orders).set(updateData).where(eq(orders.id, req.params.id));

      const updated = await db.select().from(orders).where(eq(orders.id, req.params.id));
      return res.json({ success: true, order: updated[0] });
    } catch (error) {
      console.error("[Orders] Status update error:", error);
      return res.status(500).json({ success: false });
    }
  });

  // ========== Posts routes ==========
  app.get("/api/posts", async (_req, res) => {
    try {
      const allPosts = await db.select().from(posts).orderBy(desc(posts.createdAt));
      const parsed = allPosts.map(p => ({
        ...p,
        images: JSON.parse(p.images),
        likes: JSON.parse(p.likes),
        comments: JSON.parse(p.comments),
      }));
      return res.json(parsed);
    } catch (error) {
      console.error("[Posts] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get posts" });
    }
  });

  app.post("/api/posts", async (req, res) => {
    try {
      const { id, userId, userName, userRole, userAvatar, text: postText, images, videoUrl, category } = req.body;
      if (!userId || !userName || !userRole) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const postId = id || randomUUID();
      const now = Date.now();
      const cleanImages = sanitizeImageUrls(images || []);
      const cleanVideoUrl = sanitizeImageUrl(videoUrl || "");
      await db.insert(posts).values({
        id: postId,
        userId,
        userName,
        userRole,
        userAvatar: userAvatar || "",
        text: postText || "",
        images: JSON.stringify(cleanImages),
        videoUrl: cleanVideoUrl,
        category: category || "repair",
        likes: "[]",
        comments: "[]",
        createdAt: now,
      });

      const newPost = {
        id: postId,
        userId,
        userName,
        userRole,
        userAvatar: userAvatar || "",
        text: postText || "",
        images: cleanImages,
        videoUrl: cleanVideoUrl,
        category: category || "repair",
        likes: [],
        comments: [],
        createdAt: now,
      };

      notifyNewPost(postText || '', userName, userId).catch(() => {});

      return res.json({ success: true, post: newPost });
    } catch (error) {
      console.error("[Posts] Create error:", error);
      return res.status(500).json({ success: false, message: "Failed to create post" });
    }
  });

  app.patch("/api/posts/:id", async (req, res) => {
    try {
      const { text, images, videoUrl, category, userId } = req.body;
      if (userId) {
        const [post] = await db.select().from(posts).where(eq(posts.id, req.params.id));
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        if (post.userId !== userId) return res.status(403).json({ success: false, message: "Unauthorized" });
      }
      const updateData: any = {};
      if (text !== undefined) updateData.text = text;
      if (images !== undefined) updateData.images = images;
      if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
      if (category !== undefined) updateData.category = category;
      await db.update(posts).set(updateData).where(eq(posts.id, req.params.id));
      const updated = await db.select().from(posts).where(eq(posts.id, req.params.id));
      return res.json({ success: true, post: updated[0] || null });
    } catch (error) {
      console.error("[Posts] Update error:", error);
      return res.status(500).json({ success: false, message: "Failed to update post" });
    }
  });

  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const { userId } = req.query as { userId?: string };
      if (userId) {
        const [post] = await db.select().from(posts).where(eq(posts.id, req.params.id));
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        if (post.userId !== userId) return res.status(403).json({ success: false, message: "Unauthorized" });
      }
      await db.delete(posts).where(eq(posts.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Posts] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete post" });
    }
  });

  app.post("/api/posts/:id/like", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: "userId required" });

      const result = await db.select().from(posts).where(eq(posts.id, req.params.id));
      if (result.length === 0) return res.status(404).json({ success: false, message: "Post not found" });

      const post = result[0];
      const currentLikes: string[] = JSON.parse(post.likes);
      const idx = currentLikes.indexOf(userId);
      if (idx >= 0) {
        currentLikes.splice(idx, 1);
      } else {
        currentLikes.push(userId);
      }

      await db.update(posts).set({ likes: JSON.stringify(currentLikes) }).where(eq(posts.id, req.params.id));
      return res.json({ success: true, likes: currentLikes });
    } catch (error) {
      console.error("[Posts] Like error:", error);
      return res.status(500).json({ success: false, message: "Failed to toggle like" });
    }
  });

  app.post("/api/posts/:id/comment", async (req, res) => {
    try {
      const { userId, userName, text: commentText } = req.body;
      if (!userId || !userName || !commentText) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const result = await db.select().from(posts).where(eq(posts.id, req.params.id));
      if (result.length === 0) return res.status(404).json({ success: false, message: "Post not found" });

      const post = result[0];
      const currentComments = JSON.parse(post.comments);
      const newComment = {
        id: randomUUID(),
        userId,
        userName,
        text: commentText,
        createdAt: Date.now(),
      };
      currentComments.push(newComment);

      await db.update(posts).set({ comments: JSON.stringify(currentComments) }).where(eq(posts.id, req.params.id));
      return res.json({ success: true, comment: newComment });
    } catch (error) {
      console.error("[Posts] Comment error:", error);
      return res.status(500).json({ success: false, message: "Failed to add comment" });
    }
  });

  // ========== Jobs routes ==========
  app.get("/api/jobs", async (_req, res) => {
    try {
      const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
      const parsed = allJobs.map(j => ({
        ...j,
        skills: JSON.parse(j.skills),
      }));
      return res.json(parsed);
    } catch (error) {
      console.error("[Jobs] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get jobs" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      const { id, userId, userName, title, description, city, state, skills, salary, type } = req.body;
      if (!userId || !userName || !title) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const jobId = id || randomUUID();
      const now = Date.now();
      await db.insert(jobs).values({
        id: jobId,
        userId,
        userName,
        title,
        description: description || "",
        city: city || "",
        state: state || "",
        skills: JSON.stringify(skills || []),
        salary: salary || "",
        type: type || "full_time",
        createdAt: now,
      });

      const newJob = {
        id: jobId,
        userId,
        userName,
        title,
        description: description || "",
        city: city || "",
        state: state || "",
        skills: skills || [],
        salary: salary || "",
        type: type || "full_time",
        createdAt: now,
      };

      return res.json({ success: true, job: newJob });
    } catch (error) {
      console.error("[Jobs] Create error:", error);
      return res.status(500).json({ success: false, message: "Failed to create job" });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      await db.delete(jobs).where(eq(jobs.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Jobs] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete job" });
    }
  });

  // ========== Chat routes ==========
  // ========== Chat: Firebase Firestore backed ==========

  app.get("/api/conversations/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const fdb = getFirestore();
      const [snap1, snap2] = await Promise.all([
        fdb.collection('conversations').where('participant1Id', '==', userId).get(),
        fdb.collection('conversations').where('participant2Id', '==', userId).get(),
      ]);
      const seen = new Set<string>();
      const convos: any[] = [];
      for (const snap of [snap1, snap2]) {
        for (const doc of snap.docs) {
          if (!seen.has(doc.id)) {
            seen.add(doc.id);
            convos.push({ id: doc.id, ...doc.data() });
          }
        }
      }
      convos.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      return res.json(convos);
    } catch (error) {
      console.error("[Chat] List conversations error:", error);
      return res.status(500).json({ success: false, message: "Failed to get conversations" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const { participant1Id, participant1Name, participant1Role, participant2Id, participant2Name, participant2Role } = req.body;

      if (!participant1Id || !participant2Id) {
        return res.status(400).json({ success: false, message: "Both participants required" });
      }

      if (participant2Role === 'teacher' && participant1Role === 'technician') {
        // Teacher and Technician chat is always allowed
      } else if (participant2Role === 'supplier' && participant1Role === 'technician') {
        // Supplier and Technician chat is always allowed
      }

      const fdb = getFirestore();
      // Check for existing conversation between these two users
      const [snap1, snap2] = await Promise.all([
        fdb.collection('conversations')
          .where('participant1Id', '==', participant1Id)
          .where('participant2Id', '==', participant2Id).get(),
        fdb.collection('conversations')
          .where('participant1Id', '==', participant2Id)
          .where('participant2Id', '==', participant1Id).get(),
      ]);
      const existing = [...snap1.docs, ...snap2.docs];
      if (existing.length > 0) {
        return res.json({ success: true, conversation: { id: existing[0].id, ...existing[0].data() } });
      }

      const id = randomUUID();
      const now = Date.now();
      const newConvo = {
        id,
        participant1Id, participant1Name, participant1Role,
        participant2Id, participant2Name, participant2Role,
        lastMessage: "",
        lastMessageSenderId: "",
        lastMessageAt: now,
        createdAt: now,
      };

      await fdb.collection('conversations').doc(id).set(newConvo);
      return res.json({ success: true, conversation: newConvo });
    } catch (error) {
      console.error("[Chat] Create conversation error:", error);
      return res.status(500).json({ success: false, message: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const fdb = getFirestore();
      // Delete all messages in this conversation
      const msgsSnap = await fdb.collection('messages').where('conversationId', '==', id).get();
      const batch = fdb.batch();
      msgsSnap.docs.forEach(doc => batch.delete(doc.ref));
      batch.delete(fdb.collection('conversations').doc(id));
      await batch.commit();
      return res.json({ success: true });
    } catch (error) {
      console.error("[Chat] Delete conversation error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete conversation" });
    }
  });

  app.get("/api/messages/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const fdb = getFirestore();
      const snap = await fdb.collection('messages')
        .where('conversationId', '==', conversationId)
        .get();
      const msgs = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return res.json(msgs);
    } catch (error) {
      console.error("[Chat] Get messages error:", error);
      return res.status(500).json({ success: false, message: "Failed to get messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const { conversationId, senderId, senderName, text: msgText, image } = req.body;

      if (!conversationId || !senderId || !senderName) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const id = randomUUID();
      const now = Date.now();
      const cleanImage = sanitizeImageUrl(image || "");
      const cleanText = (msgText || "").trim();

      if (!cleanText && !cleanImage) {
        return res.json({ success: true, message: { id, conversationId, senderId, senderName, text: "", image: "", createdAt: now } });
      }

      const newMsg = { id, conversationId, senderId, senderName, text: cleanText, image: cleanImage, createdAt: now };

      const fdb = getFirestore();
      const lastMsg = cleanImage ? (cleanText || "📷 Photo") : cleanText;

      const convoRef = fdb.collection('conversations').doc(conversationId);
      const convoDoc = await convoRef.get();

      if (!convoDoc.exists) {
        // If the conversation doc doesn't exist in Firestore, we should probably check PostgreSQL
        // but for now let's just create it if we have enough info, or return error
        console.warn(`[Chat] Conversation ${conversationId} not found in Firestore. Creating it...`);
        // We'll try to find it in PG first to sync it
        const [pgConvo] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
        if (pgConvo) {
          await convoRef.set({
            ...pgConvo,
            lastMessage: lastMsg,
            lastMessageSenderId: senderId,
            lastMessageAt: now,
          });
        } else {
          // Fallback if not even in PG
          await convoRef.set({
            id: conversationId,
            participant1Id: senderId, // This is a guess/fallback
            participant1Name: senderName,
            participant1Role: 'technician',
            participant2Id: '',
            participant2Name: 'User',
            participant2Role: 'customer',
            lastMessage: lastMsg,
            lastMessageSenderId: senderId,
            lastMessageAt: now,
            createdAt: now,
          });
        }
      } else {
        await convoRef.update({
          lastMessage: lastMsg,
          lastMessageSenderId: senderId,
          lastMessageAt: now,
        });
      }

      await fdb.collection('messages').doc(id).set(newMsg);

      const convoData = convoDoc.exists ? convoDoc.data() : null;
      if (convoData) {
        const recipientId = convoData.participant1Id === senderId
          ? convoData.participant2Id
          : convoData.participant1Id;
        if (recipientId && recipientId !== senderId) {
          const msgPreview = cleanImage ? (cleanText || '📷 Photo') : cleanText.slice(0, 80);
          notifyUser(recipientId, {
            title: senderName,
            body: msgPreview,
            data: { type: 'chat_message', conversationId },
          }).catch(() => {});
        }
      }

      return res.json({ success: true, message: newMsg });
    } catch (error) {
      console.error("[Chat] Send message error:", error);
      return res.status(500).json({ success: false, message: "Failed to send message" });
    }
  });

  app.get("/api/messages/:conversationId/since/:timestamp", async (req, res) => {
    try {
      const { conversationId, timestamp } = req.params;
      const ts = parseInt(timestamp);
      const fdb = getFirestore();
      const snap = await fdb.collection('messages')
        .where('conversationId', '==', conversationId)
        .get();
      const msgs = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(m => (m.createdAt || 0) > ts)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return res.json(msgs);
    } catch (error) {
      console.error("[Chat] Poll messages error:", error);
      return res.status(500).json({ success: false, message: "Failed to poll messages" });
    }
  });

  // ========== Reels ==========
  app.get("/api/reels", async (_req, res) => {
    try {
      const allReels = await db.select().from(reels).orderBy(desc(reels.createdAt));
      const mapped = allReels.map(r => ({
        ...r,
        likes: JSON.parse(r.likes || "[]"),
        comments: JSON.parse(r.comments || "[]"),
      }));
      return res.json(mapped);
    } catch (error) {
      console.error("[Reels] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to list reels" });
    }
  });

  app.post("/api/reels", async (req, res) => {
    try {
      const { userId, userName, userAvatar, title, description, videoUrl, thumbnailUrl } = req.body;
      if (!userId || !videoUrl) {
        return res.status(400).json({ success: false, message: "userId and videoUrl required" });
      }

      const id = randomUUID();
      const now = Date.now();

      await db.insert(reels).values({
        id,
        userId,
        userName: userName || "",
        userAvatar: userAvatar || "",
        title: title || "",
        description: description || "",
        videoUrl,
        thumbnailUrl: thumbnailUrl || "",
        likes: "[]",
        comments: "[]",
        views: 0,
        createdAt: now,
      });

      const reel = {
        id, userId, userName: userName || "", userAvatar: userAvatar || "",
        title: title || "", description: description || "", videoUrl,
        thumbnailUrl: thumbnailUrl || "", likes: [], comments: [], views: 0, createdAt: now,
      };

      return res.json({ success: true, reel });
    } catch (error) {
      console.error("[Reels] Create error:", error);
      return res.status(500).json({ success: false, message: "Failed to create reel" });
    }
  });

  app.post("/api/reels/:id/like", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: "userId required" });

      const [reel] = await db.select().from(reels).where(eq(reels.id, id));
      if (!reel) return res.status(404).json({ success: false, message: "Reel not found" });

      const likesList: string[] = JSON.parse(reel.likes || "[]");
      const idx = likesList.indexOf(userId);
      if (idx >= 0) likesList.splice(idx, 1);
      else likesList.push(userId);

      await db.update(reels).set({ likes: JSON.stringify(likesList) }).where(eq(reels.id, id));
      return res.json({ success: true, likes: likesList });
    } catch (error) {
      console.error("[Reels] Like error:", error);
      return res.status(500).json({ success: false, message: "Failed to like reel" });
    }
  });

  app.post("/api/reels/:id/comment", async (req, res) => {
    try {
      const { userId, userName, text: commentText } = req.body;
      if (!userId || !userName || !commentText) {
        return res.status(400).json({ success: false, message: "userId, userName, text required" });
      }

      const [reel] = await db.select().from(reels).where(eq(reels.id, req.params.id));
      if (!reel) return res.status(404).json({ success: false, message: "Reel not found" });

      const currentComments = JSON.parse(reel.comments || "[]");
      const newComment = {
        id: randomUUID(),
        userId,
        userName,
        text: commentText,
        createdAt: Date.now(),
      };
      currentComments.push(newComment);

      await db.update(reels).set({ comments: JSON.stringify(currentComments) }).where(eq(reels.id, req.params.id));
      return res.json({ success: true, comment: newComment, comments: currentComments });
    } catch (error) {
      console.error("[Reels] Comment error:", error);
      return res.status(500).json({ success: false, message: "Failed to add comment" });
    }
  });

  app.delete("/api/reels/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(reels).where(eq(reels.id, id));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Reels] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete reel" });
    }
  });

  const diskVideoUpload = multer({
    storage: diskStorage,
    limits: { fileSize: 2048 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("video/")) {
        cb(null, true);
      } else {
        cb(new Error("Only video files are allowed"));
      }
    },
  });

  app.post("/api/upload-video", (req, res, next) => {
    diskVideoUpload.single("video")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ success: false, message: "Video file is too large. Maximum size is 2GB." });
        }
        return res.status(400).json({ success: false, message: err.message || "Upload error" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No video file provided" });
      }
      const ext = path.extname(req.file.originalname) || ".mp4";
      const storageName = `videos/${randomUUID()}${ext}`;

      if (bunnyAvailable) {
        const localPath = req.file.path;
        const fileSize = req.file.size;
        console.log(`[Upload] Streaming video to Bunny: ${fileSize} bytes from ${localPath}`);
        if (fileSize === 0) {
          fs.unlink(localPath, () => {});
          return res.status(400).json({ success: false, message: "Video file is empty" });
        }

        const reelStorageName = `reels/${randomUUID()}${ext}`;
        const bunnyUrl = `${BUNNY_STORAGE_ENDPOINT}/${BUNNY_STORAGE_ZONE_NAME}/${reelStorageName}`;

        // Stream file directly to Bunny.net — no in-memory buffering
        const { Readable } = await import("stream");
        const readStream = fs.createReadStream(localPath);
        const webStream = Readable.toWeb(readStream) as ReadableStream;

        const bunnyRes = await fetch(bunnyUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_STORAGE_API_KEY,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(fileSize),
          },
          body: webStream,
          duplex: 'half',
        } as any);

        fs.unlink(localPath, () => {});

        if (!bunnyRes.ok) {
          const errText = await bunnyRes.text().catch(() => '');
          console.error(`[Upload] Bunny upload failed: ${bunnyRes.status} ${errText}`);
          return res.status(500).json({ success: false, message: "Video upload to CDN failed" });
        }

        const videoUrl = `${BUNNY_CDN_URL}/${reelStorageName}`;
        console.log(`[Upload] Video streamed to Bunny: ${videoUrl} (${fileSize} bytes)`);
        return res.json({ success: true, url: videoUrl });
      } else {
        const videoUrl = `/uploads/${req.file.filename}`;
        console.log(`[Upload] Video saved locally: ${videoUrl} (${req.file.size} bytes)`);
        return res.json({ success: true, url: videoUrl });
      }
    } catch (error) {
      console.error("[Upload] Video error:", error);
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return res.status(500).json({ success: false, message: "Video upload failed" });
    }
  });

  // ========== Course routes ==========
  app.get("/api/courses", async (req, res) => {
    try {
      const { teacherId, published } = req.query;
      let allCourses;
      if (teacherId) {
        allCourses = await db.select().from(courses)
          .where(eq(courses.teacherId, teacherId as string))
          .orderBy(desc(courses.createdAt));
      } else if (published === 'true') {
        allCourses = await db.select().from(courses)
          .where(eq(courses.isPublished, 1))
          .orderBy(desc(courses.createdAt));
      } else {
        allCourses = await db.select().from(courses).orderBy(desc(courses.createdAt));
      }
      return res.json(allCourses);
    } catch (error) {
      console.error("[Courses] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get courses" });
    }
  });

  // AI-powered personalized course recommendations
  app.get("/api/courses/personalized-recommendations", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId required" });

      // Fetch user profile
      const [userProfile] = await db.select().from(profiles).where(eq(profiles.id, userId as string));
      if (!userProfile) return res.status(404).json({ error: "User not found" });

      // Fetch enrolled course IDs
      const enrollments = await db.select().from(courseEnrollments)
        .where(eq(courseEnrollments.studentId, userId as string));
      const enrolledIds = new Set(enrollments.map(e => e.courseId));

      // Fetch all published courses not yet enrolled
      const allCourses = await db.select().from(courses)
        .where(eq(courses.isPublished, 1))
        .orderBy(desc(courses.enrollmentCount));

      const unenrolledCourses = allCourses.filter(c => !enrolledIds.has(c.id));

      if (unenrolledCourses.length === 0) {
        return res.json({ recommendations: [] });
      }

      // Parse user skills
      let userSkills: string[] = [];
      try { userSkills = JSON.parse(userProfile.skills || '[]'); } catch {}

      // Build prompt
      const courseList = unenrolledCourses.slice(0, 50).map(c => ({
        id: c.id,
        title: c.title,
        category: c.category,
        teacherName: c.teacherName,
        description: c.description?.slice(0, 100) || '',
        price: c.price,
        totalVideos: c.totalVideos,
        enrollmentCount: c.enrollmentCount,
        language: c.language,
      }));

      const userContext = `
Role: ${userProfile.role}
Skills: ${userSkills.join(', ') || 'none listed'}
Location: ${userProfile.city || 'unknown'}, ${userProfile.state || ''}
Already enrolled in ${enrolledIds.size} courses.
      `.trim();

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a learning advisor for a mobile repair and electronics education platform. 
Recommend courses that are most relevant to the user's background and goals.
Always respond with valid JSON only — no markdown, no explanation outside the JSON.`,
          },
          {
            role: "user",
            content: `User profile:
${userContext}

Available courses (JSON):
${JSON.stringify(courseList, null, 2)}

Pick the top 5 most relevant course IDs for this user. For each, write a short 1-sentence reason (max 12 words) explaining why it suits them.
Respond with this exact JSON format:
[{"id": "...", "reason": "..."}, ...]`,
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      let picks: { id: string; reason: string }[] = [];
      try {
        const raw = completion.choices[0].message.content || '[]';
        const clean = raw.replace(/```json|```/g, '').trim();
        picks = JSON.parse(clean);
      } catch {
        picks = [];
      }

      // Map picks to full course objects
      const courseMap = new Map(unenrolledCourses.map(c => [c.id, c]));
      const recommendations = picks
        .filter(p => courseMap.has(p.id))
        .map(p => ({ ...courseMap.get(p.id)!, reason: p.reason }))
        .slice(0, 5);

      return res.json({ recommendations });
    } catch (error) {
      console.error("[AI Recommendations] Error:", error);
      return res.status(500).json({ error: "Failed to get recommendations" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const [course] = await db.select().from(courses).where(eq(courses.id, req.params.id));
      if (!course) return res.status(404).json({ success: false, message: "Course not found" });

      const chapters = await db.select().from(courseChapters)
        .where(eq(courseChapters.courseId, req.params.id))
        .orderBy(courseChapters.sortOrder);

      const chaptersWithVideos = await Promise.all(chapters.map(async (chapter) => {
        const videos = await db.select().from(courseVideos)
          .where(eq(courseVideos.chapterId, chapter.id))
          .orderBy(courseVideos.sortOrder);
        return { ...chapter, videos };
      }));

      return res.json({ ...course, chapters: chaptersWithVideos });
    } catch (error) {
      console.error("[Courses] Get error:", error);
      return res.status(500).json({ success: false, message: "Failed to get course" });
    }
  });

  app.post("/api/courses", async (req, res) => {
    try {
      const { id, teacherId, teacherName, teacherAvatar, title, description, price, coverImage, category, language, demoDuration, accessDays, isPublished } = req.body;
      if (!teacherId || !title) {
        return res.status(400).json({ success: false, message: "teacherId and title are required" });
      }

      const courseId = id || randomUUID();
      const now = Date.now();

      if (id) {
        const [existing] = await db.select().from(courses).where(eq(courses.id, id));
        if (existing) {
          const updateData: any = {};
          if (title !== undefined) updateData.title = title;
          if (description !== undefined) updateData.description = description;
          if (price !== undefined) updateData.price = price;
          if (coverImage !== undefined) updateData.coverImage = coverImage;
          if (category !== undefined) updateData.category = category;
          if (language !== undefined) updateData.language = language;
          if (demoDuration !== undefined) updateData.demoDuration = demoDuration;
          if (accessDays !== undefined) updateData.accessDays = accessDays;
          if (isPublished !== undefined) updateData.isPublished = isPublished;
          if (teacherName !== undefined) updateData.teacherName = teacherName;
          if (teacherAvatar !== undefined) updateData.teacherAvatar = teacherAvatar;

          await db.update(courses).set(updateData).where(eq(courses.id, id));
          const [updated] = await db.select().from(courses).where(eq(courses.id, id));
          return res.json({ success: true, course: updated });
        }
      }

      await db.insert(courses).values({
        id: courseId,
        teacherId,
        teacherName: teacherName || "",
        teacherAvatar: teacherAvatar || "",
        title,
        description: description || "",
        price: price || "0",
        coverImage: coverImage || "",
        category: category || "course",
        language: language || "hindi",
        demoDuration: demoDuration || 60,
        accessDays: accessDays || 365,
        totalVideos: 0,
        totalDuration: 0,
        enrollmentCount: 0,
        rating: "0",
        isPublished: isPublished || 0,
        createdAt: now,
      });

      const [newCourse] = await db.select().from(courses).where(eq(courses.id, courseId));

      // Notify all users about the new course (fire-and-forget)
      if (newCourse?.isPublished === 1) {
        (async () => {
          try {
            await notifyAllUsers({
              title: `📚 New Course Available!`,
              body: `"${title}" by ${teacherName || 'a teacher'} — Enroll now!`,
              data: { type: 'new_course', courseId },
            }, teacherId);
          } catch (e) { console.warn('[Push] New course notify failed:', e); }
        })();
      }

      return res.json({ success: true, course: newCourse });
    } catch (error) {
      console.error("[Courses] Create error:", error);
      return res.status(500).json({ success: false, message: "Failed to create course" });
    }
  });

  app.put("/api/courses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, price, coverImage, category, language, demoDuration, accessDays, isPublished, teacherName, teacherAvatar } = req.body;

      const [existing] = await db.select().from(courses).where(eq(courses.id, id));
      if (!existing) {
        return res.status(404).json({ success: false, message: "Course not found" });
      }

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) updateData.price = price;
      if (coverImage !== undefined) updateData.coverImage = coverImage;
      if (category !== undefined) updateData.category = category;
      if (language !== undefined) updateData.language = language;
      if (demoDuration !== undefined) updateData.demoDuration = demoDuration;
      if (accessDays !== undefined) updateData.accessDays = accessDays;
      if (isPublished !== undefined) updateData.isPublished = isPublished;
      if (teacherName !== undefined) updateData.teacherName = teacherName;
      if (teacherAvatar !== undefined) updateData.teacherAvatar = teacherAvatar;

      const wasUnpublished = existing.isPublished !== 1;
      await db.update(courses).set(updateData).where(eq(courses.id, id));
      const [updated] = await db.select().from(courses).where(eq(courses.id, id));

      // Notify all users when a course is newly published
      if (isPublished === 1 && wasUnpublished) {
        (async () => {
          try {
            await notifyAllUsers({
              title: `📚 New Course Available!`,
              body: `"${updated.title}" by ${updated.teacherName || 'a teacher'} — Enroll now!`,
              data: { type: 'new_course', courseId: id },
            }, updated.teacherId || '');
          } catch (e) { console.warn('[Push] Course publish notify failed:', e); }
        })();
      }

      return res.json({ success: true, course: updated });
    } catch (error) {
      console.error("[Courses] Update error:", error);
      return res.status(500).json({ success: false, message: "Failed to update course" });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const videos = await db.select().from(courseVideos).where(eq(courseVideos.courseId, id));
      for (const video of videos) {
        await db.delete(dubbedVideos).where(eq(dubbedVideos.videoId, video.id));
      }
      await db.delete(courseVideos).where(eq(courseVideos.courseId, id));
      await db.delete(courseChapters).where(eq(courseChapters.courseId, id));
      await db.delete(courseEnrollments).where(eq(courseEnrollments.courseId, id));
      await db.delete(dubbedVideos).where(eq(dubbedVideos.courseId, id));
      await db.delete(courses).where(eq(courses.id, id));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Courses] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete course" });
    }
  });

  app.post("/api/courses/:courseId/chapters", async (req, res) => {
    try {
      const { courseId } = req.params;
      const { title, description, sortOrder } = req.body;
      if (!title) {
        return res.status(400).json({ success: false, message: "Title is required" });
      }

      const id = randomUUID();
      const now = Date.now();
      await db.insert(courseChapters).values({
        id,
        courseId,
        title,
        description: description || "",
        sortOrder: sortOrder || 0,
        createdAt: now,
      });

      const [chapter] = await db.select().from(courseChapters).where(eq(courseChapters.id, id));
      return res.json({ success: true, chapter });
    } catch (error) {
      console.error("[Courses] Create chapter error:", error);
      return res.status(500).json({ success: false, message: "Failed to create chapter" });
    }
  });

  app.put("/api/courses/:courseId/chapters/:chapterId", async (req, res) => {
    try {
      const { chapterId } = req.params;
      const { title, description, sortOrder } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      await db.update(courseChapters).set(updateData).where(eq(courseChapters.id, chapterId));
      const [updated] = await db.select().from(courseChapters).where(eq(courseChapters.id, chapterId));
      return res.json({ success: true, chapter: updated });
    } catch (error) {
      console.error("[Courses] Update chapter error:", error);
      return res.status(500).json({ success: false, message: "Failed to update chapter" });
    }
  });

  app.delete("/api/courses/:courseId/chapters/:chapterId", async (req, res) => {
    try {
      const { chapterId } = req.params;
      const videos = await db.select().from(courseVideos).where(eq(courseVideos.chapterId, chapterId));
      for (const video of videos) {
        await db.delete(dubbedVideos).where(eq(dubbedVideos.videoId, video.id));
      }
      await db.delete(courseVideos).where(eq(courseVideos.chapterId, chapterId));
      await db.delete(courseChapters).where(eq(courseChapters.id, chapterId));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Courses] Delete chapter error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete chapter" });
    }
  });

  app.post("/api/courses/:courseId/chapters/:chapterId/videos", async (req, res) => {
    try {
      const { courseId, chapterId } = req.params;
      const { title, description, videoUrl, thumbnailUrl, duration, sortOrder, isDemo } = req.body;
      if (!title || !videoUrl) {
        return res.status(400).json({ success: false, message: "Title and videoUrl are required" });
      }

      const id = randomUUID();
      const now = Date.now();
      const videoDuration = duration || 0;

      await db.insert(courseVideos).values({
        id,
        courseId,
        chapterId,
        title,
        description: description || "",
        videoUrl,
        thumbnailUrl: thumbnailUrl || "",
        duration: videoDuration,
        sortOrder: sortOrder || 0,
        isDemo: isDemo || 0,
        createdAt: now,
      });

      const allVideos = await db.select().from(courseVideos).where(eq(courseVideos.courseId, courseId));
      const totalVideos = allVideos.length;
      const totalDuration = allVideos.reduce((sum, v) => sum + (v.duration || 0), 0);
      await db.update(courses).set({ totalVideos, totalDuration }).where(eq(courses.id, courseId));

      const [video] = await db.select().from(courseVideos).where(eq(courseVideos.id, id));

      // Auto-dub using actual course source language
      const [courseRow] = await db.select().from(courses).where(eq(courses.id, courseId));
      const sourceLang = courseRow?.language || 'hi';
      const { dubVideo, getSupportedLanguages } = await import("./dubbing");
      const targetLanguages = getSupportedLanguages().filter(lang => lang !== sourceLang);

      (async () => {
        for (const lang of targetLanguages) {
          try {
            console.log(`[Auto-Dub] ${sourceLang} → ${lang} for video ${id}`);
            await dubVideo(id, courseId, lang, sourceLang);
            await new Promise(r => setTimeout(r, 5000));
          } catch (err) {
            console.error(`[Auto-Dub] Failed for video ${id} lang ${lang}:`, err);
          }
        }
      })();

      // Notify all users about new video content (fire-and-forget)
      (async () => {
        try {
          const [courseRow2] = await db.select({ title: courses.title, teacherName: courses.teacherName, teacherId: courses.teacherId, isPublished: courses.isPublished })
            .from(courses).where(eq(courses.id, courseId));
          if (courseRow2?.isPublished === 1) {
            await notifyAllUsers({
              title: `🎬 New Video Added!`,
              body: `"${title}" added to "${courseRow2.title}" by ${courseRow2.teacherName || 'a teacher'}`,
              data: { type: 'new_video', courseId },
            }, courseRow2.teacherId || '');
          }
        } catch (e) {
          console.warn('[Push] Failed to notify about new video:', e);
        }
      })();

      return res.json({ success: true, video });
    } catch (error) {
      console.error("[Courses] Create video error:", error);
      return res.status(500).json({ success: false, message: "Failed to create video" });
    }
  });

  app.delete("/api/courses/:courseId/videos/:videoId", async (req, res) => {
    try {
      const { courseId, videoId } = req.params;
      await db.delete(dubbedVideos).where(eq(dubbedVideos.videoId, videoId));
      await db.delete(courseVideos).where(eq(courseVideos.id, videoId));

      const allVideos = await db.select().from(courseVideos).where(eq(courseVideos.courseId, courseId));
      const totalVideos = allVideos.length;
      const totalDuration = allVideos.reduce((sum, v) => sum + (v.duration || 0), 0);
      await db.update(courses).set({ totalVideos, totalDuration }).where(eq(courses.id, courseId));

      return res.json({ success: true });
    } catch (error) {
      console.error("[Courses] Delete video error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete video" });
    }
  });

  app.post("/api/videos/:videoId/complete", async (req, res) => {
    try {
      const { videoId } = req.params;
      const { userId, courseId } = req.body;
      if (!userId || !videoId) return res.json({ success: true });
      const existing = await db.select().from(courseEnrollments)
        .where(and(eq(courseEnrollments.courseId, courseId || ''), eq(courseEnrollments.studentId, userId)));
      if (existing.length > 0) {
        const enrollment = existing[0];
        const completedVideos: string[] = enrollment.completedVideos ? JSON.parse(enrollment.completedVideos as string) : [];
        if (!completedVideos.includes(videoId)) {
          completedVideos.push(videoId);
          await db.update(courseEnrollments)
            .set({ completedVideos: JSON.stringify(completedVideos) })
            .where(eq(courseEnrollments.id, enrollment.id));
        }
      }
      return res.json({ success: true });
    } catch (error) {
      return res.json({ success: true });
    }
  });

  app.get("/api/videos/:videoId/progress", async (req, res) => {
    try {
      const { videoId } = req.params;
      const { userId } = req.query as { userId: string };
      if (!userId || !videoId) return res.json({ position: 0, duration: 0 });
      const [row] = await db.select().from(videoProgress)
        .where(and(eq(videoProgress.userId, userId), eq(videoProgress.videoId, videoId)));
      return res.json({ position: row?.position ?? 0, duration: row?.duration ?? 0 });
    } catch (error) {
      return res.json({ position: 0, duration: 0 });
    }
  });

  app.post("/api/videos/:videoId/progress", async (req, res) => {
    try {
      const { videoId } = req.params;
      const { userId, position, duration } = req.body;
      if (!userId || !videoId) return res.json({ success: true });
      const existing = await db.select().from(videoProgress)
        .where(and(eq(videoProgress.userId, userId), eq(videoProgress.videoId, videoId)));
      if (existing.length > 0) {
        await db.update(videoProgress)
          .set({ position: Math.floor(position || 0), duration: Math.floor(duration || 0), updatedAt: Date.now() })
          .where(and(eq(videoProgress.userId, userId), eq(videoProgress.videoId, videoId)));
      } else {
        await db.insert(videoProgress).values({
          id: randomUUID(),
          userId,
          videoId,
          position: Math.floor(position || 0),
          duration: Math.floor(duration || 0),
          updatedAt: Date.now(),
        });
      }
      return res.json({ success: true });
    } catch (error) {
      return res.json({ success: true });
    }
  });

  app.get("/api/courses/:courseId/recommendations", async (req, res) => {
    try {
      const { courseId } = req.params;
      const { studentId } = req.query as { studentId: string };

      const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
      if (!course) return res.status(404).json({ error: "Course not found" });

      const chapters = await db.select().from(courseChapters).where(eq(courseChapters.courseId, courseId));
      const videos = await db.select().from(courseVideos).where(eq(courseVideos.courseId, courseId));

      let completedVideoIds: string[] = [];
      if (studentId) {
        const enrollments = await db.select().from(courseEnrollments)
          .where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId)));
        if (enrollments.length > 0) {
          try { completedVideoIds = JSON.parse(enrollments[0].completedVideos as string || "[]"); } catch {}
        }
      }

      const totalVideos = videos.length;
      const completedCount = completedVideoIds.length;
      const progressPct = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;
      const sortedVideos = [...videos].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const nextVideo = sortedVideos.find(v => !completedVideoIds.includes(v.id));

      const chapterProgress = chapters.map(ch => {
        const chVids = videos.filter(v => v.chapterId === ch.id);
        const chCompleted = chVids.filter(v => completedVideoIds.includes(v.id)).length;
        return { chapterTitle: ch.title, total: chVids.length, completed: chCompleted, chapterId: ch.id };
      });

      const completedVideos = sortedVideos.filter(v => completedVideoIds.includes(v.id)).map(v => v.title);
      const remainingVideos = sortedVideos.filter(v => !completedVideoIds.includes(v.id)).map(v => ({ id: v.id, title: v.title, chapterId: v.chapterId }));

      type Recommendation = { type: string; title: string; description: string; videoId?: string; icon: string };
      let recommendations: Recommendation[] = [];

      if (totalVideos === 0) {
        recommendations = [{ type: "start", title: "Course Content Coming Soon", description: "The instructor is preparing video content for this course. Check back soon!", icon: "time" }];
      } else {
        try {
          const openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });

          const prompt = `You are an AI study coach analyzing a student's performance in an online course.

Course: "${course.title}"
Description: ${course.description || "A practical course"}
Total Videos: ${totalVideos}
Progress: ${completedCount} of ${totalVideos} videos completed (${progressPct}%)

Chapter Progress:
${chapterProgress.map(c => `- ${c.chapterTitle}: ${c.completed}/${c.total} completed`).join('\n')}

Recently completed videos:
${completedVideos.slice(-5).length > 0 ? completedVideos.slice(-5).map(t => `- ${t}`).join('\n') : '- None yet'}

Next unwatched videos:
${remainingVideos.slice(0, 5).map(v => `- ${v.title} (id: ${v.id})`).join('\n') || '- None (all completed!)'}

Generate 4 highly personalized study recommendations for this student. Each must be specific, actionable, and motivating — not generic.

Respond ONLY with a valid JSON array (no markdown, no code blocks):
[
  {
    "type": "start|continue|finish|complete|next|focus|goal|review|challenge",
    "title": "Short compelling title (max 8 words)",
    "description": "Specific, helpful advice (2-3 sentences). Reference actual video/chapter names.",
    "videoId": "video-id-from-list-or-null",
    "icon": "one of: rocket|trending-up|star|flag|trophy|play-circle|bulb|calendar-outline|refresh|checkmark-circle|flame|book"
  }
]`;

          const response = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [{ role: "user", content: prompt }],
            max_completion_tokens: 1200,
          });

          const content = response.choices[0]?.message?.content || "[]";
          const cleaned = content.trim().replace(/^```json?\n?/, '').replace(/```$/, '').trim();
          const parsed: Recommendation[] = JSON.parse(cleaned);

          if (Array.isArray(parsed) && parsed.length > 0) {
            recommendations = parsed.map(r => ({
              type: r.type || "next",
              title: r.title || "Study Tip",
              description: r.description || "",
              videoId: r.videoId && r.videoId !== "null" ? r.videoId : undefined,
              icon: r.icon || "bulb",
            }));
          }
        } catch (aiError) {
          console.warn("[Recommendations] AI generation failed, using fallback:", aiError);
          if (progressPct === 0) {
            recommendations = [{ type: "start", title: "Start Your Learning Journey", description: `Begin with the first video of "${course.title}" to build your skills from the ground up.`, videoId: sortedVideos[0]?.id, icon: "rocket" }];
          } else if (progressPct < 100) {
            recommendations = [{ type: "continue", title: "Keep Going!", description: `You're ${progressPct}% done. ${nextVideo ? `Next up: "${nextVideo.title}"` : "Great work!"}`, videoId: nextVideo?.id, icon: "trending-up" }];
          } else {
            recommendations = [{ type: "complete", title: "Course Completed!", description: "Congratulations! You've finished all videos. Consider revisiting chapters to reinforce your learning.", icon: "trophy" }];
          }
          if (nextVideo) {
            const nextChapter = chapters.find(c => c.id === nextVideo.chapterId);
            recommendations.push({ type: "next", title: `Watch Next: ${nextVideo.title}`, description: `Continue from where you left off${nextChapter ? ` in "${nextChapter.title}"` : ""}.`, videoId: nextVideo.id, icon: "play-circle" });
          }
        }
      }

      return res.json({ recommendations, progress: { completed: completedCount, total: totalVideos, percentage: progressPct }, nextVideoId: nextVideo?.id });
    } catch (error) {
      console.error("[Recommendations] Error:", error);
      return res.status(500).json({ error: "Failed to get recommendations" });
    }
  });

  app.post("/api/courses/:courseId/enroll", async (req, res) => {
    try {
      const { courseId } = req.params;
      const { studentId, studentName, studentPhone, teacherId } = req.body;
      if (!studentId || !studentName) {
        return res.status(400).json({ success: false, message: "studentId and studentName are required" });
      }

      const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
      if (!course) return res.status(404).json({ success: false, message: "Course not found" });

      const existing = await db.select().from(courseEnrollments)
        .where(and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.studentId, studentId)
        ));
      if (existing.length > 0) {
        return res.json({ success: true, enrollment: existing[0], message: "Already enrolled" });
      }

      const now = Date.now();
      const accessDays = course.accessDays || 365;
      const expiresAt = now + accessDays * 24 * 60 * 60 * 1000;
      const id = randomUUID();

      await db.insert(courseEnrollments).values({
        id,
        courseId,
        studentId,
        studentName,
        studentPhone: studentPhone || "",
        teacherId: teacherId || course.teacherId,
        status: "active",
        paymentStatus: "pending",
        expiresAt,
        createdAt: now,
      });

      await db.update(courses).set({ enrollmentCount: (course.enrollmentCount || 0) + 1 }).where(eq(courses.id, courseId));

      const [enrollment] = await db.select().from(courseEnrollments).where(eq(courseEnrollments.id, id));
      return res.json({ success: true, enrollment });
    } catch (error) {
      console.error("[Courses] Enroll error:", error);
      return res.status(500).json({ success: false, message: "Failed to enroll" });
    }
  });

  app.get("/api/enrollments", async (req, res) => {
    try {
      const { studentId, teacherId } = req.query;
      let enrollments;
      if (studentId) {
        enrollments = await db.select().from(courseEnrollments)
          .where(eq(courseEnrollments.studentId, studentId as string))
          .orderBy(desc(courseEnrollments.createdAt));
      } else if (teacherId) {
        enrollments = await db.select().from(courseEnrollments)
          .where(eq(courseEnrollments.teacherId, teacherId as string))
          .orderBy(desc(courseEnrollments.createdAt));
      } else {
        enrollments = await db.select().from(courseEnrollments).orderBy(desc(courseEnrollments.createdAt));
      }
      return res.json(enrollments);
    } catch (error) {
      console.error("[Enrollments] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get enrollments" });
    }
  });

  app.get("/api/enrollments/check", async (req, res) => {
    try {
      const { courseId, studentId } = req.query;
      if (!courseId || !studentId) {
        return res.status(400).json({ success: false, message: "courseId and studentId are required" });
      }

      const existing = await db.select().from(courseEnrollments)
        .where(and(
          eq(courseEnrollments.courseId, courseId as string),
          eq(courseEnrollments.studentId, studentId as string)
        ));

      if (existing.length > 0) {
        return res.json({ enrolled: true, enrollment: existing[0] });
      }
      return res.json({ enrolled: false, enrollment: null });
    } catch (error) {
      console.error("[Enrollments] Check error:", error);
      return res.status(500).json({ success: false, message: "Failed to check enrollment" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sellerId } = req.query;
      
      if (sellerId) {
        const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.sellerId, sellerId as string)));
        if (!order) {
          return res.status(404).json({ success: false, message: "Order not found or unauthorized" });
        }
      }
      
      await db.delete(orders).where(eq(orders.id, id));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Orders] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete order" });
    }
  });
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const razorpayAvailable = !!(razorpayKeyId && razorpayKeySecret);
  
  let razorpayInstance: any = null;
  if (razorpayAvailable) {
    razorpayInstance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });
    console.log(`[Razorpay] Payment gateway initialized (key: ${razorpayKeyId.substring(0, 12)}...)`);
  } else {
    console.log('[Razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET');
  }

  app.post("/api/payments/create-order", async (req, res) => {
    try {
      if (!razorpayAvailable || !razorpayInstance) {
        return res.status(503).json({ success: false, message: "Payment gateway not configured" });
      }
      const { courseId, studentId, studentName, studentPhone } = req.body;
      if (!courseId || !studentId || !studentName) {
        return res.status(400).json({ success: false, message: "courseId, studentId, and studentName required" });
      }

      const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
      if (!course) return res.status(404).json({ success: false, message: "Course not found" });

      const existing = await db.select().from(courseEnrollments)
        .where(and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.studentId, studentId)
        ));
      if (existing.length > 0 && existing[0].status === 'active') {
        return res.json({ success: true, alreadyEnrolled: true, enrollment: existing[0] });
      }

      const amountInPaise = Math.round(parseFloat(course.price || '0') * 100);
      if (amountInPaise <= 0) {
        const now = Date.now();
        const accessDays = course.accessDays || 365;
        const expiresAt = now + accessDays * 24 * 60 * 60 * 1000;
        const id = randomUUID();
        await db.insert(courseEnrollments).values({
          id, courseId, studentId, studentName,
          studentPhone: studentPhone || "",
          teacherId: course.teacherId,
          status: "active", paymentStatus: "free", expiresAt, createdAt: now,
        });
        await db.update(courses).set({ enrollmentCount: (course.enrollmentCount || 0) + 1 }).where(eq(courses.id, courseId));
        const [enrollment] = await db.select().from(courseEnrollments).where(eq(courseEnrollments.id, id));
        return res.json({ success: true, free: true, enrollment });
      }

      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `crs_${Date.now()}`,
        notes: {
          courseId, studentId, studentName, courseTitle: course.title, teacherId: course.teacherId,
        },
      };
      const order = await razorpayInstance.orders.create(options);

      const paymentId = randomUUID();
      await db.insert(payments).values({
        id: paymentId,
        razorpayOrderId: order.id,
        courseId, studentId, studentName,
        studentPhone: studentPhone || "",
        teacherId: course.teacherId,
        amount: amountInPaise,
        currency: "INR",
        status: "created",
        createdAt: Date.now(),
      });

      return res.json({
        success: true,
        orderId: order.id,
        amount: amountInPaise,
        currency: "INR",
        keyId: razorpayKeyId,
        courseName: course.title,
        teacherName: course.teacherName,
        paymentRecordId: paymentId,
      });
    } catch (error) {
      console.error("[Razorpay] Create order error:", error);
      return res.status(500).json({ success: false, message: "Failed to create payment order" });
    }
  });

  app.post("/api/payments/verify", async (req, res) => {
    try {
      if (!razorpayAvailable) {
        return res.status(503).json({ success: false, message: "Payment gateway not configured" });
      }
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId, studentId, studentName, studentPhone } = req.body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: "Payment verification data missing" });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body).digest('hex');
      const isValid = expectedSignature === razorpay_signature;

      if (!isValid) {
        await db.update(payments).set({
          status: "failed",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        }).where(eq(payments.razorpayOrderId, razorpay_order_id));
        return res.status(400).json({ success: false, message: "Payment verification failed - invalid signature" });
      }

      const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
      if (!course) {
        return res.status(404).json({ success: false, message: "Course not found" });
      }

      // Calculate commission
      const commissionSettings = await db.select().from(subscriptionSettings).where(eq(subscriptionSettings.role, 'teacher'));
      const commissionPct = parseFloat(commissionSettings[0]?.commissionPercent || '30');
      const [paymentRecord] = await db.select().from(payments).where(eq(payments.razorpayOrderId, razorpay_order_id));
      const totalAmountPaise = paymentRecord?.amount || 0;
      const adminCommissionPaise = Math.round(totalAmountPaise * commissionPct / 100);
      const teacherEarningPaise = totalAmountPaise - adminCommissionPaise;

      await db.update(payments).set({
        status: "paid",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        adminCommission: adminCommissionPaise,
        teacherEarning: teacherEarningPaise,
        commissionPercent: String(commissionPct),
        payoutStatus: "pending",
      }).where(eq(payments.razorpayOrderId, razorpay_order_id));

      const existingEnrollment = await db.select().from(courseEnrollments)
        .where(and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.studentId, studentId)
        ));
      if (existingEnrollment.length > 0) {
        await db.update(courseEnrollments).set({
          status: "active",
          paymentStatus: "paid",
        }).where(eq(courseEnrollments.id, existingEnrollment[0].id));
        const [updated] = await db.select().from(courseEnrollments).where(eq(courseEnrollments.id, existingEnrollment[0].id));
        return res.json({ success: true, enrollment: updated });
      }

      const now = Date.now();
      const accessDays = course.accessDays || 365;
      const expiresAt = now + accessDays * 24 * 60 * 60 * 1000;
      const enrollId = randomUUID();

      await db.insert(courseEnrollments).values({
        id: enrollId, courseId, studentId,
        studentName: studentName || "Student",
        studentPhone: studentPhone || "",
        teacherId: course.teacherId,
        status: "active", paymentStatus: "paid", expiresAt, createdAt: now,
      });
      await db.update(courses).set({ enrollmentCount: (course.enrollmentCount || 0) + 1 }).where(eq(courses.id, courseId));
      await db.update(payments).set({ enrollmentId: enrollId }).where(eq(payments.razorpayOrderId, razorpay_order_id));

      const [enrollment] = await db.select().from(courseEnrollments).where(eq(courseEnrollments.id, enrollId));
      return res.json({ success: true, enrollment });
    } catch (error) {
      console.error("[Razorpay] Verify payment error:", error);
      return res.status(500).json({ success: false, message: "Failed to verify payment" });
    }
  });

  // ==================== SUBSCRIPTION PAYMENT ROUTES ====================
  app.get("/api/subscription/status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const [user] = await db.select().from(profiles).where(eq(profiles.id, userId));
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      if (user.phone?.replace(/\D/g, '') === '8179142535') {
        return res.json({ active: true, plan: 'admin', end: 4102444800000 });
      }

      const role = user.role;
      const settings = await db.select().from(subscriptionSettings).where(eq(subscriptionSettings.role, role));
      const setting = settings[0];

      if (!setting || !setting.enabled) {
        return res.json({ success: true, required: false, active: true });
      }

      if (role === 'customer') {
        return res.json({ success: true, required: false, active: true });
      }

      const now = Date.now();
      const isActive = user.subscriptionActive === 1 && (user.subscriptionEnd || 0) > now;

      return res.json({
        success: true,
        required: true,
        active: isActive,
        amount: String(parseInt(setting.amount || '0', 10) || 0),
        period: setting.period,
        subscriptionEnd: user.subscriptionEnd || 0,
        role: role,
      });
    } catch (error) {
      console.error("[Subscription] Status error:", error);
      return res.status(500).json({ success: false, message: "Failed to check subscription" });
    }
  });

  app.post("/api/subscription/create-order", async (req, res) => {
    try {
      if (!razorpayAvailable || !razorpayInstance) {
        return res.status(503).json({ success: false, message: "Payment gateway not configured" });
      }
      const { userId, userName, userPhone } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: "userId required" });

      const [user] = await db.select().from(profiles).where(eq(profiles.id, userId));
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      const role = user.role;
      const settings = await db.select().from(subscriptionSettings).where(eq(subscriptionSettings.role, role));
      const setting = settings[0];
      if (!setting || !setting.enabled || role === 'customer') {
        return res.status(400).json({ success: false, message: "Subscription not required for this role" });
      }

      const amountInPaise = Math.round(parseFloat(setting.amount || '0') * 100);
      if (amountInPaise <= 0) {
        return res.status(400).json({ success: false, message: "Invalid subscription amount" });
      }

      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `sub_${role}_${Date.now()}`,
        notes: { userId, role, type: 'subscription', period: setting.period },
      };
      const order = await razorpayInstance.orders.create(options);

      return res.json({
        success: true,
        orderId: order.id,
        amount: amountInPaise,
        currency: "INR",
        keyId: razorpayKeyId,
        role: role,
        period: setting.period,
        displayAmount: String(parseInt(setting.amount || '0', 10) || 0),
      });
    } catch (error) {
      console.error("[Subscription] Create order error:", error);
      return res.status(500).json({ success: false, message: "Failed to create subscription order" });
    }
  });

  app.post("/api/subscription/verify", async (req, res) => {
    try {
      if (!razorpayAvailable) {
        return res.status(503).json({ success: false, message: "Payment gateway not configured" });
      }
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = req.body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
        return res.status(400).json({ success: false, message: "Missing payment data" });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body).digest('hex');
      const isValid = expectedSignature === razorpay_signature;

      if (!isValid) {
        return res.status(400).json({ success: false, message: "Payment verification failed" });
      }

      const now = Date.now();
      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      const subscriptionEnd = now + oneMonthMs;

      await db.update(profiles).set({
        subscriptionActive: 1,
        subscriptionEnd: subscriptionEnd,
        subscriptionOrderId: razorpay_order_id,
      }).where(eq(profiles.id, userId));

      return res.json({
        success: true,
        subscriptionActive: 1,
        subscriptionEnd: subscriptionEnd,
      });
    } catch (error) {
      console.error("[Subscription] Verify error:", error);
      return res.status(500).json({ success: false, message: "Failed to verify subscription" });
    }
  });

  app.get("/api/subscription/checkout", (req, res) => {
    const { orderId, amount, keyId, role, displayAmount, userName, userPhone, userEmail, userId } = req.query;
    
    const baseUrl = process.env.APP_DOMAIN || "https://repair-backend-us-456751858632.us-central1.run.app";

    const roleLabel = role === 'technician' ? 'Technician' : role === 'supplier' ? 'Supplier' : String(role);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Subscribe - ${roleLabel} Plan</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0D0D0D; color: #fff; min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 20px;
    }
    .container { text-align: center; max-width: 400px; width: 100%; }
    .logo { font-size: 28px; font-weight: 800; color: #FF6B35; margin-bottom: 24px; }
    .plan-name { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .plan-desc { color: #999; font-size: 14px; margin-bottom: 24px; }
    .amount { font-size: 36px; font-weight: 700; color: #FF6B35; margin-bottom: 32px; }
    .amount span { font-size: 18px; color: #999; }
    .pay-btn {
      background: #FF6B35; color: #fff; border: none; padding: 16px 48px;
      font-size: 18px; font-weight: 700; border-radius: 12px; cursor: pointer;
      width: 100%; transition: opacity 0.2s;
    }
    .pay-btn:hover { opacity: 0.9; }
    .pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status { margin-top: 24px; font-size: 14px; color: #999; }
    .success { color: #4CAF50; font-size: 18px; font-weight: 600; }
    .failed { color: #F44336; font-size: 18px; font-weight: 600; }
    .secure { margin-top: 16px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Mobi</div>
    <div class="plan-name">${roleLabel} Monthly Plan</div>
    <div class="plan-desc">Unlock all features for 30 days</div>
    <div class="amount">\\u20B9${displayAmount || '0'} <span>/month</span></div>
    <button class="pay-btn" id="payBtn" onclick="startPayment()">Subscribe Now</button>
    <div class="status" id="status"></div>
    <div class="secure">&#128274; Secured by Razorpay</div>
  </div>
  <script>
    function startPayment() {
      document.getElementById('payBtn').disabled = true;
      document.getElementById('status').textContent = 'Opening payment...';
      
      var options = {
        key: '${keyId}',
        amount: ${amount || 0},
        currency: 'INR',
        name: 'Mobi',
        description: '${roleLabel} Monthly Subscription',
        order_id: '${orderId}',
        prefill: {
          name: '${userName || ''}',
          contact: '${userPhone || ''}',
          email: '${userEmail || ''}'
        },
        theme: { color: '#FF6B35' },
        handler: function(response) {
          document.getElementById('status').innerHTML = '<div class="success">Payment Successful! Activating...</div>';
          fetch('${baseUrl}/api/subscription/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: '${userId}'
            })
          }).then(r => r.json()).then(data => {
            if (data.success) {
              document.getElementById('status').innerHTML = '<div class="success">\\u2705 Subscription Activated! You can close this page.</div>';
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'subscription_success', ...data }));
              }
            } else {
              document.getElementById('status').innerHTML = '<div class="failed">Verification failed. Contact support.</div>';
            }
          }).catch(() => {
            document.getElementById('status').innerHTML = '<div class="failed">Network error. Please try again.</div>';
          });
        },
        modal: {
          ondismiss: function() {
            document.getElementById('payBtn').disabled = false;
            document.getElementById('status').textContent = 'Payment cancelled';
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.open();
    }
    setTimeout(startPayment, 500);
  <\/script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  app.get("/api/payments/checkout", (req, res) => {
    const { orderId, amount, keyId, courseName, teacherName, studentName, studentPhone, studentEmail, courseId, studentId } = req.query;
    
    const baseUrl = process.env.APP_DOMAIN || "https://repair-backend-us-456751858632.us-central1.run.app";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment - ${courseName || 'Course'}</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0D0D0D; color: #fff; min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 20px;
    }
    .container { text-align: center; max-width: 400px; width: 100%; }
    .logo { font-size: 28px; font-weight: 800; color: #FF6B35; margin-bottom: 24px; }
    .course-name { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .teacher { color: #999; font-size: 14px; margin-bottom: 24px; }
    .amount { font-size: 36px; font-weight: 700; color: #FF6B35; margin-bottom: 32px; }
    .amount span { font-size: 18px; color: #999; }
    .pay-btn {
      background: #FF6B35; color: #fff; border: none; padding: 16px 48px;
      font-size: 18px; font-weight: 700; border-radius: 12px; cursor: pointer;
      width: 100%; transition: opacity 0.2s;
    }
    .pay-btn:hover { opacity: 0.9; }
    .pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status { margin-top: 24px; font-size: 14px; color: #999; }
    .success { color: #4CAF50; font-size: 18px; font-weight: 600; }
    .failed { color: #F44336; font-size: 18px; font-weight: 600; }
    .spinner { width: 40px; height: 40px; border: 4px solid #333; border-top: 4px solid #FF6B35;
      border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .secure { display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 16px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Mobi</div>
    <div class="course-name">${courseName || 'Course'}</div>
    <div class="teacher">by ${teacherName || 'Teacher'}</div>
    <div class="amount">&#8377;${((parseInt(amount as string) || 0) / 100).toLocaleString('en-IN')} <span>INR</span></div>
    <button class="pay-btn" id="payBtn" onclick="startPayment()">Pay Now</button>
    <div class="status" id="status"></div>
    <div class="secure">&#128274; Secured by Razorpay</div>
  </div>
  <script>
    var paymentDone = false;
    function startPayment() {
      document.getElementById('payBtn').disabled = true;
      document.getElementById('status').innerHTML = '<div class="spinner"></div>Opening payment...';
      var options = {
        key: '${keyId}',
        amount: '${amount}',
        currency: 'INR',
        name: 'Mobi',
        description: '${((courseName as string) || '').replace(/'/g, "\\'")}',
        order_id: '${orderId}',
        prefill: {
          name: '${(studentName as string || '').replace(/'/g, "\\'")}',
          contact: '${studentPhone || ''}',
          email: '${studentEmail || ''}',
        },
        theme: { color: '#FF6B35' },
        handler: function(response) {
          paymentDone = true;
          document.getElementById('status').innerHTML = '<div class="spinner"></div>Verifying payment...';
          document.getElementById('payBtn').style.display = 'none';
          fetch('${baseUrl}/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              courseId: '${courseId}',
              studentId: '${studentId}',
              studentName: '${(studentName as string || '').replace(/'/g, "\\'")}',
              studentPhone: '${studentPhone || ''}',
            }),
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.success) {
              document.getElementById('status').innerHTML = '<div class="success">Payment Successful!</div><p style="color:#999;margin-top:8px">Enrollment confirmed. Go back to the app.</p>';
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_success', enrollment: data.enrollment }));
              }
            } else {
              document.getElementById('status').innerHTML = '<div class="failed">Verification Failed</div><p style="color:#999;margin-top:8px">' + (data.message || 'Please contact support') + '</p>';
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_failed', message: data.message }));
              }
            }
          })
          .catch(function(err) {
            document.getElementById('status').innerHTML = '<div class="failed">Error</div><p style="color:#999;margin-top:8px">Network error. Please try again.</p>';
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_error', message: err.message }));
            }
          });
        },
        modal: {
          ondismiss: function() {
            if (!paymentDone) {
              document.getElementById('payBtn').disabled = false;
              document.getElementById('status').innerHTML = '<p style="color:#F9A825">Payment cancelled</p>';
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_cancelled' }));
              }
            }
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(response) {
        document.getElementById('payBtn').disabled = false;
        document.getElementById('status').innerHTML = '<div class="failed">Payment Failed</div><p style="color:#999;margin-top:8px">' + (response.error.description || 'Please try again') + '</p>';
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_failed', message: response.error.description }));
        }
      });
      rzp.open();
    }
    setTimeout(startPayment, 500);
  </script>
</body>
</html>`;
    res.type('html').send(html);
  });

  app.get("/api/payments", async (req, res) => {
    try {
      const { studentId, teacherId, courseId } = req.query;
      let result;
      if (studentId) {
        result = await db.select().from(payments).where(eq(payments.studentId, studentId as string)).orderBy(desc(payments.createdAt));
      } else if (teacherId) {
        result = await db.select().from(payments).where(eq(payments.teacherId, teacherId as string)).orderBy(desc(payments.createdAt));
      } else if (courseId) {
        result = await db.select().from(payments).where(eq(payments.courseId, courseId as string)).orderBy(desc(payments.createdAt));
      } else {
        result = await db.select().from(payments).orderBy(desc(payments.createdAt));
      }
      return res.json(result);
    } catch (error) {
      console.error("[Payments] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get payments" });
    }
  });

  // ==================== TEACHER REVENUE & PAYOUTS ====================
  app.get("/api/teacher/revenue/:teacherId", async (req, res) => {
    try {
      const { teacherId } = req.params;
      const allPayments = await db.select().from(payments)
        .where(and(eq(payments.teacherId, teacherId), eq(payments.status, 'paid')))
        .orderBy(desc(payments.createdAt));

      const allEnrollments = await db.select().from(courseEnrollments)
        .where(eq(courseEnrollments.teacherId, teacherId));

      const allCourses = await db.select().from(courses)
        .where(eq(courses.teacherId, teacherId));

      const allPayoutsData = await db.select().from(teacherPayouts)
        .where(eq(teacherPayouts.teacherId, teacherId))
        .orderBy(desc(teacherPayouts.requestedAt));

      const commissionSettings = await db.select().from(subscriptionSettings)
        .where(eq(subscriptionSettings.role, 'teacher'));
      const currentCommissionPct = parseFloat(commissionSettings[0]?.commissionPercent || '30');

      const totalRevenuePaise = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const totalCommissionPaise = allPayments.reduce((s, p) => s + (p.adminCommission || 0), 0);
      const totalEarningsPaise = allPayments.reduce((s, p) => s + (p.teacherEarning || 0), 0);

      const paidPayouts = allPayoutsData.filter(p => p.status === 'paid');
      const paidOutPaise = paidPayouts.reduce((s, p) => s + (p.amount || 0), 0);
      const availableForWithdrawal = Math.max(0, totalEarningsPaise - paidOutPaise);

      const recentSales = allPayments.slice(0, 20).map(p => ({
        id: p.id,
        courseId: p.courseId,
        studentName: p.studentName,
        amount: p.amount,
        teacherEarning: p.teacherEarning,
        adminCommission: p.adminCommission,
        commissionPercent: p.commissionPercent,
        createdAt: p.createdAt,
      }));

      return res.json({
        success: true,
        totalRevenue: totalRevenuePaise / 100,
        totalCommission: totalCommissionPaise / 100,
        totalEarnings: totalEarningsPaise / 100,
        availableForWithdrawal: availableForWithdrawal / 100,
        paidOut: paidOutPaise,
        totalSales: allPayments.length,
        totalEnrollments: allEnrollments.length,
        totalCourses: allCourses.length,
        currentCommissionPct,
        payouts: allPayoutsData,
        recentSales,
      });
    } catch (error) {
      console.error("[Teacher Revenue] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch revenue" });
    }
  });

  app.post("/api/teacher/payout/request", async (req, res) => {
    try {
      const { teacherId, teacherName, amount, upiId, bankAccount, notes } = req.body;
      if (!teacherId || !amount || amount <= 0) {
        return res.status(400).json({ success: false, message: "teacherId and valid amount required" });
      }
      const payoutId = randomUUID();
      await db.insert(teacherPayouts).values({
        id: payoutId,
        teacherId,
        teacherName: teacherName || 'Unknown',
        amount: Math.round(amount * 100),
        status: 'pending',
        upiId: upiId || '',
        bankAccount: bankAccount || '',
        notes: notes || '',
        requestedAt: Date.now(),
      });
      const [payout] = await db.select().from(teacherPayouts).where(eq(teacherPayouts.id, payoutId));
      return res.json({ success: true, payout });
    } catch (error) {
      console.error("[Payout] Request error:", error);
      return res.status(500).json({ success: false, message: "Failed to request payout" });
    }
  });

  app.get("/api/admin/teacher-payouts", async (_req, res) => {
    try {
      const allPayouts = await db.select().from(teacherPayouts).orderBy(desc(teacherPayouts.requestedAt));
      return res.json(allPayouts);
    } catch (error) {
      console.error("[Admin Payouts] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch payouts" });
    }
  });

  app.patch("/api/admin/teacher-payouts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const updateData: any = {};
      if (status) updateData.status = status;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (status === 'paid') updateData.paidAt = Date.now();
      await db.update(teacherPayouts).set(updateData).where(eq(teacherPayouts.id, id));
      const [updated] = await db.select().from(teacherPayouts).where(eq(teacherPayouts.id, id));
      return res.json({ success: true, payout: updated });
    } catch (error) {
      console.error("[Admin Payouts] Update error:", error);
      return res.status(500).json({ success: false, message: "Failed to update payout" });
    }
  });

  // ==================== SECURE VIDEO URL (Enrolled users only) ====================
  app.get("/api/course/secure-url/:videoId", async (req, res) => {
    try {
      const { videoId } = req.params;
      const { studentId } = req.query;

      const [video] = await db.select().from(courseVideos).where(eq(courseVideos.id, videoId));
      if (!video) return res.status(404).json({ success: false, message: "Video not found" });

      if (video.isDemo === 1) {
        return res.json({ success: true, url: video.videoUrl, isDemo: true });
      }

      if (!studentId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      const now = Date.now();
      const [enrollment] = await db.select().from(courseEnrollments)
        .where(and(
          eq(courseEnrollments.courseId, video.courseId),
          eq(courseEnrollments.studentId, studentId as string),
          eq(courseEnrollments.status, 'active'),
          gt(courseEnrollments.expiresAt, now)
        ));

      if (!enrollment) {
        return res.status(403).json({ success: false, message: "Not enrolled or enrollment expired" });
      }

      // Generate Bunny.net signed URL if token key is available
      const BUNNY_TOKEN_KEY = process.env.BUNNY_TOKEN_KEY;
      let secureUrl = video.videoUrl;

      if (BUNNY_TOKEN_KEY && video.videoUrl.includes('b-cdn.net')) {
        const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const urlPath = new URL(video.videoUrl).pathname;
        const tokenRaw = `${BUNNY_TOKEN_KEY}${urlPath}${expiresAt}`;
        const token = crypto.createHash('sha256').update(tokenRaw).digest('base64url');
        secureUrl = `${video.videoUrl}?token=${token}&expires=${expiresAt}`;
      }

      return res.json({
        success: true,
        url: secureUrl,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
    } catch (error) {
      console.error("[SecureURL] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to get secure URL" });
    }
  });

  // ==================== CHAT CONTACT PERMISSION ====================
  app.get("/api/chat/can-contact/:teacherId", async (req, res) => {
    try {
      const { teacherId } = req.params;
      const { studentId } = req.query;
      if (!studentId) {
        return res.status(400).json({ success: false, message: "studentId query param is required" });
      }

      const now = Date.now();
      const activeEnrollments = await db.select().from(courseEnrollments)
        .where(and(
          eq(courseEnrollments.studentId, studentId as string),
          eq(courseEnrollments.teacherId, teacherId),
          gt(courseEnrollments.expiresAt, now)
        ));

      if (activeEnrollments.length > 0) {
        return res.json({ canContact: true, reason: "Active enrollment found" });
      }
      return res.json({ canContact: false, reason: "No active enrollment with this teacher" });
    } catch (error) {
      console.error("[Chat] Can contact check error:", error);
      return res.status(500).json({ success: false, message: "Failed to check contact permission" });
    }
  });

  app.post("/api/dubbing/start", async (req, res) => {
    try {
      const { videoId, courseId, targetLanguage, sourceLang } = req.body;
      if (!videoId || !courseId || !targetLanguage) {
        return res.status(400).json({ success: false, message: "videoId, courseId, and targetLanguage are required" });
      }

      const existingDubbed = await db.select().from(dubbedVideos)
        .where(and(
          eq(dubbedVideos.videoId, videoId),
          eq(dubbedVideos.language, targetLanguage)
        ));

      if (existingDubbed.length > 0) {
        const existing = existingDubbed[0];
        if (existing.status === "completed") {
          return res.json({ success: true, status: "completed", dubbedVideoUrl: existing.dubbedVideoUrl });
        }
        if (existing.status === "processing") {
          return res.json({ success: true, status: "processing", message: "Dubbing already in progress" });
        }
        await db.delete(dubbedVideos).where(eq(dubbedVideos.id, existing.id));
      }

      // Resolve source language: use request body → course language → fallback 'hi'
      let resolvedSourceLang = sourceLang;
      if (!resolvedSourceLang) {
        const [courseRow] = await db.select().from(courses).where(eq(courses.id, courseId));
        resolvedSourceLang = courseRow?.language || 'hi';
      }

      const { dubVideo } = await import("./dubbing");
      res.json({ success: true, status: "processing", message: "Dubbing started" });

      dubVideo(videoId, courseId, targetLanguage, resolvedSourceLang).then(result => {
        console.log(`[Dubbing] Completed for video ${videoId} to ${targetLanguage}:`, result.success ? "success" : result.error);
      });
    } catch (error) {
      console.error("[Dubbing] Start error:", error);
      return res.status(500).json({ success: false, message: "Failed to start dubbing" });
    }
  });

  app.get("/api/dubbing/status/:videoId", async (req, res) => {
    try {
      const { videoId } = req.params;
      const { language } = req.query;

      let query = db.select().from(dubbedVideos).where(eq(dubbedVideos.videoId, videoId));
      const results = await query;

      if (language) {
        const filtered = results.filter(r => r.language === language);
        if (filtered.length === 0) {
          return res.json({ available: false, status: null });
        }
        return res.json({
          available: filtered[0].status === "completed",
          status: filtered[0].status,
          dubbedVideoUrl: filtered[0].dubbedVideoUrl,
        });
      }

      const langMap: Record<string, { status: string; url: string }> = {};
      for (const d of results) {
        langMap[d.language] = { status: d.status, url: d.dubbedVideoUrl };
      }
      return res.json({ languages: langMap });
    } catch (error) {
      console.error("[Dubbing] Status error:", error);
      return res.status(500).json({ success: false, message: "Failed to get dubbing status" });
    }
  });

  app.get("/api/dubbing/languages", (_req, res) => {
    const languages = [
      { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
      { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
      { code: "te", name: "Telugu", nativeName: "తెలుగు" },
      { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
      { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
      { code: "bn", name: "Bengali", nativeName: "বাংলা" },
      { code: "mr", name: "Marathi", nativeName: "मराठी" },
      { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
      { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
      { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
      { code: "ur", name: "Urdu", nativeName: "اردو" },
      { code: "en", name: "English", nativeName: "English" },
    ];
    res.json({ languages });
  });

  // ========== Live Classes routes ==========
  app.get("/api/courses/:courseId/live-classes", async (req, res) => {
    try {
      const { courseId } = req.params;
      const classes = await db.select().from(liveClasses)
        .where(eq(liveClasses.courseId, courseId))
        .orderBy(desc(liveClasses.scheduledAt));
      return res.json(classes);
    } catch (error) {
      console.error("[LiveClasses] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get live classes" });
    }
  });

  app.post("/api/courses/:courseId/live-classes", async (req, res) => {
    try {
      const { courseId } = req.params;
      const { teacherId, teacherName, title, description, scheduledAt, duration } = req.body;
      const [lc] = await db.insert(liveClasses).values({
        id: randomUUID(),
        courseId,
        teacherId,
        teacherName,
        title,
        description: description || "",
        scheduledAt,
        duration: duration || 60,
        status: "scheduled",
        createdAt: Date.now(),
      }).returning();
      return res.json({ success: true, liveClass: lc });
    } catch (error) {
      console.error("[LiveClasses] Create error:", error);
      return res.status(500).json({ success: false, message: "Failed to create live class" });
    }
  });

  app.patch("/api/live-classes/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, meetingUrl } = req.body;
      const updates: any = { status };
      if (meetingUrl) updates.meetingUrl = meetingUrl;
      const [updated] = await db.update(liveClasses).set(updates).where(eq(liveClasses.id, id)).returning();
      return res.json({ success: true, liveClass: updated });
    } catch (error) {
      console.error("[LiveClasses] Update error:", error);
      return res.status(500).json({ success: false, message: "Failed to update live class" });
    }
  });

  app.delete("/api/live-classes/:id", async (req, res) => {
    try {
      await db.delete(liveClasses).where(eq(liveClasses.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("[LiveClasses] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete live class" });
    }
  });

  // ========== Live Polls & Quizzes routes ==========
  app.get("/api/live-classes/:classId/polls", async (req, res) => {
    try {
      const { classId } = req.params;
      const { userId } = req.query;
      const polls = await db.select().from(livePolls)
        .where(eq(livePolls.classId, classId))
        .orderBy(desc(livePolls.createdAt));

      const pollIds = polls.map(p => p.id);
      let votesByPoll: Record<string, number[]> = {};
      let userVotes: Record<string, number> = {};

      if (pollIds.length > 0) {
        for (const pollId of pollIds) {
          const votes = await db.select().from(livePollVotes).where(eq(livePollVotes.pollId, pollId));
          const options = JSON.parse(polls.find(p => p.id === pollId)?.options || '[]');
          const counts = new Array(options.length).fill(0);
          for (const v of votes) {
            if (v.optionIndex >= 0 && v.optionIndex < counts.length) counts[v.optionIndex]++;
          }
          votesByPoll[pollId] = counts;
          if (userId) {
            const myVote = votes.find(v => v.userId === userId);
            if (myVote) userVotes[pollId] = myVote.optionIndex;
          }
        }
      }

      const result = polls.map(p => ({
        ...p,
        options: JSON.parse(p.options),
        voteCounts: votesByPoll[p.id] || [],
        myVote: userVotes[p.id] ?? null,
      }));

      return res.json(result);
    } catch (error) {
      console.error("[Polls] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get polls" });
    }
  });

  app.post("/api/live-classes/:classId/polls", async (req, res) => {
    try {
      const { classId } = req.params;
      const { courseId, teacherId, type, question, options, correctOption, timerSeconds } = req.body;
      if (!courseId || !teacherId || !question || !options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ success: false, message: "Question and at least 2 options are required" });
      }
      const [poll] = await db.insert(livePolls).values({
        id: randomUUID(),
        classId,
        courseId,
        teacherId,
        type: type || 'poll',
        question,
        options: JSON.stringify(options),
        correctOption: type === 'quiz' ? (correctOption ?? 0) : -1,
        status: 'active',
        timerSeconds: Number(timerSeconds) || 0,
        createdAt: Date.now(),
      }).returning();
      const result = { ...poll, options, voteCounts: new Array(options.length).fill(0), myVote: null };
      return res.json({ success: true, poll: result });
    } catch (error) {
      console.error("[Polls] Create error:", error);
      return res.status(500).json({ success: false, message: "Failed to create poll" });
    }
  });

  app.post("/api/polls/:pollId/vote", async (req, res) => {
    try {
      const { pollId } = req.params;
      const { userId, optionIndex } = req.body;
      if (!userId || optionIndex === undefined) {
        return res.status(400).json({ success: false, message: "userId and optionIndex required" });
      }
      const [poll] = await db.select().from(livePolls).where(eq(livePolls.id, pollId));
      if (!poll) return res.status(404).json({ success: false, message: "Poll not found" });
      if (poll.status !== 'active') return res.status(400).json({ success: false, message: "Poll is closed" });

      const existing = await db.select().from(livePollVotes)
        .where(and(eq(livePollVotes.pollId, pollId), eq(livePollVotes.userId, userId)));
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: "Already voted" });
      }
      await db.insert(livePollVotes).values({
        id: randomUUID(),
        pollId,
        userId,
        optionIndex: Number(optionIndex),
        createdAt: Date.now(),
      });

      const allVotes = await db.select().from(livePollVotes).where(eq(livePollVotes.pollId, pollId));
      const options = JSON.parse(poll.options);
      const counts = new Array(options.length).fill(0);
      for (const v of allVotes) {
        if (v.optionIndex >= 0 && v.optionIndex < counts.length) counts[v.optionIndex]++;
      }
      return res.json({ success: true, voteCounts: counts });
    } catch (error) {
      console.error("[Polls] Vote error:", error);
      return res.status(500).json({ success: false, message: "Failed to vote" });
    }
  });

  app.patch("/api/polls/:pollId/close", async (req, res) => {
    try {
      const { pollId } = req.params;
      const { teacherId } = req.body;
      const [poll] = await db.select().from(livePolls).where(eq(livePolls.id, pollId));
      if (!poll) return res.status(404).json({ success: false, message: "Poll not found" });
      if (poll.teacherId !== teacherId) return res.status(403).json({ success: false, message: "Not authorized" });
      await db.update(livePolls).set({ status: 'closed' }).where(eq(livePolls.id, pollId));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Polls] Close error:", error);
      return res.status(500).json({ success: false, message: "Failed to close poll" });
    }
  });

  app.delete("/api/polls/:pollId", async (req, res) => {
    try {
      const { pollId } = req.params;
      const { teacherId } = req.body;
      const [poll] = await db.select().from(livePolls).where(eq(livePolls.id, pollId));
      if (!poll) return res.status(404).json({ success: false, message: "Poll not found" });
      if (poll.teacherId !== teacherId) return res.status(403).json({ success: false, message: "Not authorized" });
      await db.delete(livePollVotes).where(eq(livePollVotes.pollId, pollId));
      await db.delete(livePolls).where(eq(livePolls.id, pollId));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Polls] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete poll" });
    }
  });

  // ========== Course Students routes ==========
  app.get("/api/courses/:courseId/students", async (req, res) => {
    try {
      const { courseId } = req.params;
      const enrollments = await db.select().from(courseEnrollments)
        .where(eq(courseEnrollments.courseId, courseId))
        .orderBy(desc(courseEnrollments.createdAt));
      return res.json(enrollments);
    } catch (error) {
      console.error("[Students] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get students" });
    }
  });

  // ========== Course Notices routes ==========
  app.get("/api/courses/:courseId/notices", async (req, res) => {
    try {
      const { courseId } = req.params;
      const notices = await db.select().from(courseNotices)
        .where(eq(courseNotices.courseId, courseId))
        .orderBy(desc(courseNotices.createdAt));
      return res.json(notices);
    } catch (error) {
      console.error("[Notices] List error:", error);
      return res.status(500).json({ success: false, message: "Failed to get notices" });
    }
  });

  app.post("/api/courses/:courseId/notices", async (req, res) => {
    try {
      const { courseId } = req.params;
      const { teacherId, teacherName, title, message } = req.body;
      const [notice] = await db.insert(courseNotices).values({
        id: randomUUID(),
        courseId,
        teacherId,
        teacherName,
        title,
        message: message || "",
        createdAt: Date.now(),
      }).returning();
      return res.json({ success: true, notice });
    } catch (error) {
      console.error("[Notices] Create error:", error);
      return res.status(500).json({ success: false, message: "Failed to create notice" });
    }
  });

  app.delete("/api/notices/:id", async (req, res) => {
    try {
      await db.delete(courseNotices).where(eq(courseNotices.id, req.params.id));
      return res.json({ success: true });
    } catch (error) {
      console.error("[Notices] Delete error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete notice" });
    }
  });

  app.get("/api/ads", async (_req, res) => {
    try {
      const allAds = await db.select().from(ads).orderBy(ads.sortOrder);
      res.json(allAds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ads" });
    }
  });

  app.get("/api/ads/active", async (_req, res) => {
    try {
      const activeAds = await db.select().from(ads).where(eq(ads.isActive, 1)).orderBy(ads.sortOrder);
      res.json(activeAds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active ads" });
    }
  });

  app.post("/api/ads", upload.single("image"), async (req, res) => {
    try {
      const { title, description, videoUrl, linkUrl, sortOrder } = req.body;
      let imageUrl = req.body.imageUrl || "";
      if (req.file) {
        const ext = path.extname(req.file.originalname);
        const filename = `images/ad-${randomUUID()}${ext}`;
        imageUrl = await uploadToStorage(req.file.buffer, filename);
      }
      const [ad] = await db.insert(ads).values({
        id: randomUUID(),
        title: title || "",
        description: description || "",
        imageUrl,
        videoUrl: videoUrl || "",
        linkUrl: linkUrl || "",
        sortOrder: parseInt(sortOrder) || 0,
        createdAt: Date.now(),
      }).returning();
      res.json(ad);
    } catch (error) {
      console.error("Error creating ad:", error);
      res.status(500).json({ error: "Failed to create ad" });
    }
  });

  app.patch("/api/ads/:id", upload.single("image"), async (req, res) => {
    try {
      const { id } = req.params;
      const updates: any = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.videoUrl !== undefined) updates.videoUrl = req.body.videoUrl;
      if (req.body.linkUrl !== undefined) updates.linkUrl = req.body.linkUrl;
      if (req.body.isActive !== undefined) updates.isActive = parseInt(req.body.isActive);
      if (req.body.sortOrder !== undefined) updates.sortOrder = parseInt(req.body.sortOrder);
      if (req.file) {
        const ext = path.extname(req.file.originalname);
        const filename = `images/ad-${randomUUID()}${ext}`;
        updates.imageUrl = await uploadToStorage(req.file.buffer, filename);
      } else if (req.body.imageUrl !== undefined) {
        updates.imageUrl = req.body.imageUrl;
      }
      const [updated] = await db.update(ads).set(updates).where(eq(ads.id, id as string)).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update ad" });
    }
  });

  app.delete("/api/ads/:id", async (req, res) => {
    try {
      await db.delete(ads).where(eq(ads.id, req.params.id as string));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete ad" });
    }
  });


  app.get('/api/app-settings', async (_req, res) => {
    try {
      const settings = await db.select().from(appSettings);
      const result: Record<string, string> = {};
      settings.forEach(s => { result[s.key] = s.value; });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.get('/api/app-settings/:key', async (req, res) => {
    try {
      const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, req.params.key));
      res.json({ value: setting?.value || '' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch setting' });
    }
  });

  app.put('/api/app-settings/:key', async (req, res) => {
    try {
      const { value } = req.body;
      const key = req.params.key;
      const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));
      if (existing) {
        await db.update(appSettings).set({ value: value || '', updatedAt: Date.now() }).where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({ key, value: value || '', updatedAt: Date.now() });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update setting' });
    }
  });

  // Alias routes used by user-profile screen
  app.get('/api/settings/:key', async (req, res) => {
    try {
      const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, req.params.key));
      res.json({ value: setting?.value || '' });
    } catch {
      res.status(500).json({ error: 'Failed to fetch setting' });
    }
  });

  app.post('/api/settings', async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: 'key required' });
      const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));
      if (existing) {
        await db.update(appSettings).set({ value: value || '', updatedAt: Date.now() }).where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({ key, value: value || '', updatedAt: Date.now() });
      }
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to update setting' });
    }
  });

  // ========== Device Change Payment ==========
  app.post("/api/device-change/create-order", async (req, res) => {
    try {
      const { phone, deviceId } = req.body;
      if (!phone || !deviceId) {
        return res.status(400).json({ success: false, message: "Phone and deviceId required" });
      }
      const cleanPhone = phone.replace(/\D/g, "");
      
      const priceSettings = await db.select().from(appSettings).where(eq(appSettings.key, "device_lock_price"));
      const price = priceSettings.length > 0 ? parseInt(priceSettings[0].value) || 100 : 100;

      const Razorpay = (await import("razorpay")).default;
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || "",
        key_secret: process.env.RAZORPAY_KEY_SECRET || "",
      });

      const order = await razorpay.orders.create({
        amount: price * 100,
        currency: "INR",
        receipt: `device_change_${cleanPhone}_${Date.now()}`,
        notes: { phone: cleanPhone, deviceId, type: "device_change" },
      });

      return res.json({ success: true, orderId: order.id, amount: price, currency: "INR" });
    } catch (error) {
      console.error("[DeviceChange] Create order error:", error);
      return res.status(500).json({ success: false, message: "Failed to create payment order" });
    }
  });

  app.post("/api/device-change/verify-payment", async (req, res) => {
    try {
      const { phone, deviceId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      if (!phone || !deviceId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ success: false, message: "Missing payment details" });
      }
      
      const crypto = await import("crypto");
      const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");
      
      if (expectedSignature !== razorpaySignature) {
        return res.status(400).json({ success: false, message: "Payment verification failed" });
      }

      const cleanPhone = phone.replace(/\D/g, "");
      const allProfilesList = await db.select().from(profiles);
      const existingProfile = allProfilesList.find(p => p.phone.replace(/\D/g, "") === cleanPhone);
      
      if (!existingProfile) {
        return res.status(404).json({ success: false, message: "Profile not found" });
      }

      await db.update(profiles).set({
        deviceId: deviceId,
        deviceChangeCount: (existingProfile.deviceChangeCount || 0) + 1,
      }).where(eq(profiles.id, existingProfile.id));

      const sessionToken = randomUUID();
      await db.delete(sessions).where(eq(sessions.phone, cleanPhone));
      await db.insert(sessions).values({ phone: cleanPhone, sessionToken });

      return res.json({
        success: true,
        message: "Device changed successfully",
        sessionToken,
        profile: { ...existingProfile, deviceId, skills: JSON.parse(existingProfile.skills) },
      });
    } catch (error) {
      console.error("[DeviceChange] Verify payment error:", error);
      return res.status(500).json({ success: false, message: "Payment verification failed" });
    }
  });

  app.post("/api/admin/reset-device", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: "userId required" });
      
      await db.update(profiles).set({ deviceId: "", deviceChangeCount: 0 }).where(eq(profiles.id, userId));
      return res.json({ success: true, message: "Device reset successfully" });
    } catch (error) {
      console.error("[Admin] Reset device error:", error);
      return res.status(500).json({ success: false, message: "Failed to reset device" });
    }
  });

  app.get("/api/admin/export-users", async (_req, res) => {
    try {
      const allProfiles = await db.select().from(profiles).orderBy(profiles.createdAt);
      const rows = [[
        'Name', 
        'Phone', 
        'Role', 
        'City', 
        'State',
        'Shop Name',
        'Shop Address',
        'Experience',
        'GST Number',
        'Aadhaar',
        'PAN',
        'Registered', 
        'Blocked', 
        'Subscription Active',
        'Subscription End',
        'Device ID',
        'Joined Date',
        'Joined Time'
      ]];
      
      allProfiles.forEach(u => {
        const createdAt = u.createdAt ? new Date(u.createdAt) : null;
        const subEnd = u.subscriptionEnd ? new Date(u.subscriptionEnd) : null;
        
        rows.push([
          u.name || '',
          u.phone || '',
          u.role || '',
          u.city || '',
          u.state || '',
          u.shopName || '',
          u.shopAddress || '',
          u.experience || '',
          u.gstNumber || '',
          u.aadhaarNumber || '',
          u.panNumber || '',
          u.subscriptionActive ? 'Yes' : 'No',
          u.blocked ? 'Yes' : 'No',
          u.subscriptionActive ? 'Active' : 'Inactive',
          subEnd ? subEnd.toISOString().slice(0, 10) : 'N/A',
          u.deviceId || '',
          createdAt ? createdAt.toISOString().slice(0, 10) : '',
          createdAt ? createdAt.toLocaleTimeString('en-IN', { hour12: false }) : '',
        ]);
      });
      const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const filename = `mobi-users-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (error) {
      console.error("[Admin] Export users error:", error);
      return res.status(500).json({ success: false, message: "Export failed" });
    }
  });

  app.post("/api/admin/block-user", async (req, res) => {
    try {
      const { userId, blocked } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: "userId required" });
      await db.update(profiles).set({ blocked: blocked ? 1 : 0 }).where(eq(profiles.id, userId));
      return res.json({ success: true, message: blocked ? "User blocked" : "User unblocked" });
    } catch (error) {
      console.error("[Admin] Block user error:", error);
      return res.status(500).json({ success: false, message: "Failed to update user" });
    }
  });

  app.post("/api/admin/delete-user", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: "userId required" });

      const userCourses = await db.select().from(courses).where(eq(courses.teacherId, userId));
      for (const course of userCourses) {
        const cChapters = await db.select().from(courseChapters).where(eq(courseChapters.courseId, course.id));
        for (const ch of cChapters) {
          await db.delete(courseVideos).where(eq(courseVideos.chapterId, ch.id));
        }
        await db.delete(dubbedVideos).where(eq(dubbedVideos.courseId, course.id));
        await db.delete(courseChapters).where(eq(courseChapters.courseId, course.id));
        await db.delete(courseEnrollments).where(eq(courseEnrollments.courseId, course.id));
        await db.delete(courseNotices).where(eq(courseNotices.courseId, course.id));
      }
      await db.delete(courses).where(eq(courses.teacherId, userId));

      await db.delete(products).where(eq(products.userId, userId));
      await db.delete(orders).where(eq(orders.buyerId, userId));
      await db.delete(payments).where(eq(payments.studentId, userId));
      await db.delete(payments).where(eq(payments.teacherId, userId));
      await db.delete(courseEnrollments).where(eq(courseEnrollments.studentId, userId));
      await db.delete(courseEnrollments).where(eq(courseEnrollments.teacherId, userId));
      await db.delete(liveChatMessages).where(eq(liveChatMessages.senderId, userId));

      await db.delete(messages).where(eq(messages.senderId, userId));
      await db.delete(posts).where(eq(posts.userId, userId));
      await db.delete(jobs).where(eq(jobs.userId, userId));
      await db.delete(reels).where(eq(reels.userId, userId));

      const userConvos = await db.select().from(conversations).where(
        sql`${conversations.participant1Id} = ${userId} OR ${conversations.participant2Id} = ${userId}`
      );
      for (const convo of userConvos) {
        await db.delete(messages).where(eq(messages.conversationId, convo.id));
        await db.delete(conversations).where(eq(conversations.id, convo.id));
      }

      const [userProfile] = await db.select().from(profiles).where(eq(profiles.id, userId));
      if (userProfile?.phone) {
        await db.delete(sessions).where(eq(sessions.phone, userProfile.phone));
      }
      await db.delete(profiles).where(eq(profiles.id, userId));

      return res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("[Admin] Delete user error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete user" });
    }
  });

  app.get("/api/device-change/checkout", (req, res) => {
    const { orderId, amount, phone, deviceId } = req.query;
    
    const baseUrl = process.env.APP_DOMAIN || "https://repair-backend-us-456751858632.us-central1.run.app";
    const keyId = process.env.RAZORPAY_KEY_ID || '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Device Change Payment - Mobi</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0D0D0D; color: #fff; min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 20px;
    }
    .container { text-align: center; max-width: 400px; width: 100%; }
    .logo { font-size: 28px; font-weight: 800; color: #FF6B35; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #999; font-size: 14px; margin-bottom: 24px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .amount { font-size: 36px; font-weight: 700; color: #FF6B35; margin-bottom: 32px; }
    .amount span { font-size: 18px; color: #999; }
    .pay-btn {
      background: #FF6B35; color: #fff; border: none; padding: 16px 48px;
      font-size: 18px; font-weight: 700; border-radius: 12px; cursor: pointer;
      width: 100%; transition: opacity 0.2s;
    }
    .pay-btn:hover { opacity: 0.9; }
    .pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status { margin-top: 24px; font-size: 14px; color: #999; }
    .success { color: #4CAF50; font-size: 18px; font-weight: 600; }
    .failed { color: #F44336; font-size: 18px; font-weight: 600; }
    .spinner { width: 40px; height: 40px; border: 4px solid #333; border-top: 4px solid #FF6B35;
      border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .secure { display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 16px; color: #666; font-size: 12px; }
    .info { background: #1A1A1A; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; }
    .info-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .info-label { color: #999; font-size: 13px; }
    .info-value { color: #fff; font-size: 13px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Mobi</div>
    <div class="icon">&#128274;</div>
    <div class="title">Device Change</div>
    <div class="subtitle">One-time payment to login from a new device</div>
    <div class="info">
      <div class="info-row"><span class="info-label">Phone</span><span class="info-value">+91 ${phone || ''}</span></div>
      <div class="info-row"><span class="info-label">Purpose</span><span class="info-value">Device Change Fee</span></div>
    </div>
    <div class="amount">&#8377;${((parseInt(amount as string) || 0) / 100).toLocaleString('en-IN')} <span>INR</span></div>
    <button class="pay-btn" id="payBtn" onclick="startPayment()">Pay Now</button>
    <div class="status" id="status"></div>
    <div class="secure">&#128274; Secured by Razorpay</div>
  </div>
  <script>
    var paymentDone = false;
    function startPayment() {
      document.getElementById('payBtn').disabled = true;
      document.getElementById('status').innerHTML = '<div class="spinner"></div>Opening payment...';
      var options = {
        key: '${keyId}',
        amount: '${amount}',
        currency: 'INR',
        name: 'Mobi',
        description: 'Device Change Fee',
        order_id: '${orderId}',
        prefill: { contact: '${phone || ''}' },
        theme: { color: '#FF6B35' },
        handler: function(response) {
          paymentDone = true;
          document.getElementById('status').innerHTML = '<div class="spinner"></div>Verifying payment...';
          document.getElementById('payBtn').style.display = 'none';
          fetch('${baseUrl}/api/device-change/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: '${phone}',
              deviceId: '${deviceId}',
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.success) {
              document.getElementById('status').innerHTML = '<p class="success">&#10003; Device changed successfully!</p><p style="color:#999;margin-top:8px">You can now login from this device. Please go back and login again.</p>';
              try {
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage(JSON.stringify({ type: 'device_payment_success', sessionToken: data.sessionToken, profile: data.profile }), '*');
                }
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'device_payment_success', sessionToken: data.sessionToken, profile: data.profile }));
                }
              } catch(e) {}
            } else {
              document.getElementById('status').innerHTML = '<p class="failed">&#10007; ' + (data.message || 'Payment verification failed') + '</p>';
              document.getElementById('payBtn').style.display = 'block';
              document.getElementById('payBtn').disabled = false;
            }
          })
          .catch(function() {
            document.getElementById('status').innerHTML = '<p class="failed">&#10007; Network error. Please try again.</p>';
            document.getElementById('payBtn').style.display = 'block';
            document.getElementById('payBtn').disabled = false;
          });
        },
        modal: {
          ondismiss: function() {
            if (!paymentDone) {
              document.getElementById('payBtn').disabled = false;
              document.getElementById('status').innerHTML = '<p style="color:#999">Payment cancelled. Try again when ready.</p>';
              try {
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage(JSON.stringify({ type: 'device_payment_failed', message: 'Payment cancelled' }), '*');
                }
              } catch(e) {}
            }
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.open();
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // ========== Admin Revenue & Subscription Reports ==========
  app.get("/api/admin/revenue", async (_req, res) => {
    try {
      const allProfilesList = await db.select().from(profiles);
      const allPaymentsList = await db.select().from(payments);
      const allEnrollmentsList = await db.select().from(courseEnrollments);
      const allCoursesList = await db.select().from(courses);
      const allSubSettings = await db.select().from(subscriptionSettings);
      const now = Date.now();

      const activeSubscribers = allProfilesList.filter(p =>
        p.subscriptionActive === 1 && (p.subscriptionEnd || 0) > now
      );

      const capturedPayments = allPaymentsList.filter(p =>
        p.status === 'captured' || p.status === 'paid'
      );
      const totalCourseRevenue = capturedPayments.reduce((sum, p) => sum + (p.amount || 0), 0) / 100;

      const teacherRevenueMap: Record<string, { name: string; amount: number; enrollments: number; courseCount: number }> = {};
      capturedPayments.forEach(p => {
        if (!teacherRevenueMap[p.teacherId]) {
          teacherRevenueMap[p.teacherId] = { name: '', amount: 0, enrollments: 0, courseCount: 0 };
        }
        teacherRevenueMap[p.teacherId].amount += (p.amount || 0) / 100;
        teacherRevenueMap[p.teacherId].enrollments += 1;
      });
      allProfilesList.forEach(p => {
        if (teacherRevenueMap[p.id]) teacherRevenueMap[p.id].name = p.name;
      });
      allCoursesList.forEach(c => {
        if (teacherRevenueMap[c.teacherId]) teacherRevenueMap[c.teacherId].courseCount += 1;
      });

      const subRevByRole: Record<string, number> = { technician: 0, teacher: 0, supplier: 0 };
      activeSubscribers.forEach(p => {
        const setting = allSubSettings.find(s => s.role === p.role);
        if (setting && subRevByRole[p.role] !== undefined) {
          subRevByRole[p.role] += parseInt(setting.amount || '0');
        }
      });
      const totalSubRevenue = Object.values(subRevByRole).reduce((s, v) => s + v, 0);

      const commissionSettings = allSubSettings.find(s => s.role === 'teacher');
      const commissionPercent = parseFloat(commissionSettings?.commissionPercent || '30') / 100;
      const platformCourseRevenue = totalCourseRevenue * commissionPercent;

      res.json({
        success: true,
        activeSubscribers: activeSubscribers.length,
        activeSubscribersByRole: {
          technician: activeSubscribers.filter(p => p.role === 'technician').length,
          teacher: activeSubscribers.filter(p => p.role === 'teacher').length,
          supplier: activeSubscribers.filter(p => p.role === 'supplier').length,
        },
        subscriptionRevenue: totalSubRevenue,
        subscriptionRevenueByRole: subRevByRole,
        courseRevenue: totalCourseRevenue,
        platformCourseRevenue,
        totalRevenue: totalSubRevenue + platformCourseRevenue,
        totalEnrollments: allEnrollmentsList.filter(e => e.paymentStatus === 'paid').length,
        freeEnrollments: allEnrollmentsList.filter(e => e.paymentStatus === 'free').length,
        teacherRevenue: Object.entries(teacherRevenueMap)
          .map(([id, r]) => ({ teacherId: id, ...r }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 20),
        courseCount: allCoursesList.length,
        publishedCourses: allCoursesList.filter(c => c.isPublished === 1).length,
        totalPayments: capturedPayments.length,
        commissionPercent: commissionPercent * 100,
        totalAdminCommission: capturedPayments.reduce((s, p) => s + (p.adminCommission || 0), 0) / 100,
        totalTeacherEarnings: capturedPayments.reduce((s, p) => s + (p.teacherEarning || 0), 0) / 100,
      });
    } catch (error) {
      console.error("[Admin] Revenue error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch revenue" });
    }
  });

  app.get("/api/admin/active-subscriptions", async (_req, res) => {
    try {
      const allProfilesList = await db.select().from(profiles);
      const now = Date.now();
      const activeSubs = allProfilesList.filter(p =>
        p.subscriptionActive === 1 && (p.subscriptionEnd || 0) > now
      );
      res.json(activeSubs.map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        role: p.role,
        avatar: p.avatar,
        city: p.city,
        subscriptionEnd: p.subscriptionEnd,
      })));
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/admin/notify-all", async (req, res) => {
    try {
      const { phone, title, body } = req.body;
      if (phone !== '8179142535') return res.status(403).json({ success: false, message: "Admin only" });
      if (!title || !body) return res.status(400).json({ success: false, message: "Title and body required" });
      const count = await notifyAllUsers({ title, body, data: { type: 'admin_broadcast' } });
      res.json({ success: true, sent: count });
    } catch (error) {
      console.error("[Admin] Notify all error:", error);
      res.status(500).json({ success: false, message: "Failed to send notifications" });
    }
  });

  app.post("/api/admin/notify-role", async (req, res) => {
    try {
      const { phone, title, body, role } = req.body;
      if (phone !== '8179142535') return res.status(403).json({ success: false, message: "Admin only" });
      if (!title || !body) return res.status(400).json({ success: false, message: "Title and body required" });
      const validRoles = ['technician', 'teacher', 'supplier', 'job_provider', 'customer'];
      if (role && !validRoles.includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });

      let rows;
      if (!role || role === 'all') {
        rows = await db.select({ pushToken: profiles.pushToken }).from(profiles).where(ne(profiles.pushToken, ''));
      } else {
        rows = await db.select({ pushToken: profiles.pushToken }).from(profiles)
          .where(and(eq(profiles.role, role), ne(profiles.pushToken, '')));
      }
      const tokens = rows.map(r => r.pushToken || '').filter(t => t.startsWith('ExponentPushToken'));

      if (tokens.length === 0) {
        return res.json({ success: true, sent: 0, message: 'No registered devices for this role' });
      }

      const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
      const chunkSize = 100;
      let sent = 0;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, i + chunkSize);
        const messages = chunk.map(token => ({
          to: token, title, body, data: { type: 'admin_broadcast', role: role || 'all' },
          sound: 'default', badge: 1,
        }));
        try {
          await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages),
          });
          sent += chunk.length;
        } catch (e) {
          console.error('[Push] Chunk send error:', e);
        }
      }
      res.json({ success: true, sent });
    } catch (error) {
      console.error("[Admin] Notify role error:", error);
      res.status(500).json({ success: false, message: "Failed to send notifications" });
    }
  });

  app.post("/api/admin/send-sms", async (req, res) => {
    try {
      const { phone, message, role } = req.body;
      if (phone !== '8179142535') return res.status(403).json({ success: false, message: "Admin only" });
      if (!message?.trim()) return res.status(400).json({ success: false, message: "Message required" });

      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioSid || !twilioAuth || !twilioFrom) {
        return res.status(500).json({ success: false, message: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in secrets." });
      }

      let userRows;
      if (!role || role === 'all') {
        userRows = await db.select({ phone: profiles.phone }).from(profiles);
      } else {
        userRows = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.role, role));
      }

      const phones = userRows
        .map(r => r.phone?.trim())
        .filter(Boolean)
        .map(p => {
          const digits = p!.replace(/\D/g, '');
          if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
          if (digits.length === 10) return `+91${digits}`;
          return `+${digits}`;
        });

      if (phones.length === 0) {
        return res.json({ success: true, sent: 0, message: 'No phone numbers found for this role' });
      }

      const { default: twilio } = await import('twilio');
      const client = twilio(twilioSid, twilioAuth);

      let sent = 0;
      let failed = 0;
      for (const to of phones) {
        try {
          await client.messages.create({ body: message.trim(), from: twilioFrom, to });
          sent++;
        } catch (smsErr: any) {
          console.error(`[SMS] Failed to send to ${to}:`, smsErr.message);
          failed++;
        }
      }

      console.log(`[SMS] Sent ${sent} messages, failed ${failed}`);
      res.json({ success: true, sent, failed, total: phones.length });
    } catch (error: any) {
      console.error("[Admin] send-sms error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to send SMS" });
    }
  });

  function buildMarketingEmailHtml(userName: string, subject: string, message: string, userEmail: string, appDomain: string) {
    const unsubscribeUrl = `${appDomain}/unsubscribe?email=${encodeURIComponent(userEmail)}`;
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#FF6B35;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;letter-spacing:1px;">Mobi App</h1>
            <p style="color:#FFD0B5;margin:4px 0 0;font-size:13px;">Connecting Technicians, Teachers & Suppliers</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e8e8;border-top:none;">
            <p style="color:#333;font-size:16px;margin:0 0 8px;">Hello ${userName || 'Mobi User'},</p>
            <h2 style="color:#FF6B35;font-size:22px;margin:0 0 20px;font-weight:700;">${subject}</h2>
            <div style="color:#555;font-size:15px;line-height:1.7;white-space:pre-line;">${message.replace(/\n/g, '<br/>')}</div>
            <div style="margin:28px 0;text-align:center;">
              <a href="https://play.google.com/store" style="background:#FF6B35;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Open Mobi App</a>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
            <p style="font-size:12px;color:#aaa;margin:0;text-align:center;">
              You received this because you registered with Mobi App.<br/>
              <a href="${unsubscribeUrl}" style="color:#aaa;">Unsubscribe</a> from marketing emails.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  async function executeBulkEmailSend(campaignId: string, users: { email: string; name: string }[], subject: string, message: string, appDomain: string) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const BATCH_SIZE = 50;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (user) => {
          try {
            const html = buildMarketingEmailHtml(user.name, subject, message, user.email, appDomain);
            await resend.emails.send({
              from: "Mobi App <onboarding@resend.dev>",
              to: user.email.trim(),
              subject: subject.trim(),
              html,
            });
            sent++;
          } catch (err: any) {
            console.error(`[Email] Failed ${user.email}:`, err.message);
            failed++;
          }
        })
      );
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    await db.update(emailCampaigns)
      .set({ sent, failed, status: 'sent', sentAt: Date.now() })
      .where(eq(emailCampaigns.id, campaignId));

    console.log(`[Email] Campaign ${campaignId} complete: sent=${sent}, failed=${failed}`);
    return { sent, failed };
  }

  app.get("/unsubscribe", async (req, res) => {
    const { email } = req.query as { email?: string };
    if (!email || !email.includes('@')) {
      return res.status(400).send('<h2>Invalid unsubscribe link.</h2>');
    }
    try {
      await db.update(profiles).set({ allowMarketing: 0 }).where(eq(profiles.email, email.trim()));
      res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;">
  <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 2px 16px #0001;max-width:400px;">
    <div style="font-size:48px;margin-bottom:16px;">✅</div>
    <h2 style="color:#333;margin:0 0 12px;">Unsubscribed Successfully</h2>
    <p style="color:#666;margin:0;">You have been unsubscribed from Mobi App marketing emails.<br/>You will no longer receive promotional emails.</p>
  </div>
</body></html>`);
    } catch (err: any) {
      res.status(500).send('<h2>Something went wrong. Please try again.</h2>');
    }
  });

  app.get("/api/admin/email-stats", async (req, res) => {
    try {
      const allProfiles = await db.select({
        email: profiles.email,
        allowMarketing: profiles.allowMarketing,
      }).from(profiles);

      const withEmail = allProfiles.filter(p => p.email && p.email.trim().includes('@'));
      const subscribed = withEmail.filter(p => p.allowMarketing !== 0);
      const unsubscribed = withEmail.filter(p => p.allowMarketing === 0);

      const campaigns = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)).limit(20);

      res.json({
        success: true,
        stats: {
          totalWithEmail: withEmail.length,
          subscribed: subscribed.length,
          unsubscribed: unsubscribed.length,
        },
        campaigns,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/admin/send-email", async (req, res) => {
    try {
      const { subject, message, role, scheduledAt } = req.body;
      if (!subject?.trim()) return res.status(400).json({ success: false, message: "Subject required" });
      if (!message?.trim()) return res.status(400).json({ success: false, message: "Message required" });

      if (!process.env.RESEND_API_KEY) {
        return res.status(500).json({ success: false, message: "RESEND_API_KEY not configured. Add it in Replit Secrets." });
      }

      const appDomain = 'https://atozmobilerepair.in';

      let query = db.select({ email: profiles.email, name: profiles.name })
        .from(profiles)
        .where(eq(profiles.allowMarketing, 1));

      let userRows: { email: string | null; name: string }[];
      if (!role || role === 'all') {
        userRows = await db.select({ email: profiles.email, name: profiles.name }).from(profiles)
          .where(eq(profiles.allowMarketing, 1));
      } else if (role === 'paid') {
        userRows = await db.select({ email: profiles.email, name: profiles.name }).from(profiles)
          .where(and(eq(profiles.allowMarketing, 1), eq(profiles.subscriptionActive, 1)));
      } else {
        userRows = await db.select({ email: profiles.email, name: profiles.name }).from(profiles)
          .where(and(eq(profiles.allowMarketing, 1), eq(profiles.role, role)));
      }

      const validUsers = userRows.filter(r => r.email && r.email.trim().includes('@')) as { email: string; name: string }[];

      if (validUsers.length === 0) {
        return res.json({ success: true, sent: 0, failed: 0, total: 0, message: 'No subscribed email addresses found for this target' });
      }

      const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      if (scheduledAt && scheduledAt > Date.now()) {
        await db.insert(emailCampaigns).values({
          id: campaignId,
          subject: subject.trim(),
          message: message.trim(),
          targetRole: role || 'all',
          status: 'scheduled',
          total: validUsers.length,
          scheduledAt,
        });
        return res.json({ success: true, scheduled: true, campaignId, total: validUsers.length, message: `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}` });
      }

      await db.insert(emailCampaigns).values({
        id: campaignId,
        subject: subject.trim(),
        message: message.trim(),
        targetRole: role || 'all',
        status: 'sending',
        total: validUsers.length,
      });

      res.json({ success: true, sent: 0, total: validUsers.length, campaignId, message: `Sending to ${validUsers.length} users in batches...` });

      executeBulkEmailSend(campaignId, validUsers, subject.trim(), message.trim(), appDomain).catch(err => {
        console.error('[Email] Background send failed:', err);
      });
    } catch (error: any) {
      console.error("[Admin] send-email error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to send emails" });
    }
  });

  app.get("/api/admin/email-campaigns", async (req, res) => {
    try {
      const campaigns = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)).limit(50);
      res.json({ success: true, campaigns });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/admin/email-campaigns/:id", async (req, res) => {
    try {
      await db.delete(emailCampaigns).where(eq(emailCampaigns.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  function normalizeFirestoreMsg(doc: any) {
    const data = typeof doc.data === 'function' ? doc.data() : doc;
    const docId = doc.id || data.id;
    let createdAt: number;
    if (typeof data.createdAt === 'number') {
      createdAt = data.createdAt;
    } else if (data.createdAt?._seconds != null) {
      createdAt = data.createdAt._seconds * 1000;
    } else if (data.createdAt?.seconds != null) {
      createdAt = data.createdAt.seconds * 1000;
    } else {
      createdAt = Date.now();
    }
    return { ...data, id: docId || data.id, createdAt };
  }

  app.get("/api/live-chat/messages", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const after = parseInt(req.query.after as string) || 0;
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;
      
      let msgs;
      const firestore = getFirestore();
      
      if (after > 0) {
        const snapshot = await firestore.collection("live_chat_messages")
          .where("createdAt", ">", after)
          .orderBy("createdAt", "asc")
          .limit(limit)
          .get();
        msgs = snapshot.docs.map(doc => normalizeFirestoreMsg(doc));
        return res.json(msgs);
      }

      if (before) {
        const snapshot = await firestore.collection("live_chat_messages")
          .where("createdAt", "<", before)
          .orderBy("createdAt", "desc")
          .limit(limit)
          .get();
        msgs = snapshot.docs.map(doc => normalizeFirestoreMsg(doc)).reverse();
      } else {
        const snapshot = await firestore.collection("live_chat_messages")
          .orderBy("createdAt", "desc")
          .limit(limit)
          .get();
        msgs = snapshot.docs.map(doc => normalizeFirestoreMsg(doc)).reverse();
      }
      
      res.json(msgs);
    } catch (error) {
      console.error("[API] Get live messages error:", error);
      // Fallback to PostgreSQL
      const after = parseInt(req.query.after as string) || 0;
      const limit = parseInt(req.query.limit as string) || 50;
      
      let query = db.select().from(liveChatMessages);
      if (after > 0) {
        const rows = await query.where(gt(liveChatMessages.createdAt, after))
          .orderBy(liveChatMessages.createdAt)
          .limit(limit);
        return res.json(rows);
      }
      
      const rows = await db.select().from(liveChatMessages)
        .orderBy(desc(liveChatMessages.createdAt))
        .limit(limit);
      res.json(rows.reverse());
    }
  });

  app.post("/api/live-chat/messages", async (req, res) => {
    try {
      const { senderId, senderName, senderRole, senderAvatar, message, image, video } = req.body;
      if (!senderId) return res.status(400).json({ success: false, error: "senderId required" });
      if (!message && !image && !video) return res.status(400).json({ success: false, error: "message, image or video required" });
      
      const messageId = randomUUID();
      const msgData = {
        id: messageId,
        senderId,
        senderName: senderName || "",
        senderRole: senderRole || "",
        senderAvatar: senderAvatar || "",
        message: message || "",
        image: image || "",
        video: video || "",
        createdAt: Date.now(),
      };

      const firestore = getFirestore();
      await firestore.collection("live_chat_messages").doc(messageId).set(msgData);
      await db.insert(liveChatMessages).values(msgData);

      res.json({ success: true, message: msgData });
    } catch (error) {
      console.error("[API] Post live message error:", error);
      res.status(500).json({ success: false });
    }
  });


  // Admin redact a single live chat message
  app.delete("/api/live-chat/messages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const phone = req.query.phone as string;
      if (phone !== '8179142535') return res.status(403).json({ success: false, message: "Admin only" });

      const deletedText = "This message was deleted by Arun sir";
      await db.update(liveChatMessages)
        .set({ message: deletedText, image: "", video: "" })
        .where(eq(liveChatMessages.id, id));

      try {
        const firestore = getFirestore();
        await firestore.collection("live_chat_messages").doc(id).update({
          message: deletedText, image: "", video: ""
        });
      } catch (fsErr) {
        console.warn("[LiveChat] Firestore delete sync error:", fsErr);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[LiveChat] Delete single message error:", error);
      res.status(500).json({ success: false });
    }
  });

  app.delete("/api/live-chat/clear", async (req, res) => {
    try {
      const adminPhone = req.query.adminPhone as string;
      if (adminPhone !== '8179142535') return res.status(403).json({ success: false, message: "Admin only" });
      // Clear from PostgreSQL
      await db.delete(liveChatMessages);
      // Clear from Firestore
      try {
        const firestore = getFirestore();
        const snapshot = await firestore.collection("live_chat_messages").limit(500).get();
        if (!snapshot.empty) {
          const batch = firestore.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (fsErr) {
        console.warn("[Clear Chat] Firestore delete error:", fsErr);
      }
      return res.json({ success: true, message: "All chat messages cleared" });
    } catch (error) {
      console.error("[Clear Chat] Error:", error);
      return res.status(500).json({ success: false, message: "Failed to clear chat" });
    }
  });

  app.get("/api/community/stats", async (_req, res) => {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(profiles);
      res.json({ totalMembers: result[0]?.count || 0 });
    } catch (error) {
      res.status(500).json({ totalMembers: 0 });
    }
  });

  // ========== Teacher Live Sessions ==========
  app.get("/api/teacher/live-sessions", async (req, res) => {
    try {
      const firestore = getFirestore();
      const snapshot = await firestore.collection("teacher_live_sessions")
        .where("isLive", "==", true)
        .get();
      const sessions = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.startedAt || 0) - (a.startedAt || 0));
      return res.json({ success: true, sessions });
    } catch (error) {
      console.error("[Live] Get sessions error:", error);
      return res.status(500).json({ success: false, sessions: [] });
    }
  });

  app.post("/api/teacher/go-live", async (req, res) => {
    try {
      const { teacherId, teacherName, teacherAvatar, title, description, platform, link } = req.body;
      if (!teacherId || !title || !link) {
        return res.status(400).json({ success: false, message: "teacherId, title, and link are required" });
      }

      const sessionId = randomUUID();
      const firestore = getFirestore();

      // End any existing live session for this teacher first
      const existing = await firestore.collection("teacher_live_sessions")
        .where("teacherId", "==", teacherId)
        .where("isLive", "==", true)
        .get();
      for (const doc of existing.docs) {
        await doc.ref.update({ isLive: false, endedAt: Date.now() });
      }

      const sessionData = {
        id: sessionId,
        teacherId,
        teacherName: teacherName || "",
        teacherAvatar: teacherAvatar || "",
        title,
        description: description || "",
        platform: platform || "other",
        link,
        isLive: true,
        startedAt: Date.now(),
        viewerCount: 0,
      };

      await firestore.collection("teacher_live_sessions").doc(sessionId).set(sessionData);

      // Send push notification to all users
      const platformEmoji: Record<string, string> = {
        youtube: "▶️", zoom: "📹", meet: "🎥", other: "🔴"
      };
      const emoji = platformEmoji[platform] || "🔴";
      await notifyAllUsers({
        title: `${emoji} ${teacherName} is LIVE now!`,
        body: title,
        data: { type: 'teacher_live', sessionId, link, platform },
      }, teacherId);

      console.log(`[Live] ${teacherName} went live: ${title}`);
      return res.json({ success: true, session: sessionData });
    } catch (error) {
      console.error("[Live] Go live error:", error);
      return res.status(500).json({ success: false, message: "Failed to go live" });
    }
  });

  app.post("/api/teacher/end-live", async (req, res) => {
    try {
      const { teacherId, sessionId } = req.body;
      if (!teacherId) return res.status(400).json({ success: false, message: "teacherId required" });
      const firestore = getFirestore();
      if (sessionId) {
        await firestore.collection("teacher_live_sessions").doc(sessionId).update({
          isLive: false, endedAt: Date.now()
        });
      } else {
        const existing = await firestore.collection("teacher_live_sessions")
          .where("teacherId", "==", teacherId)
          .where("isLive", "==", true)
          .get();
        for (const doc of existing.docs) {
          await doc.ref.update({ isLive: false, endedAt: Date.now() });
        }
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("[Live] End live error:", error);
      return res.status(500).json({ success: false, message: "Failed to end live session" });
    }
  });

  app.post("/api/teacher/live-session/upload-image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        console.log("[Live Session Upload] No file in request");
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }
      const { sessionId, sessionLink, teacherName } = req.body;
      if (!sessionId) {
        console.log("[Live Session Upload] No sessionId in request body");
        return res.status(400).json({ success: false, message: "Session ID required" });
      }

      console.log(`[Live Session Upload] Received file: ${req.file.originalname}, size: ${req.file.buffer.length}, sessionId: ${sessionId}`);
      const filename = `images/${randomUUID()}${path.extname(req.file.originalname)}`;
      const url = await uploadToStorage(req.file.buffer, filename);

      // Build message text — include the join link so viewers can tap it
      const displayName = teacherName || "Teacher";
      const linkText = sessionLink ? `\nJoin Live: ${sessionLink}` : "";
      const messageText = `📸 ${displayName} shared a photo from the live session${linkText}`;

      // Add to live chat so all technicians/suppliers see it
      const messageId = randomUUID();
      const msgData = {
        id: messageId,
        senderId: "system",
        senderName: displayName,
        senderRole: "teacher",
        senderAvatar: "",
        message: messageText,
        image: url,
        video: "",
        createdAt: Date.now(),
      };

      const firestore = getFirestore();
      if (firestore) {
        await firestore.collection("live_chat_messages").doc(messageId).set(msgData);
        console.log("[Live Session Upload] Message added to Firestore live_chat_messages, id:", messageId);
        // Also update the live session document so Mobi Live card shows latest photo
        try {
          await firestore.collection("teacher_live_sessions").doc(sessionId).update({
            latestImage: url,
            latestImageAt: Date.now(),
          });
          console.log("[Live Session Upload] Updated teacher_live_sessions latestImage for:", sessionId);
        } catch (sessErr) {
          console.warn("[Live Session Upload] Could not update session latestImage:", sessErr);
        }
      }

      // Notify all users that the teacher shared a photo
      (async () => {
        try {
          await notifyAllUsers({
            title: `📸 ${displayName} shared a photo!`,
            body: sessionLink ? `Check the live chat — Join: ${sessionLink}` : `Check the Live Community chat now!`,
            data: { type: 'live_chat_image', link: sessionLink || '' },
          });
        } catch (e) { console.warn('[Push] Live session photo notify failed:', e); }
      })();

      res.json({ success: true, url });
    } catch (error) {
      console.error("[Live Session Upload] Error:", error);
      res.status(500).json({ success: false, message: "Upload failed" });
    }
  });

  app.get("/api/admin/push-stats", async (req, res) => {
    try {
      const { phone } = req.query;
      if (phone !== '8179142535') return res.status(403).json({ success: false, message: "Admin only" });
      const allProfilesList = await db.select({ pushToken: profiles.pushToken, role: profiles.role }).from(profiles);
      const total = allProfilesList.length;
      const withToken = allProfilesList.filter(p => p.pushToken && p.pushToken.startsWith('ExponentPushToken')).length;
      const byRole: Record<string, number> = {};
      for (const p of allProfilesList) {
        if (p.pushToken && p.pushToken.startsWith('ExponentPushToken') && p.role) {
          byRole[p.role] = (byRole[p.role] || 0) + 1;
        }
      }
      res.json({ total, withToken, byRole });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  });

  // REST endpoint for admin to delete (redact) a live chat message
  app.post("/api/live-chat/delete-message", async (req, res) => {
    try {
      const { messageId, phone } = req.body;
      if (phone !== '8179142535') return res.status(403).json({ success: false, message: "Admin only" });
      if (!messageId) return res.status(400).json({ success: false, message: "messageId required" });

      const deletedText = "This message was deleted by Arun sir";
      await db.update(liveChatMessages)
        .set({ message: deletedText, image: "", video: "" })
        .where(eq(liveChatMessages.id, messageId));

      try {
        const firestore = getFirestore();
        await firestore.collection("live_chat_messages").doc(messageId).update({
          message: deletedText, image: "", video: ""
        });
      } catch (fsErr) {
        console.warn("[LiveChat] Firestore delete sync error:", fsErr);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[LiveChat] Delete message error:", error);
      res.status(500).json({ success: false });
    }
  });

  const httpServer = createServer(app);
  app.get("/download/:filename", (req, res) => {
    const filename = req.params.filename;
    // Basic security check to prevent directory traversal
    if (filename.includes("..") || filename.includes("/")) {
      return res.status(403).send("Forbidden");
    }
    const filePath = path.join(process.cwd(), "public", "download", filename);
    res.download(filePath, (err) => {
      if (err) {
        console.error(`[Download] Error sending ${filename}:`, err);
        res.status(404).send("File not found");
      }
    });
  });

  return httpServer;
}
