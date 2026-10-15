import asyncHandler from 'express-async-handler';
import nodemailer from 'nodemailer';
import Contact from '../models/Contact.js';

// ─── Nodemailer transporter ────────────────────────────────────────────────────
const createTransporter = () => {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass,
    },
  });
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getWhatsAppConfig = () => ({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim(),
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  templateName: process.env.WHATSAPP_TEMPLATE_NAME?.trim(),
  templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim(),
  recipient: (process.env.WHATSAPP_RECIPIENT_PHONE || '923099369195').replace(/\D/g, ''),
  apiVersion: process.env.WHATSAPP_GRAPH_API_VERSION?.trim(),
});

const sendWhatsAppNotification = async (
  { fullName, yourEmail, phoneNumber, budget, message },
  config
) => {
  const { accessToken, phoneNumberId, templateName, templateLanguage, recipient, apiVersion } = config;
  if (!accessToken || !phoneNumberId || !templateName || !templateLanguage || !recipient || !apiVersion) {
    throw new Error('WhatsApp Cloud API is not fully configured');
  }

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: fullName },
              { type: 'text', text: yourEmail },
              { type: 'text', text: phoneNumber || 'Not provided' },
              { type: 'text', text: budget || 'Not provided' },
              { type: 'text', text: message },
            ],
          }],
        },
      }),
      signal: AbortSignal.timeout(10000),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || `WhatsApp API returned status ${response.status}`);
  }
  return result.messages?.[0]?.id;
};

// ─── Test Endpoint ─────────────────────────────────────────────────────────────
export const testEmail = asyncHandler(async (req, res) => {
  const user = process.env.GMAIL_USER || '';
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const owner = process.env.OWNER_EMAIL || '';

  try {
    const transporter = createTransporter();
    await transporter.verify();

    const result = await transporter.sendMail({
      from: `"Test" <${user}>`,
      to: owner,
      subject: '🧪 Test Email from Render',
      text: 'If you see this, SMTP is working on Render!',
    });

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully! Check your inbox.',
      messageId: result.messageId,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// @desc    Save a contact form and send email + WhatsApp notifications
// @route   POST /api/contact
// @access  Public
export const submitContact = asyncHandler(async (req, res) => {
  const fullName = req.body.fullName || req.body.name;
  const yourEmail = req.body.yourEmail || req.body.email;
  const phoneNumber = req.body.phoneNumber || req.body.phone || '';
  const budget = req.body.budget || '';
  const message = req.body.message;

  // ── Validation ────────────────────────────────────────────────────────────
  if (
    typeof fullName !== 'string' || !fullName.trim() ||
    typeof yourEmail !== 'string' || !yourEmail.trim() ||
    typeof message !== 'string' || !message.trim()
  ) {
    res.status(400);
    throw new Error('Full name, email, and message are required');
  }

  const normalizedName = fullName.trim().replace(/\s+/g, ' ');
  const normalizedEmail = yourEmail.trim();
  const normalizedMessage = message.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    res.status(400);
    throw new Error('Please provide a valid email address');
  }

  const senderUser = process.env.GMAIL_USER?.trim();
  const senderPassword = process.env.GMAIL_APP_PASSWORD?.trim();
  const ownerTarget = process.env.OWNER_EMAIL?.trim() || senderUser;
  if (!senderUser || !senderPassword || !ownerTarget) {
    res.status(503);
    throw new Error('Email delivery is not configured on the server');
  }
  const whatsAppConfig = getWhatsAppConfig();
  const whatsAppConfigured = [
    whatsAppConfig.accessToken,
    whatsAppConfig.phoneNumberId,
    whatsAppConfig.templateName,
    whatsAppConfig.templateLanguage,
    whatsAppConfig.recipient,
    whatsAppConfig.apiVersion,
  ].every(Boolean);

  // ── Save to MongoDB ───────────────────────────────────────────────────────
  const contact = await Contact.create({
    fullName: normalizedName,
    yourEmail: normalizedEmail,
    phoneNumber,
    budget,
    message: normalizedMessage,
  });

  // ── Send Emails ───────────────────────────────────────────────────────────
  const transporter = createTransporter();
  const escapedName = escapeHtml(normalizedName);
  const escapedEmail = escapeHtml(normalizedEmail);
  const escapedPhone = escapeHtml(phoneNumber);
  const escapedBudget = escapeHtml(budget);
  const escapedMessage = escapeHtml(normalizedMessage).replace(/\n/g, '<br>');

  // 1. Email to Owner (You)
  const ownerMailOptions = {
    from: `"Portfolio Contact" <${senderUser}>`,
    to: ownerTarget,
    replyTo: normalizedEmail,
    subject: `New Portfolio Contact from ${normalizedName}`,
    text: `New portfolio inquiry\n\nName: ${normalizedName}\nEmail: ${normalizedEmail}\nPhone: ${phoneNumber || 'Not provided'}\nBudget: ${budget || 'Not provided'}\n\nMessage:\n${normalizedMessage}`,
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
            ${phoneNumber ? `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;">Phone</td>
              <td style="padding:10px 0;color:#0D0D0D;font-weight:600;">${escapedPhone}</td>
            </tr>` : ''}
            ${budget ? `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;">Budget</td>
              <td style="padding:10px 0;color:#FD853A;font-weight:600;">${escapedBudget}</td>
            </tr>` : ''}
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

  // 2. Auto-reply to Client
  const clientMailOptions = {
    from: `"Sana Arman" <${senderUser}>`,
    to: normalizedEmail,
    subject: `Got your message, ${normalizedName}!`,
    text: `Hi ${normalizedName},\n\nI've received your message and will get back to you as soon as possible — usually within 24 hours.\n\nYour message: "${normalizedMessage}"\n\nTalk soon,\nSana Arman`,
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

  const [emailResult, whatsAppResult] = await Promise.all([
    transporter.sendMail(ownerMailOptions).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason })
    ),
    whatsAppConfigured
      ? sendWhatsAppNotification(
          {
            fullName: normalizedName,
            yourEmail: normalizedEmail,
            phoneNumber,
            budget,
            message: normalizedMessage,
          },
          whatsAppConfig
        ).then(
          (value) => ({ status: 'fulfilled', value }),
          (reason) => ({ status: 'rejected', reason })
        )
      : Promise.resolve({ status: 'skipped', reason: 'WhatsApp Cloud API is not configured' }),
  ]);

  if (emailResult.status === 'rejected') {
    console.error('Failed to deliver portfolio contact email:', emailResult.reason?.message || emailResult.reason);
    res.status(502);
    throw new Error('Your message was saved, but the email notification could not be delivered. Please try again or contact me directly.');
  }

  if (whatsAppResult.status === 'rejected') {
    console.error('Failed to deliver portfolio WhatsApp notification:', whatsAppResult.reason?.message || whatsAppResult.reason);
  } else if (whatsAppResult.status === 'skipped') {
    console.warn('WhatsApp notification was skipped because Cloud API settings are missing');
  }

  console.log('Portfolio contact email delivered', {
    emailMessageId: emailResult.value.messageId,
    whatsappMessageId: whatsAppResult.status === 'fulfilled' ? whatsAppResult.value : undefined,
  });

  if (normalizedEmail.toLowerCase() !== senderUser.toLowerCase()) {
    try {
      const clientRes = await transporter.sendMail(clientMailOptions);
      console.log('Contact confirmation email delivered', { emailMessageId: clientRes.messageId });
    } catch (err) {
      console.error('Failed to send contact confirmation email:', err.message);
    }
  }

  res.status(200).json({
    success: true,
    message: whatsAppResult.status === 'fulfilled'
      ? 'Your message has been sent successfully!'
      : 'Your message was sent by email. WhatsApp notification is not available right now.',
    delivery: {
      email: 'sent',
      whatsapp: whatsAppResult.status === 'fulfilled'
        ? 'sent'
        : whatsAppResult.status === 'skipped' ? 'not_configured' : 'failed',
    },
    data: { id: contact._id },
  });
});

// @desc    Get all contact messages (admin only)
// @route   GET /api/contact
// @access  Private
export const getContacts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
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
    { new: true }
  );
  if (!contact) {
    res.status(404);
    throw new Error('Message not found');
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
    throw new Error('Message not found');
  }
  res.status(200).json({ success: true, message: 'Message deleted' });
});