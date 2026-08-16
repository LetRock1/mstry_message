import { Worker } from "bullmq";
import { redisConnection } from "@/lib/redis";
import { gmailTransporter } from "@/lib/nodemailer";
import UserModel from "@/model/User";
import dbConnect from "@/lib/dbConnect";

export const emailWorker = new Worker(
  "email-notification-queue",
  async (job) => {
    await dbConnect();

    const { recipientId, unreadCount } = job.data;

    const user = await UserModel.findById(recipientId);
    if (!user || !user.email) return;

    await gmailTransporter.sendMail({
      from: `"Anonymous Inbox" <${process.env.EMAIL_FROM}>`, // ✅ Use verified sender
      to: user.email,
      subject: `📥 You have ${unreadCount} unread anonymous messages!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Hello ${user.username},</h2>
          <p>You have accumulated <strong>${unreadCount} unread messages</strong> waiting on your dashboard.</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXTAUTH_URL}/dashboard" 
               style="background-color: #2563eb; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
               View Dashboard
            </a>
          </p>
        </div>
      `,
    });

    console.log(`[Brevo Worker] Digest sent to ${user.email}`);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);