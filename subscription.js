const express = require('express');
const router = express.Router();

// Verify subscription token validity
router.post('/verify', (req, res) => {
  const { token } = req.body;
  
  if (!token || typeof token !== 'string') {
    return res.json({ valid: false });
  }

  const isValid = verifyToken(token);
  res.json({ valid: isValid });
});

// Check subscription status
router.get('/status', (req, res) => {
  const token = req.headers['x-subscription-token'];
  
  if (!token) {
    return res.json({ subscribed: false });
  }

  const isValid = verifyToken(token);
  
  if (!isValid) {
    return res.json({ subscribed: false, reason: 'expired' });
  }

  // Decode token to get expiry info
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    const timestamp = parseInt(parts[2]);
    const expiresAt = new Date(timestamp + 35 * 24 * 60 * 60 * 1000);
    
    res.json({ 
      subscribed: true,
      expiresAt: expiresAt.toISOString()
    });
  } catch {
    res.json({ subscribed: false });
  }
});

function verifyToken(token) {
  if (!token || token.length < 10) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [prefix, email, timestamp] = parts;
    if (prefix !== 'PPAI') return false;
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 35 * 24 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = router;
