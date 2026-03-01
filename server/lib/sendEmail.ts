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
