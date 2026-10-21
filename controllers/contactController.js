import asyncHandler from "express-async-handler";
import nodemailer from "nodemailer";
import Contact from "../models/Contact.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Create the Gmail transporter once and reuse it (faster than creating per request)
let cachedTransporter = null;
const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.GMAIL_USER?.trim() || "sanaarman033@gmail.com";
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!pass || user === "your-email@gmail.com") {
    throw new Error(
      "Email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD, or configure RESEND_API_KEY.",
    );
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return cachedTransporter;
};

// Sends an email using Resend (HTTPS, works on Render) if RESEND_API_KEY is set,
// otherwise falls back to Gmail SMTP (works on localhost).
const sendEmail = async ({ from, to, replyTo, subject, text, html }) => {
  const resendKey = process.env.RESEND_API_KEY?.trim();

  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Default to verified onboarding sender or custom domain
        from:
          process.env.RESEND_FROM?.trim() ||
          "Sanaullah <onboarding@resend.dev>",
        to: [to],
        reply_to: replyTo,
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        result.message || `Resend API returned status ${response.status}`,
      );
    }
    return result.id;
  }

  const info = await getTransporter().sendMail({
    from,
    to,
    replyTo,
    subject,
    text,
    html,
  });
  return info.messageId;
};

const getWhatsAppConfig = () => ({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim(),
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  templateName: process.env.WHATSAPP_TEMPLATE_NAME?.trim(),
  templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en",
  recipient: (process.env.WHATSAPP_RECIPIENT_PHONE || "923099369195").replace(
    /\D/g,
    "",
  ),
  apiVersion: process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v26.0",
});

const sendWhatsAppNotification = async (
  { fullName, yourEmail, phoneNumber, budget, message },
  config,
) => {
  const {
    accessToken,
    phoneNumberId,
    templateName,
    templateLanguage,
    recipient,
    apiVersion,
  } = config;
  if (
    !accessToken ||
    !phoneNumberId ||
    !templateName ||
    !templateLanguage ||
    !recipient
  ) {
    throw new Error("WhatsApp Cloud API is not fully configured");
  }

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: fullName },
                { type: "text", text: yourEmail },
                { type: "text", text: phoneNumber || "Not provided" },
                { type: "text", text: budget || "Not provided" },
                // WhatsApp template params cannot contain newlines/tabs
                {
                  type: "text",
                  text: message.replace(/[\r\n\t]+/g, " ").slice(0, 900),
                },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(10000),
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        `WhatsApp API returned status ${response.status}`,
    );
  }
  return result.messages?.[0]?.id;
};

// ─── Notification delivery ─────────────────────────────────────────────────────
const deliverNotifications = async ({
  contactId,
  name,
  email,
  phone,
  budget,
  message,
}) => {
  const envSender = process.env.GMAIL_USER?.trim();
  const senderUser =
    envSender && envSender !== "your-email@gmail.com"
      ? envSender
      : "sanaarman033@gmail.com";

  const envOwner = process.env.OWNER_EMAIL?.trim();
  const ownerTarget =
    envOwner && envOwner !== "your-email@gmail.com"
      ? envOwner
      : senderUser;

  const escapedName = escapeHtml(name);
  const escapedEmail = escapeHtml(email);
  const escapedPhone = escapeHtml(phone);
  const escapedBudget = escapeHtml(budget);
  const escapedMessage = escapeHtml(message).replace(/\n/g, "<br>");

  const ownerMail = {
    from: `"Portfolio Contact" <${senderUser}>`,
    to: ownerTarget,
    replyTo: email,
    subject: `New Portfolio Contact from ${name}`,
    text: `New portfolio inquiry\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "Not provided"}\nBudget: ${budget || "Not provided"}\n\nMessage:\n${message}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
        <div style="background:#FD853A;padding:24px 32px;">
          <h2 style="color:#fff;margin:0;font-size:22px;">New Portfolio Inquiry</h2>
        </div>
        <div style="padding:32px;background:#fff;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;color:#959595;font-size:13px;width:130px;">Full Name</td>
              <td style="padding:10px 0;color:#0D0D0D;font-weight:600;">${escapedName}</td>
            </tr>
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;">Email</td>
              <td style="padding:10px 0;color:#0D0D0D;font-weight:600;">${escapedEmail}</td>
            </tr>
            ${
              phone
                ? `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;">Phone</td>
              <td style="padding:10px 0;color:#0D0D0D;font-weight:600;">${escapedPhone}</td>
            </tr>`
                : ""
            }
            ${
              budget
                ? `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;">Budget</td>
              <td style="padding:10px 0;color:#FD853A;font-weight:600;">${escapedBudget}</td>
            </tr>`
                : ""
            }
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;vertical-align:top;">Message</td>
              <td style="padding:10px 0;color:#0D0D0D;line-height:1.7;">${escapedMessage}</td>
            </tr>
          </table>
        </div>
        <div style="padding:16px 32px;background:#f9f9f9;text-align:center;font-size:12px;color:#bbb;">
          Sent from your portfolio website • ${new Date().toLocaleString()}
        </div>
      </div>
    `,
  };

  const clientMail = {
    from: `"Sana Arman" <${senderUser}>`,
    to: email,
    subject: `Got your message, ${name}!`,
    text: `Hi ${name},\n\nI've received your message and will get back to you as soon as possible — usually within 24 hours.\n\nYour message: "${message}"\n\nTalk soon,\nSana Arman`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e5e5;overflow:hidden;">
        <div style="background:#FD853A;padding:24px 32px;">
          <h2 style="color:#fff;margin:0;">Thanks for reaching out!</h2>
        </div>
        <div style="padding:32px;">
          <p style="color:#0D0D0D;font-size:16px;line-height:1.7;">
            Hi <strong>${escapedName}</strong>,<br><br>
            I've received your message and will get back to you as soon as possible — usually within 24 hours.
          </p>
          <div style="background:#FFF8F4;border-left:4px solid #FD853A;padding:16px 20px;border-radius:6px;margin:24px 0;">
            <p style="margin:0;color:#555;font-size:14px;line-height:1.6;"><em>"${escapedMessage}"</em></p>
          </div>
          <p style="color:#959595;font-size:14px;">Talk soon,<br><strong style="color:#0D0D0D;">Sana Arman</strong></p>
        </div>
      </div>
    `,
  };

  const whatsAppConfig = getWhatsAppConfig();
  const whatsAppConfigured = Boolean(
    whatsAppConfig.accessToken &&
    whatsAppConfig.phoneNumberId &&
    whatsAppConfig.templateName &&
    whatsAppConfig.templateLanguage,
  );

  // In Resend free sandbox (onboarding@resend.dev), Resend only allows sending to the account owner.
  // To avoid Resend 403 errors, only send client auto-reply if using Gmail SMTP or a verified custom domain.
  const isResendSandbox = Boolean(
    process.env.RESEND_API_KEY &&
    (!process.env.RESEND_FROM || process.env.RESEND_FROM.includes("onboarding@resend.dev"))
  );
  const clientReplyEnabled =
    !isResendSandbox &&
    senderUser &&
    email.toLowerCase() !== senderUser.toLowerCase();

  const [emailResult, whatsAppResult, clientReplyResult] =
    await Promise.allSettled([
      sendEmail(ownerMail),
      whatsAppConfigured
        ? sendWhatsAppNotification(
            {
              fullName: name,
              yourEmail: email,
              phoneNumber: phone,
              budget,
              message,
            },
            whatsAppConfig,
          )
        : Promise.reject(new Error("WhatsApp Cloud API is not configured")),
      clientReplyEnabled ? sendEmail(clientMail) : Promise.resolve(null),
    ]);

  if (emailResult.status === "fulfilled") {
    console.log(`[contact ${contactId}] owner email sent:`, emailResult.value);
  } else {
    console.error(
      `[contact ${contactId}] owner email FAILED:`,
      emailResult.reason?.message,
    );
  }

  if (whatsAppResult.status === "fulfilled") {
    console.log(`[contact ${contactId}] WhatsApp sent:`, whatsAppResult.value);
  } else {
    console.error(
      `[contact ${contactId}] WhatsApp FAILED:`,
      whatsAppResult.reason?.message,
    );
  }

  if (clientReplyEnabled) {
    if (clientReplyResult.status === "fulfilled") {
      console.log(
        `[contact ${contactId}] client auto-reply sent:`,
        clientReplyResult.value,
      );
    } else {
      console.error(
        `[contact ${contactId}] client auto-reply FAILED:`,
        clientReplyResult.reason?.message,
      );
    }
  }

  return {
    emailSent: emailResult.status === "fulfilled",
    whatsappSent: whatsAppResult.status === "fulfilled",
  };
};

// ─── Test Endpoint ─────────────────────────────────────────────────────────────
export const testNotifications = asyncHandler(async (req, res) => {
  const user = process.env.GMAIL_USER?.trim() || "sanaarman033@gmail.com";
  const owner = process.env.OWNER_EMAIL?.trim() || user;
  const sample = {
    fullName: "Portfolio delivery test",
    yourEmail: owner,
    phoneNumber: "Not provided",
    budget: "Not provided",
    message: "This is a test notification from the portfolio backend.",
  };
  const [emailResult, whatsAppResult] = await Promise.allSettled([
    sendEmail({
      from: `"Portfolio Test" <${user}>`,
      to: owner,
      subject: "Portfolio notification test",
      text: "Email delivery from your portfolio backend is working.",
    }),
    sendWhatsAppNotification(sample, getWhatsAppConfig()),
  ]);

  const channels = {
    email:
      emailResult.status === "fulfilled"
        ? { sent: true, id: emailResult.value }
        : {
            sent: false,
            error: emailResult.reason?.message || "Email delivery failed",
          },
    whatsapp:
      whatsAppResult.status === "fulfilled"
        ? { sent: true, id: whatsAppResult.value }
        : {
            sent: false,
            error: whatsAppResult.reason?.message || "WhatsApp delivery failed",
          },
  };
  const success = channels.email.sent && channels.whatsapp.sent;
  res.status(success ? 200 : 502).json({
    success,
    message: success
      ? "Test notifications sent."
      : "One or more notification channels failed.",
    channels,
  });
});

// @desc    Save a contact form, then attempt email + WhatsApp notifications
// @route   POST /api/contact
// @access  Public
export const submitContact = asyncHandler(async (req, res) => {
  const fullName = req.body.fullName || req.body.name;
  const yourEmail = req.body.yourEmail || req.body.email;
  const phoneNumber = (req.body.phoneNumber || req.body.phone || "")
    .toString()
    .trim();
  const budget = (req.body.budget || "").toString().trim();
  const message = req.body.message;

  // ── Validation ────────────────────────────────────────────────────────────
  if (
    typeof fullName !== "string" ||
    !fullName.trim() ||
    typeof yourEmail !== "string" ||
    !yourEmail.trim() ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    res.status(400);
    throw new Error("Full name, email, and message are required");
  }

  const normalizedName = fullName.trim().replace(/\s+/g, " ");
  const normalizedEmail = yourEmail.trim();
  const normalizedMessage = message.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  // ── Save to MongoDB (fast) ────────────────────────────────────────────────
  const contact = await Contact.create({
    fullName: normalizedName,
    yourEmail: normalizedEmail,
    phoneNumber,
    budget,
    message: normalizedMessage,
  });

  // Attempt notifications with a fast 3.5s race timeout so client response is always fast
  let notifications = { emailSent: false, whatsappSent: false };
  try {
    notifications = await Promise.race([
      deliverNotifications({
        contactId: contact._id,
        name: normalizedName,
        email: normalizedEmail,
        phone: phoneNumber,
        budget,
        message: normalizedMessage,
      }),
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ emailSent: false, whatsappSent: false, delayed: true }),
          3500
        )
      ),
    ]);
  } catch (deliveryErr) {
    console.error("Background notification error:", deliveryErr?.message || deliveryErr);
  }

  res.status(201).json({
    success: true,
    message: "Your message has been received. I will get back to you soon!",
    data: { id: contact._id },
    notifications,
  });
});

// @desc    Get all contact messages (admin only)
// @route   GET /api/contact
// @access  Private
export const getContacts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 20);
  const skip = (pageNum - 1) * limitNum;

  const [data, totalCount] = await Promise.all([
    Contact.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Contact.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data,
    page: pageNum,
    totalPages: Math.ceil(totalCount / limitNum) || 1,
    totalCount,
  });
});

// @desc    Mark message as read
// @route   PUT /api/contact/:id/read
// @access  Private
export const markAsRead = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { isRead: true },
    { new: true },
  );
  if (!contact) {
    res.status(404);
    throw new Error("Message not found");
  }
  res.status(200).json({ success: true, data: contact });
});

// @desc    Delete contact message
// @route   DELETE /api/contact/:id
// @access  Private
export const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndDelete(req.params.id);
  if (!contact) {
    res.status(404);
    throw new Error("Message not found");
  }
  res.status(200).json({ success: true, message: "Message deleted" });
});
