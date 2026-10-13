import asyncHandler from 'express-async-handler';
import nodemailer from 'nodemailer';
import Contact from '../models/Contact.js';

// ─── Nodemailer transporter ────────────────────────────────────────────────────
// Uses Gmail App Password (not your normal password).
// How to get one:
//   Google Account → Security → 2-Step Verification (must be ON)
//   → App passwords → generate one → paste in .env as GMAIL_APP_PASSWORD
const createTransporter = () =>
  nodemailer.createTransport({
    // ✅ FIX: Explicit host/port/secure works reliably on Render & Vercel
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      // ✅ FIX: Strip any whitespace that may sneak in from env vars
      pass: process.env.GMAIL_APP_PASSWORD
        ? process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '')
        : '',
    },
  });

// @desc    Submit contact form → save to DB + send email to owner
// @route   POST /api/contact
// @access  Public
export const submitContact = asyncHandler(async (req, res) => {
  const { fullName, yourEmail, phoneNumber, budget, message } = req.body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!fullName || !yourEmail || !message) {
    res.status(400);
    throw new Error('Full name, email and message are required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(yourEmail)) {
    res.status(400);
    throw new Error('Please provide a valid email address');
  }

  // ── Save to MongoDB ───────────────────────────────────────────────────────
  const contact = await Contact.create({
    fullName,
    yourEmail,
    phoneNumber,
    budget,
    message,
  });

  // ── Send email to owner ───────────────────────────────────────────────────
  const transporter = createTransporter();

  const ownerMailOptions = {
    from: `"Portfolio Contact" <${process.env.GMAIL_USER}>`,
    to: process.env.OWNER_EMAIL,  // sanaarman033@gmail.com (set in .env)
    replyTo: yourEmail,
    subject: `📩 New Contact from ${fullName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
        <div style="background:#FD853A;padding:24px 32px;">
          <h2 style="color:#fff;margin:0;font-size:22px;">New Portfolio Inquiry</h2>
        </div>
        <div style="padding:32px;background:#fff;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;color:#959595;font-size:13px;width:130px;">Full Name</td>
              <td style="padding:10px 0;color:#0D0D0D;font-weight:600;">${fullName}</td>
            </tr>
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;">Email</td>
              <td style="padding:10px 0;color:#0D0D0D;font-weight:600;">${yourEmail}</td>
            </tr>
            ${phoneNumber ? `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;">Phone</td>
              <td style="padding:10px 0;color:#0D0D0D;font-weight:600;">${phoneNumber}</td>
            </tr>` : ''}
            ${budget ? `
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;">Budget</td>
              <td style="padding:10px 0;color:#FD853A;font-weight:600;">${budget}</td>
            </tr>` : ''}
            <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#959595;font-size:13px;vertical-align:top;">Message</td>
              <td style="padding:10px 0;color:#0D0D0D;line-height:1.7;">${message.replace(/\n/g, '<br>')}</td>
            </tr>
          </table>
        </div>
        <div style="padding:16px 32px;background:#f9f9f9;text-align:center;font-size:12px;color:#bbb;">
          Sent from your portfolio website • ${new Date().toLocaleString()}
        </div>
      </div>
    `,
  };

  // Auto-reply to the client
  const clientMailOptions = {
    from: `"Sana Arman" <${process.env.GMAIL_USER}>`,
    to: yourEmail,
    subject: `✅ Got your message, ${fullName}!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e5e5;overflow:hidden;">
        <div style="background:#FD853A;padding:24px 32px;">
          <h2 style="color:#fff;margin:0;">Thanks for reaching out!</h2>
        </div>
        <div style="padding:32px;">
          <p style="color:#0D0D0D;font-size:16px;line-height:1.7;">
            Hi <strong>${fullName}</strong>,<br><br>
            I've received your message and will get back to you as soon as possible — usually within 24 hours.
          </p>
          <div style="background:#FFF8F4;border-left:4px solid #FD853A;padding:16px 20px;border-radius:6px;margin:24px 0;">
            <p style="margin:0;color:#555;font-size:14px;line-height:1.6;"><em>"${message}"</em></p>
          </div>
          <p style="color:#959595;font-size:14px;">Talk soon,<br><strong style="color:#0D0D0D;">Sana Arman</strong></p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(ownerMailOptions);
    await transporter.sendMail(clientMailOptions);
  } catch (emailErr) {
    // Email failure should not block the API response — message is already saved in DB
    console.error('Nodemailer error:', emailErr.message);
  }

  res.status(200).json({
    success: true,
    message: 'Your message has been sent successfully!',
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