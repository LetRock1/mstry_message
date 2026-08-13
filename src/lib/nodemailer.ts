import nodemailer from "nodemailer"

export const gmailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,        // e.g., yourname@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD, // 16-character Google App Password
  },
})