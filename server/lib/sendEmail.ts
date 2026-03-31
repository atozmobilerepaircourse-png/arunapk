export interface EmailResult {
  success: boolean;
  error?: string;
  details?: string;
}

export async function sendOTPEmail(userEmail: string, otp: string): Promise<EmailResult> {
  try {
    // Use simple HTTP request - MINIMAL approach
    const apiKey = process.env.SENDGRID_API_KEY?.trim();
    const fromEmail = (process.env.SENDGRID_FROM_EMAIL || "arun173753@gmail.com").trim();
    
    console.log("[Email] Sending OTP to:", userEmail);
    console.log("[Email] From email:", fromEmail);
    console.log("[Email] API Key configured:", !!apiKey);
    
    if (!apiKey) {
      return { success: false, error: "SENDGRID_API_KEY not found" };
    }

    const emailContent = `Your OTP is: ${otp}. Valid for 5 minutes.`;

    // Direct SendGrid API call - SIMPLE format
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: userEmail }],
          subject: "Your OTP Code"
        }],
        from: { email: fromEmail },
        content: [{ type: "text/plain", value: emailContent }]
      })
    });

    console.log("[Email] SendGrid response status:", response.status);

    if (!response.ok) {
      const error = await response.json() as any;
      console.error("[Email] SendGrid error:", JSON.stringify(error));
      return { success: false, error: error.message || "Failed to send email" };
    }

    console.log("[Email] ✓ Email sent successfully to:", userEmail);
    return { success: true };

  } catch (err: any) {
    console.error("[Email] Error:", err.message);
    return { success: false, error: err.message };
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
