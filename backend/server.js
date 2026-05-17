require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

function createTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.post('/api/contact', async (req, res) => {
  const { name, whatsapp, company, message } = req.body || {};

  if (!name?.trim()) {
    return res.status(400).json({ ok: false, error: 'Name is required.' });
  }
  const whatsappDigits = (whatsapp || '').replace(/\D/g, '');
  if (!whatsapp?.trim() || whatsappDigits.length < 10 || whatsappDigits.length > 15) {
    return res.status(400).json({ ok: false, error: 'A valid WhatsApp number is required.' });
  }
  if (!message?.trim()) {
    return res.status(400).json({ ok: false, error: 'Project brief is required.' });
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env');
    return res.status(503).json({
      ok: false,
      error: 'Email is not configured on the server. Add your Gmail App Password to backend/.env',
    });
  }

  const to = process.env.NOTIFY_EMAIL || process.env.GMAIL_USER;
  const companyLine = company?.trim()
    ? `<tr><td style="padding:8px 12px;color:#8A95A8;">Company</td><td style="padding:8px 12px;">${escapeHtml(company.trim())}</td></tr>`
    : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;">
      <h2 style="color:#0B1628;border-bottom:2px solid #C9A84C;padding-bottom:8px;">New DigitalDoor inquiry</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tr><td style="padding:8px 12px;color:#8A95A8;width:120px;">Name</td><td style="padding:8px 12px;"><strong>${escapeHtml(name.trim())}</strong></td></tr>
        <tr><td style="padding:8px 12px;color:#8A95A8;">WhatsApp</td><td style="padding:8px 12px;"><a href="https://wa.me/${whatsappDigits}">${escapeHtml(whatsapp.trim())}</a></td></tr>
        ${companyLine}
        <tr><td style="padding:8px 12px;color:#8A95A8;vertical-align:top;">Message</td><td style="padding:8px 12px;white-space:pre-wrap;">${escapeHtml(message.trim())}</td></tr>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#8A95A8;">Sent from DigitalDoor contact form</p>
    </div>
  `;

  const plainText = [
    'New DigitalDoor inquiry',
    '',
    `Name: ${name.trim()}`,
    `WhatsApp: ${whatsapp.trim()}`,
    company?.trim() ? `Company: ${company.trim()}` : null,
    '',
    'Message:',
    message.trim(),
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await transporter.sendMail({
      from: `"DigitalDoor Website" <${process.env.GMAIL_USER}>`,
      to,
      subject: `New inquiry from ${name.trim()} — DigitalDoor`,
      text: plainText,
      html,
    });

    return res.json({ ok: true, message: 'Inquiry sent successfully.' });
  } catch (err) {
    console.error('Email send failed:', err.message);
    return res.status(500).json({
      ok: false,
      error: 'Could not send email. Check Gmail App Password in backend/.env',
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    emailConfigured: !!(
      process.env.GMAIL_USER?.trim() &&
      process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
    ),
  });
});

app.listen(PORT, () => {
  console.log(`DigitalDoor server: http://localhost:${PORT}`);
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn('Add Gmail App Password to backend/.env (see .env.example)');
  }
});
