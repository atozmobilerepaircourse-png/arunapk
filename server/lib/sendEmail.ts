export interface EmailResult {
  success: boolean;
  error?: string;
  details?: string;
}

export async function sendOTPEmail(userEmail: string, otp: string): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    const msg = "SENDGRID_API_KEY not configured in environment variables";
    console.error("[Email] " + msg);
    return { success: false, error: msg, details: "API key missing from Cloud Run/Replit env vars" };
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "support@mobi.app";
  console.log("[Email] Configuration check:");
  console.log("  - API Key length:", apiKey.length);
  console.log("  - From email:", fromEmail);
  console.log("  - To email:", userEmail);

  try {
    console.log("[Email] Sending OTP email via SendGrid...");
    
    const emailContent = `
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
    `;

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: userEmail }],
            subject: "Your Mobi App Verification Code",
          },
        ],
        from: {
          email: fromEmail,
          name: "Mobi App",
        },
        content: [
          {
            type: "text/html",
            value: emailContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const data = await response.json() as any;
      console.error("[Email] SendGrid API returned error:");
      console.error("  - Status:", response.status);
      console.error("  - Response:", JSON.stringify(data, null, 2));
      
      let errorMessage = data?.message || `HTTP ${response.status}`;
      let details = "";
      
      if (response.status === 401) {
        details = "API key is invalid or expired - verify SENDGRID_API_KEY in Cloud Run environment variables";
      } else if (response.status === 400) {
        details = `Invalid request - check from email '${fromEmail}' or recipient email '${userEmail}'`;
      } else {
        details = JSON.stringify(data);
      }
      
      return { success: false, error: errorMessage, details };
    }

    console.log("[Email] ✓ OTP sent successfully via SendGrid:");
    console.log("  - To:", userEmail);
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
