const nodemailer = require('nodemailer');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass || pass === 'your_16_character_app_password') return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function handleContact(body) {
  const { name, whatsapp, company, message } = body || {};

  if (!name?.trim()) {
    return { status: 400, json: { ok: false, error: 'Name is required.' } };
  }

  const whatsappDigits = (whatsapp || '').replace(/\D/g, '');
  if (!whatsapp?.trim() || whatsappDigits.length < 10 || whatsappDigits.length > 15) {
    return { status: 400, json: { ok: false, error: 'A valid WhatsApp number is required.' } };
  }

  if (!message?.trim()) {
    return { status: 400, json: { ok: false, error: 'Project brief is required.' } };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return {
      status: 503,
      json: {
        ok: false,
        error: 'Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel → Settings → Environment Variables.',
      },
    };
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

    return { status: 200, json: { ok: true, message: 'Inquiry sent successfully.' } };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return {
      status: 500,
      json: {
        ok: false,
        error: 'Could not send email. Check Gmail App Password in Vercel environment variables.',
      },
    };
  }
}

module.exports = { handleContact };
