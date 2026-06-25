const express = require('express');
const router = express.Router();

const PAYPAL_API = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const PLAN_PRICE = '9.00';
const PLAN_CURRENCY = 'USD';

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`PayPal auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Create PayPal order for subscription payment
router.post('/create-order', async (req, res) => {
  try {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Payment service not configured. Please contact support.' });
    }

    const accessToken = await getPayPalAccessToken();

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: PLAN_CURRENCY,
            value: PLAN_PRICE
          },
          description: 'Podcast Prep AI - Monthly Subscription',
          custom_id: `subscription_${Date.now()}`
        }
      ],
      application_context: {
        brand_name: 'Podcast Prep AI',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${req.protocol}://${req.get('host')}/success`,
        cancel_url: `${req.protocol}://${req.get('host')}/?payment=cancelled`
      }
    };

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `order-${Date.now()}`
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('PayPal create order error:', err);
      return res.status(500).json({ error: 'Failed to create payment order. Please try again.' });
    }

    const order = await response.json();
    res.json({ id: order.id });

  } catch (error) {
    console.error('Create order error:', error.message);
    res.status(500).json({ error: 'Payment initialization failed. Please try again.' });
  }
});

// Capture PayPal order after approval
router.post('/capture-order', async (req, res) => {
  try {
    const { orderID, payerEmail } = req.body;
    
    if (!orderID || typeof orderID !== 'string' || orderID.length > 50) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('PayPal capture error:', err);
      return res.status(500).json({ error: 'Payment capture failed. Please contact support.' });
    }

    const captureData = await response.json();

    if (captureData.status === 'COMPLETED') {
      const payer = captureData.payer;
      const email = payerEmail || (payer && payer.email_address) || `user_${Date.now()}@paypal`;
      
      // Generate subscription token
      const subscriptionToken = generateSubscriptionToken(email);
      
      res.json({
        success: true,
        subscriptionToken,
        orderID: captureData.id,
        message: 'Payment successful! Your subscription is now active.'
      });
    } else {
      res.status(400).json({ error: 'Payment was not completed. Please try again.' });
    }

  } catch (error) {
    console.error('Capture order error:', error.message);
    res.status(500).json({ error: 'Payment processing failed. Please contact support.' });
  }
});

// Get PayPal client ID for frontend (safe to expose)
router.get('/config', (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID) {
    return res.status(500).json({ error: 'Payment not configured' });
  }
  res.json({ 
    clientId: process.env.PAYPAL_CLIENT_ID,
    currency: PLAN_CURRENCY,
    price: PLAN_PRICE
  });
});

function generateSubscriptionToken(email) {
  const timestamp = Date.now();
  const raw = `PPAI:${email}:${timestamp}`;
  return Buffer.from(raw).toString('base64');
}

module.exports = router;
