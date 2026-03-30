import { Resend } from "resend";

export async function sendOTPEmail(userEmail: string, otp: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY not set, skipping OTP email to:", userEmail);
    return false;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: "Mobi App <onboarding@resend.dev>",
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
      console.error("[Email] OTP send error:", error);
      console.error("[Email] Error details:", JSON.stringify(error, null, 2));
      return false;
    } else {
      console.log("[Email] OTP sent to:", userEmail, "ID:", data?.id);
      return true;
    }
  } catch (err) {
    console.error("[Email] OTP send unexpected error:", err);
    return false;
  }
}

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
      console.error("[Email] Resend error:", JSON.stringify(error));
    } else {
      console.log("[Email] Welcome email sent to:", userEmail, "ID:", data?.id);
    }
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
  }
}
