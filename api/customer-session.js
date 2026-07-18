import { signSession } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customer_id, contact, dob } = req.body || {};

  if (!customer_id || !contact) {
    return res.status(400).json({ error: 'customer_id and contact are required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://erteibdxzdvsaujptxsd.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing' });
  }

  try {
    // Look up customer using the Service Role Key
    const fetchUrl = `${supabaseUrl}/rest/v1/customers?id=eq.${customer_id}&select=id,contact,dob,wellness_center_id`;
    let sbRes = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sbRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch customer from database' });
    }

    let customers = await sbRes.json();
    
    // If not found in customers, it might be a coach logging in as a customer
    if (!customers || customers.length === 0) {
      const coachFetchUrl = `${supabaseUrl}/rest/v1/coaches?id=eq.${customer_id}&select=id,contact,dob,wellness_center_id`;
      sbRes = await fetch(coachFetchUrl, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (sbRes.ok) {
        customers = await sbRes.json();
      }
    }

    if (!customers || customers.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const customer = customers[0];

    const storedContact = (customer.contact || '').toString();
    const providedContact = contact.toString();
    
    if (storedContact !== providedContact && storedContact !== ('91' + providedContact) && ('91' + storedContact) !== providedContact) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify DOB if the customer record has one and the user provided it
    if (customer.dob && dob && customer.dob !== dob) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate signed token
    const payload = {
      customer_id: customer.id,
      center_id: customer.wellness_center_id,
      role: 'customer'
    };
    
    const token = signSession(payload, 28800); // 8 hours

    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
