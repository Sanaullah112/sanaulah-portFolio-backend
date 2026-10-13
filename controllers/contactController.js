import asyncHandler from 'express-async-handler';
import nodemailer from 'nodemailer';
import Contact from '../models/Contact.js';

// ─── Nodemailer transporter ────────────────────────────────────────────────────
const createTransporter = () => {
  const user = process.env.GMAIL_USER || '';
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass,
    },
  });
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

// @desc    Submit contact form → save to DB + send emails
// @route   POST /api/contact
// @access  Public
export const submitContact = asyncHandler(async (req, res) => {
  console.log('📥 Incoming contact form submission:', req.body);

  // ✅ 1. Support both frontend naming conventions (name/fullName, email/yourEmail)
  const fullName = req.body.fullName || req.body.name;
  const yourEmail = req.body.yourEmail || req.body.email;
  const phoneNumber = req.body.phoneNumber || req.body.phone || '';
  const budget = req.body.budget || '';
  const message = req.body.message;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!fullName || !yourEmail || !message) {
    res.status(400);
    throw new Error('Full name, email, and message are required');
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

  console.log('✅ Message saved to MongoDB with ID:', contact._id);

  // ── Send Emails ───────────────────────────────────────────────────────────
  const transporter = createTransporter();
  const senderUser = process.env.GMAIL_USER;
  const ownerTarget = process.env.OWNER_EMAIL || senderUser;

  // 1. Email to Owner (You)
  const ownerMailOptions = {
    from: `"Portfolio Contact" <${senderUser}>`,
    to: ownerTarget,
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

  // 2. Auto-reply to Client
  const clientMailOptions = {
    from: `"Sana Arman" <${senderUser}>`,
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

  // Send owner notification
  try {
    const ownerRes = await transporter.sendMail(ownerMailOptions);
    console.log('✅ Owner email delivered successfully:', ownerRes.messageId);
  } catch (err) {
    console.error('❌ Failed to send owner email:', err.message);
  }

  // Send client confirmation auto-reply (only if not sending to self)
  if (yourEmail.toLowerCase() !== senderUser.toLowerCase()) {
    try {
      const clientRes = await transporter.sendMail(clientMailOptions);
      console.log('✅ Client auto-reply delivered successfully:', clientRes.messageId);
    } catch (err) {
      console.error('❌ Failed to send client auto-reply:', err.message);
    }
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