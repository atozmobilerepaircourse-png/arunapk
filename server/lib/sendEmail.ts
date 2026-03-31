import { Resend } from "resend";

export interface EmailResult {
  success: boolean;
  error?: string;
  details?: string;
}

export async function sendOTPEmail(userEmail: string, otp: string): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    const msg = "RESEND_API_KEY not configured in environment variables";
    console.error("[Email] " + msg);
    return { success: false, error: msg, details: "API key missing from Cloud Run/Replit env vars" };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  console.log("[Email] Configuration check:");
  console.log("  - API Key length:", process.env.RESEND_API_KEY.length);
  console.log("  - From email:", fromEmail);
  console.log("  - To email:", userEmail);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    console.log("[Email] Sending OTP email via Resend...");
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: "Your Mobi App Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35; text-align: center;">Verification Code</h2>
          <p>Your Mobi App verification code is:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="letter-spacing: 8px; color: #FF6B35; margin: 0; font-family: monospace;">${otp}</h1>
          </div>
          <p>This code is valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] Resend API returned error:");
      console.error("  - Error type:", error.message);
      console.error("  - Full error object:", JSON.stringify(error, null, 2));
      
      let errorMessage = error.message || "Unknown error from Resend";
      let details = "";
      
      // Parse specific Resend errors
      if (error.message.includes("unauthorized")) {
        details = "API key is invalid or expired - verify RESEND_API_KEY in Cloud Run environment variables";
      } else if (error.message.includes("from") || error.message.includes("invalid_from_address")) {
        details = `From email '${fromEmail}' is not verified in Resend dashboard. Add verified domain or use onboarding@resend.dev if in free tier`;
      } else if (error.message.includes("Invalid email") || error.message.includes("invalid_email")) {
        details = `Recipient email '${userEmail}' is invalid`;
      } else {
        details = JSON.stringify(error);
      }
      
      return { success: false, error: errorMessage, details };
    }

    if (!data?.id) {
      console.error("[Email] Resend returned success but no email ID");
      return { success: false, error: "No email ID returned from Resend", details: JSON.stringify(data) };
    }

    console.log("[Email] ✓ OTP sent successfully:");
    console.log("  - To:", userEmail);
    console.log("  - Email ID:", data.id);
    console.log("  - From:", fromEmail);
    
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Unexpected error during email send:");
    console.error("  - Error message:", err.message);
    console.error("  - Stack:", err.stack);
    
    return {
      success: false,
      error: err.message || "Unexpected error",
      details: `Exception: ${err.toString()}`
    };
  }
}

export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[Email] RESEND_API_KEY not set, cannot send welcome email to:", userEmail);
    return { success: false, error: "Email service not configured", details: "RESEND_API_KEY missing" };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    console.log("[Email] Sending welcome email to:", userEmail);
    const { data, error } = await resend.emails.send({
      from: `Mobi App <${fromEmail}>`,
      to: userEmail,
      subject: "Welcome to Mobi App 🎉",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #FF6B35;">Hello ${userName}</h2>
          <p>You have successfully signed in to <strong>Mobi App</strong> using your Google account.</p>
          <p>We're excited to have you on board! 🚀</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">If you didn't sign in to Mobi App, please ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] Welcome email error:", JSON.stringify(error));
      return { success: false, error: error.message || "Failed to send welcome email", details: JSON.stringify(error) };
    }

    if (!data?.id) {
      console.error("[Email] Welcome email: no ID returned");
      return { success: false, error: "No email ID returned", details: JSON.stringify(data) };
    }

    console.log("[Email] ✓ Welcome email sent to:", userEmail, "ID:", data.id);
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Unexpected error sending welcome email:", err);
    return { success: false, error: err.message || "Unexpected error", details: err.toString() };
  }
}
