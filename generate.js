const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Input validation
function validateInput(body) {
  const { guestInfo, guestName, podcastTopic } = body;
  
  if (!guestInfo || typeof guestInfo !== 'string') {
    return 'Guest information is required.';
  }
  if (guestInfo.trim().length < 50) {
    return 'Please provide at least 50 characters of guest information for meaningful results.';
  }
  if (guestInfo.length > 15000) {
    return 'Guest information exceeds the maximum length of 15,000 characters.';
  }
  if (guestName && typeof guestName !== 'string') {
    return 'Guest name must be a string.';
  }
  if (guestName && guestName.length > 200) {
    return 'Guest name is too long.';
  }
  if (podcastTopic && typeof podcastTopic !== 'string') {
    return 'Podcast topic must be a string.';
  }
  if (podcastTopic && podcastTopic.length > 500) {
    return 'Podcast topic is too long.';
  }
  return null;
}

function sanitizeInput(str) {
  if (!str) return '';
  return str.replace(/[<>]/g, '').trim();
}

router.post('/', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'AI service not configured. Please contact support.' });
    }

    const validationError = validateInput(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Check subscription status from request header/session
    const subscriptionToken = req.headers['x-subscription-token'];
    if (!subscriptionToken) {
      return res.status(402).json({ error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' });
    }

    // Verify subscription token
    const isValid = verifySubscriptionToken(subscriptionToken);
    if (!isValid) {
      return res.status(402).json({ error: 'Invalid or expired subscription', code: 'SUBSCRIPTION_INVALID' });
    }

    const guestInfo = sanitizeInput(req.body.guestInfo);
    const guestName = sanitizeInput(req.body.guestName);
    const podcastTopic = sanitizeInput(req.body.podcastTopic);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const contextSection = [
      guestName ? `Guest Name: ${guestName}` : '',
      podcastTopic ? `Podcast Topic/Focus: ${podcastTopic}` : '',
      `Guest Information:\n${guestInfo}`
    ].filter(Boolean).join('\n\n');

    const prompt = `You are an expert podcast producer and interviewer with 20+ years of experience helping hosts craft compelling, insightful conversations. Analyze the following guest information and generate a complete, production-ready interview preparation package.

${contextSection}

Generate the complete interview prep package in the following exact JSON format. Be specific, insightful, and tailored to this specific guest. Do not use generic advice. Every item must be relevant to this particular guest.

Return ONLY valid JSON with no markdown, no code fences, no extra text. Use this exact structure:

{
  "executiveSummary": {
    "headline": "One compelling sentence describing who this guest is and why they matter",
    "overview": "3-4 paragraph executive summary covering who they are, what makes them unique, their key achievements, and why your audience will find them fascinating",
    "keyStats": ["Specific achievement or stat 1", "Specific achievement or stat 2", "Specific achievement or stat 3", "Specific achievement or stat 4"]
  },
  "backgroundInfo": {
    "careerJourney": "Detailed career narrative highlighting pivotal moments and transitions",
    "expertise": ["Area of deep expertise 1", "Area of deep expertise 2", "Area of deep expertise 3", "Area of deep expertise 4", "Area of deep expertise 5"],
    "notableAchievements": ["Notable achievement 1", "Notable achievement 2", "Notable achievement 3", "Notable achievement 4"],
    "currentFocus": "What they are working on right now and why it matters",
    "controversiesOrChallenges": "Any public controversies, pivots, or challenges they have faced that could make for interesting conversation (write 'None identified' if none)",
    "personalDetails": "Any relevant personal details, hobbies, or background that humanizes them and could build rapport"
  },
  "discussionTopics": [
    {
      "topic": "Topic title",
      "why": "Why this topic will resonate with your audience",
      "angle": "Specific angle to take"
    },
    {
      "topic": "Topic title",
      "why": "Why this topic will resonate with your audience",
      "angle": "Specific angle to take"
    },
    {
      "topic": "Topic title",
      "why": "Why this topic will resonate with your audience",
      "angle": "Specific angle to take"
    },
    {
      "topic": "Topic title",
      "why": "Why this topic will resonate with your audience",
      "angle": "Specific angle to take"
    },
    {
      "topic": "Topic title",
      "why": "Why this topic will resonate with your audience",
      "angle": "Specific angle to take"
    }
  ],
  "interviewQuestions": [
    "Specific, personalized interview question 1 that references something from their background",
    "Specific, personalized interview question 2",
    "Specific, personalized interview question 3",
    "Specific, personalized interview question 4",
    "Specific, personalized interview question 5",
    "Specific, personalized interview question 6",
    "Specific, personalized interview question 7",
    "Specific, personalized interview question 8",
    "Specific, personalized interview question 9",
    "Specific, personalized interview question 10",
    "Specific, personalized interview question 11",
    "Specific, personalized interview question 12",
    "Specific, personalized interview question 13",
    "Specific, personalized interview question 14",
    "Specific, personalized interview question 15"
  ],
  "followUpQuestions": [
    "Deep follow-up question 1 that digs beneath the surface",
    "Deep follow-up question 2",
    "Deep follow-up question 3",
    "Deep follow-up question 4",
    "Deep follow-up question 5",
    "Deep follow-up question 6",
    "Deep follow-up question 7",
    "Deep follow-up question 8",
    "Deep follow-up question 9",
    "Deep follow-up question 10"
  ],
  "icebreakers": [
    "Warm, conversational icebreaker question 1 that feels natural",
    "Warm, conversational icebreaker question 2",
    "Warm, conversational icebreaker question 3",
    "Warm, conversational icebreaker question 4",
    "Warm, conversational icebreaker question 5"
  ],
  "contrarianQuestions": [
    "Respectfully challenging question 1 that challenges a belief or assumption this guest likely holds",
    "Respectfully challenging question 2",
    "Respectfully challenging question 3",
    "Respectfully challenging question 4",
    "Respectfully challenging question 5"
  ],
  "uniqueAngles": [
    {
      "angle": "Unique angle title",
      "description": "Why most hosts miss this and how to approach it"
    },
    {
      "angle": "Unique angle title",
      "description": "Why most hosts miss this and how to approach it"
    },
    {
      "angle": "Unique angle title",
      "description": "Why most hosts miss this and how to approach it"
    },
    {
      "angle": "Unique angle title",
      "description": "Why most hosts miss this and how to approach it"
    },
    {
      "angle": "Unique angle title",
      "description": "Why most hosts miss this and how to approach it"
    }
  ],
  "episodeStructure": {
    "coldOpen": "Compelling hook for the first 60 seconds to grab listener attention",
    "intro": "How to introduce this guest in 30-45 seconds",
    "actOne": {
      "title": "Act 1 title (typically origin/background)",
      "duration": "Suggested time range",
      "focus": "What to cover and why",
      "keyQuestions": ["Question to anchor this section", "Another key question"]
    },
    "actTwo": {
      "title": "Act 2 title (typically expertise/current work)",
      "duration": "Suggested time range",
      "focus": "What to cover and why",
      "keyQuestions": ["Question to anchor this section", "Another key question"]
    },
    "actThree": {
      "title": "Act 3 title (typically future/advice/legacy)",
      "duration": "Suggested time range",
      "focus": "What to cover and why",
      "keyQuestions": ["Question to anchor this section", "Another key question"]
    },
    "closingSegment": "How to wrap up the interview and what final question to ask",
    "signOff": "Suggested call to action and where to direct listeners"
  },
  "keyTakeaways": [
    "Specific, concrete takeaway listeners will walk away with 1",
    "Specific, concrete takeaway 2",
    "Specific, concrete takeaway 3",
    "Specific, concrete takeaway 4",
    "Specific, concrete takeaway 5",
    "Specific, concrete takeaway 6",
    "Specific, concrete takeaway 7",
    "Specific, concrete takeaway 8",
    "Specific, concrete takeaway 9",
    "Specific, concrete takeaway 10"
  ],
  "episodeTitles": [
    "Compelling episode title 1 optimized for search and clicks",
    "Compelling episode title 2",
    "Compelling episode title 3",
    "Compelling episode title 4",
    "Compelling episode title 5",
    "Compelling episode title 6",
    "Compelling episode title 7",
    "Compelling episode title 8",
    "Compelling episode title 9",
    "Compelling episode title 10"
  ],
  "socialMediaAngles": [
    {
      "platform": "Twitter/X",
      "angle": "Specific shareable angle or hook",
      "samplePost": "Ready-to-post tweet or thread starter (under 280 characters)"
    },
    {
      "platform": "LinkedIn",
      "angle": "Professional insight angle",
      "samplePost": "LinkedIn post hook (2-3 sentences)"
    },
    {
      "platform": "Instagram",
      "angle": "Visual or quote angle",
      "samplePost": "Instagram caption concept with hashtag suggestions"
    },
    {
      "platform": "Short-form video (Reels/TikTok/Shorts)",
      "angle": "Most compelling 60-second clip moment",
      "samplePost": "Description of which part of the interview to clip and why"
    },
    {
      "platform": "Email Newsletter",
      "angle": "Subject line and preview text angle",
      "samplePost": "Email subject line + preview text that drives opens"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean and parse JSON
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7);
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    let parsedData;
    try {
      parsedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    res.json({ success: true, data: parsedData });

  } catch (error) {
    console.error('Generate error:', error.message);
    
    if (error.message && error.message.includes('API_KEY')) {
      return res.status(500).json({ error: 'AI service configuration error. Please contact support.' });
    }
    if (error.message && error.message.includes('quota')) {
      return res.status(429).json({ error: 'AI service quota exceeded. Please try again later.' });
    }
    if (error.message && error.message.includes('SAFETY')) {
      return res.status(400).json({ error: 'Content was flagged by safety filters. Please review your input and try again.' });
    }
    
    res.status(500).json({ error: 'Failed to generate interview prep. Please try again.' });
  }
});

// Simple in-memory subscription verification
// In production, replace with database lookup
function verifySubscriptionToken(token) {
  if (!token || token.length < 10) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [prefix, email, timestamp] = parts;
    if (prefix !== 'PPAI') return false;
    const tokenAge = Date.now() - parseInt(timestamp);
    // Token valid for 35 days
    if (tokenAge > 35 * 24 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = router;
