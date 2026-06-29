import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

async function main() {
  console.log("Configuring transport...");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log("Sending mail...");
  try {
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: "test@example.com", // Sending to a dummy email to see if Resend rejects the sender or the recipient
      subject: "Test email",
      text: "Test email body",
    });
    console.log("Success:", info);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

main();
