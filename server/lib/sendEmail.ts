export interface EmailResult {
  success: boolean;
  error?: string;
  details?: string;
}

export async function sendOTPEmail(userEmail: string, otp: string): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  console.log("[Email] DEBUG - Checking API key:");
  console.log("[Email] KEY EXISTS:", !!apiKey);
  console.log("[Email] KEY VALUE STARTS WITH:", apiKey?.substring(0, 10) || "UNDEFINED");
  console.log("[Email] FULL KEY:", apiKey || "NO KEY FOUND");
  
  if (!apiKey) {
    const msg = "SENDGRID_API_KEY not configured in environment variables";
    console.error("[Email] " + msg);
    return { success: false, error: msg, details: "API key missing from Cloud Run/Replit env vars" };
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "arun173753@gmail.com";
  console.log("[Email] Configuration check:");
  console.log("  - API Key length:", apiKey.length);
  console.log("  - From email:", fromEmail);
  console.log("  - To email:", userEmail);

  try {
    console.log("[Email] Sending OTP email via SendGrid...");
    
    const emailContent = `Your OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;

    console.log("[Email] Request details:");
    console.log("  - Endpoint: https://api.sendgrid.com/v3/mail/send");
    console.log("  - From:", fromEmail);
    console.log("  - To:", userEmail);
    console.log("  - API Key starts with:", apiKey.substring(0, 10) + "...");

    const payload = {
      personalizations: [
        {
          to: [{ email: userEmail }],
        },
      ],
      from: {
        email: fromEmail,
      },
      subject: "Your Mobi App Verification Code",
      content: [
        {
          type: "text/plain",
          value: emailContent,
        },
      ],
    };

    console.log("[Email] Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("[Email] Response status:", response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = await response.text();
      }
      
      console.error("[Email] SendGrid API error:");
      console.error("  - Status:", response.status);
      console.error("  - Body:", JSON.stringify(errorData, null, 2));
      
      const errorMsg = typeof errorData === 'object' ? (errorData.errors?.[0]?.message || errorData.message) : errorData;
      return { success: false, error: `SendGrid error: ${errorMsg || response.statusText}`, details: JSON.stringify(errorData) };
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
