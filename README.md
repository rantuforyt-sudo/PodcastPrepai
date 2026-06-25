# Podcast Prep AI

AI-powered interview preparation for podcast hosts, business coaches, and creators.

## Overview

Paste a guest bio, LinkedIn profile, website content, or any information about your guest and instantly receive a complete interview preparation package — 15 personalized questions, episode structure, title ideas, social media angles, and more.

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js + Express
- **AI**: Google Gemini 1.5 Flash
- **Payments**: PayPal
- **Deployment**: Vercel

---

## Quick Deploy (5 minutes)

### Step 1: Clone and prepare

```bash
git clone <your-repo-url>
cd podcast-prep-ai
npm install
```

### Step 2: Get your API keys

**Google Gemini API Key:**
1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Copy the key

**PayPal Credentials:**
1. Go to https://developer.paypal.com/dashboard/
2. Create a new app under "My Apps & Credentials"
3. Switch to **Live** mode (not Sandbox) for production
4. Copy your Client ID and Client Secret
5. Get your PayPal Business account email

### Step 3: Deploy to Vercel

1. Push your code to GitHub
2. Go to https://vercel.com and import your GitHub repo
3. Add the following environment variables in Vercel settings:

```
GEMINI_API_KEY=your_gemini_api_key
PAYPAL_CLIENT_ID=your_paypal_live_client_id
PAYPAL_CLIENT_SECRET=your_paypal_live_client_secret
PAYPAL_RECEIVER_EMAIL=your_paypal_business_email
NODE_ENV=production
```

4. Deploy

### Step 4: Configure PayPal for production

In your PayPal Developer Dashboard:
1. Set your return URL to `https://your-domain.vercel.app/success`
2. Set your cancel URL to `https://your-domain.vercel.app/?payment=cancelled`
3. Ensure your business account is verified

---

## Local Development

```bash
# Copy environment file
cp .env.example .env

# Add your API keys to .env
nano .env

# Start development server
npm run dev

# Visit http://localhost:3000
```

---

## Project Structure

```
podcast-prep-ai/
├── server.js              # Express server + middleware
├── routes/
│   ├── generate.js        # Gemini AI generation route
│   ├── payment.js         # PayPal payment routes
│   └── subscription.js    # Subscription verification
├── public/
│   ├── index.html         # Landing page + app
│   ├── css/
│   │   └── style.css      # Styles
│   └── js/
│       └── app.js         # Frontend application
├── vercel.json            # Vercel configuration
├── package.json
├── .env.example
└── .gitignore
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `PAYPAL_CLIENT_ID` | Yes | PayPal app client ID |
| `PAYPAL_CLIENT_SECRET` | Yes | PayPal app client secret |
| `PAYPAL_RECEIVER_EMAIL` | Yes | Your PayPal business email |
| `NODE_ENV` | No | Set to `production` on Vercel |
| `PORT` | No | Server port (default: 3000) |

---

## Payment Flow

1. User clicks any CTA button
2. PayPal SDK loads with your client ID
3. User completes payment via PayPal buttons
4. Server captures the payment via PayPal API
5. Server generates a subscription token (valid 35 days)
6. Token stored in `localStorage`
7. Token sent as `x-subscription-token` header with AI requests
8. Server verifies token before processing AI requests

---

## Switching to PayPal Sandbox (Testing)

In `routes/payment.js`, the `PAYPAL_API` variable automatically switches between sandbox and production based on `NODE_ENV`:

```javascript
const PAYPAL_API = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';
```

For local testing:
1. Set `NODE_ENV=development` in `.env`
2. Use your PayPal Sandbox credentials in `.env`
3. The payment routes will use the Sandbox API

---

## Security Features

- API keys never exposed to client
- Server-side AI and payment calls only
- Rate limiting: 100 requests/15min globally, 20 AI requests/hour per IP
- Helmet.js for security headers
- Input validation and sanitization
- CORS restricted in production
- Subscription token verification on every AI request

---

## Customization

**Change the price**: Edit `PLAN_PRICE` in `routes/payment.js`

**Change AI model**: Edit the model name in `routes/generate.js`

**Extend subscription duration**: Change the `35 * 24 * 60 * 60 * 1000` value in `routes/generate.js` and `routes/subscription.js`

**Add a database**: Replace the `verifySubscriptionToken` function in `routes/generate.js` with a database lookup for persistent subscription tracking

---

## Support

For deployment issues, check:
1. Vercel function logs in your Vercel dashboard
2. Environment variables are all set correctly
3. PayPal app is in Live mode (not Sandbox) for production
4. Gemini API key has quota available

---

## License

MIT
