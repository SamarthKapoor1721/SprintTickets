import nodemailer from "nodemailer";
import { env } from "../env";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
    })
  : null;

/**
 * Helper to dispatch emails. If SMTP is not configured, it logs the email to console instead.
 */
async function dispatchEmail(to: string | string[], subject: string, text: string, html: string) {
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.log(`[Email Mock] To: ${to} | Subject: ${subject}\n\n${text}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendReportNotificationEmail(
  recipientEmails: string[],
  submitterName: string,
  projectName?: string | null,
  reportDate?: Date,
) {
  if (recipientEmails.length === 0) return;

  const dateStr = reportDate ? reportDate.toLocaleDateString() : new Date().toLocaleDateString();
  const contextStr = projectName ? ` for project "${projectName}"` : "";
  const subject = `New Daily Report Submitted: ${submitterName}`;
  const text = `${submitterName} has submitted a new daily progress report${contextStr} for ${dateStr}. Please log in to the dashboard to review it.`;
  const html = `<p><strong>${submitterName}</strong> has submitted a new daily progress report${contextStr} for <strong>${dateStr}</strong>.</p><p><a href="${env.APP_URL}">Log in to the dashboard</a> to review it.</p>`;

  await dispatchEmail(recipientEmails, subject, text, html);
}

export async function sendDirectMessageEmail(recipientEmail: string, senderName: string, messageContent: string) {
  const subject = `New direct message from ${senderName}`;
  const text = `You have a new message from ${senderName}:\n\n"${messageContent}"\n\nLog in to the dashboard to reply.`;
  const html = `<p>You have a new message from <strong>${senderName}</strong>:</p><blockquote>${messageContent}</blockquote><p><a href="${env.APP_URL}">Log in to the dashboard</a> to reply.</p>`;

  await dispatchEmail(recipientEmail, subject, text, html);
}

export async function sendTaskCommentEmail(
  recipientEmails: string[],
  taskTitle: string,
  commenterName: string,
  commentContent: string,
) {
  if (recipientEmails.length === 0) return;

  const subject = `New comment on task: ${taskTitle}`;
  const text = `${commenterName} commented on task "${taskTitle}":\n\n"${commentContent}"\n\nLog in to the dashboard to view and reply.`;
  const html = `<p><strong>${commenterName}</strong> commented on task "<strong>${taskTitle}</strong>":</p><blockquote>${commentContent}</blockquote><p><a href="${env.APP_URL}">Log in to the dashboard</a> to view and reply.</p>`;

  await dispatchEmail(recipientEmails, subject, text, html);
}

export async function sendReviewCommentEmail(
  recipientEmails: string[],
  reviewTitle: string,
  commenterName: string,
  commentContent: string,
) {
  if (recipientEmails.length === 0) return;

  const subject = `New comment on review request: ${reviewTitle}`;
  const text = `${commenterName} commented on review request "${reviewTitle}":\n\n"${commentContent}"\n\nLog in to the dashboard to view and reply.`;
  const html = `<p><strong>${commenterName}</strong> commented on review request "<strong>${reviewTitle}</strong>":</p><blockquote>${commentContent}</blockquote><p><a href="${env.APP_URL}">Log in to the dashboard</a> to view and reply.</p>`;

  await dispatchEmail(recipientEmails, subject, text, html);
}

export async function sendPasswordResetEmail(recipientEmail: string, resetUrl: string, fullName?: string | null) {
  const name = fullName?.trim();
  const greeting = name ? `Hello ${escapeHtml(name)}` : "Hello";
  const subject = "Reset your Sprint Tickets password";
  const text = [
    `${greeting},`,
    "",
    "We received a request to reset your Sprint Tickets password.",
    "Use the link below to choose a new password:",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>${greeting},</p>
      <p>We received a request to reset your Sprint Tickets password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">
          Reset password
        </a>
      </p>
      <p style="word-break: break-all;">If the button does not work, use this link:<br />${resetUrl}</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await dispatchEmail(recipientEmail, subject, text, html);
}
