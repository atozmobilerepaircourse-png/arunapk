import { Resend } from "resend";

export async function sendWelcomeEmail(userEmail: string, userName: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY not set, skipping welcome email to:", userEmail);
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: "Mobi App <onboarding@resend.dev>",
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
      console.error("[Email] Resend error:", error);
    } else {
      console.log("[Email] Welcome email sent to:", userEmail, "ID:", data?.id);
    }
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
  }
}

export async function sendOtpEmail(userEmail: string, otp: string): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.log("[EmailOTP] RESEND_API_KEY not set, cannot send OTP to:", userEmail);
    return { sent: false, error: "Email provider not configured" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: "Mobi App <onboarding@resend.dev>",
      to: userEmail,
      subject: `${otp} is your Mobi verification code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #333;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #FF6B35; font-size: 28px; margin: 0;">Mobi</h1>
            <p style="color: #888; font-size: 13px; margin: 4px 0 0;">AtoZ Mobile Repair</p>
          </div>
          <div style="background: #f8f8f8; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: #666; font-size: 15px; margin: 0 0 12px;">Your verification code is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #FF6B35; font-family: monospace;">${otp}</div>
            <p style="color: #999; font-size: 13px; margin: 12px 0 0;">Valid for 5 minutes. Do not share this code.</p>
          </div>
          <p style="color: #666; font-size: 14px; text-align: center;">
            Enter this code in the Mobi app to verify your email address.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #aaa; text-align: center;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[EmailOTP] Resend error:", error);
      return { sent: false, error: error.message || "Email send failed" };
    }

    console.log("[EmailOTP] OTP email sent to:", userEmail, "ID:", data?.id);
    return { sent: true };
  } catch (err: any) {
    console.error("[EmailOTP] Unexpected error:", err);
    return { sent: false, error: err?.message || "Email send failed" };
  }
}
