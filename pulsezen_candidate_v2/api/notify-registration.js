export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { center_name, owner_name, whatsapp, city, pincode, locality, tier } = req.body || {};

  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const OWNER_EMAIL = process.env.OWNER_EMAIL;

  if (!RESEND_KEY || !OWNER_EMAIL) {
    console.error('Missing RESEND_API_KEY or OWNER_EMAIL env var');
    return res.status(200).json({ ok: false, reason: 'env not configured' });
  }

  const subject = `New PulseZen Registration: ${center_name || 'Unknown Center'}`;

  const html = `
    <h2 style="color:#1a3a28;font-family:sans-serif">New PulseZen Center Registration</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-weight:600">Center Name</td><td style="padding:8px 0">${center_name || '—'}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-weight:600">Owner Name</td><td style="padding:8px 0">${owner_name || '—'}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-weight:600">WhatsApp</td><td style="padding:8px 0">${whatsapp || '—'}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-weight:600">City</td><td style="padding:8px 0">${city || '—'}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-weight:600">Pincode</td><td style="padding:8px 0">${pincode || '—'}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-weight:600">Locality</td><td style="padding:8px 0">${locality || '—'}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;color:#6b7280;font-weight:600">Plan Chosen</td><td style="padding:8px 0"><strong>${tier || '—'}</strong></td></tr>
    </table>
    <p style="margin-top:24px">
      <a href="https://pulsezen.in/admin.html" style="background:#1a3a28;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-family:sans-serif">
        Open Admin Panel →
      </a>
    </p>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'PulseZen <noreply@pulsezen.in>',
        to: [OWNER_EMAIL],
        subject,
        html
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Resend error:', err);
      return res.status(200).json({ ok: false, reason: 'resend_error' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify-registration error:', e);
    return res.status(200).json({ ok: false, reason: 'exception' });
  }
}
