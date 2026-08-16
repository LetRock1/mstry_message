import { gmailTransporter } from "@/lib/nodemailer";

export async function GET() {
  try {
    const info = await gmailTransporter.sendMail({
      from: `"Test" <${process.env.SMTP_USER}>`,
      to: "krishnajdhanresha@gmail.com", // ← put your email here
      subject: "Test Email from Mstry Message",
      text: "If you see this, SMTP works!",
    });
    return Response.json({ success: true, message: "Test email sent", info });
  } catch (error: any) {
    console.error("Test email error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}