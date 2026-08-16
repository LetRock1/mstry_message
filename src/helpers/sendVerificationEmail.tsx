import { render } from "@react-email/render";
import VerificationEmail from "../../emails/VerificationEmail";
import { ApiResponse } from "@/types/ApiResponse";
import { gmailTransporter } from "@/lib/nodemailer";

export async function sendVerificationEmail(
  email: string,
  username: string,
  verifyCode: string
): Promise<ApiResponse> {
  try {
    const emailHtml: string = await render(
      <VerificationEmail username={username} otp={verifyCode} />
    );

    await gmailTransporter.sendMail({
      from: `"Mystery Message" <${process.env.EMAIL_FROM}>`, // ✅ Use verified sender
      to: email,
      subject: "Mystery Message | Verification code",
      html: emailHtml,
    });

    return { success: true, message: "Verification email sent successfully" };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, message: "Failed to send verification email" };
  }
}