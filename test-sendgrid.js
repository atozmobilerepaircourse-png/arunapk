const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = "arun173753@gmail.com";

console.log("API Key exists:", !!apiKey);
console.log("API Key starts with:", apiKey?.substring(0, 20) || "NONE");

const sendEmail = async () => {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: "test@example.com" }],
          subject: "Test OTP"
        }],
        from: { email: fromEmail },
        content: [{ type: "text/plain", value: "Test message" }]
      })
    });

    console.log("Response status:", response.status);
    const body = await response.json();
    console.log("Response body:", JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
};

sendEmail();
