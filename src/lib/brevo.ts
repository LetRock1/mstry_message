export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;

  if (!apiKey || !fromEmail) {
    throw new Error("Missing BREVO_API_KEY or EMAIL_FROM");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: "Mystery Message",
        email: fromEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Brevo API error: ${res.status} ${errorText}`);
  }

  return { success: true };
}