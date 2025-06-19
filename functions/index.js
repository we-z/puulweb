const functions = require("firebase-functions");
const axios = require("axios");

// It's recommended to store your API key in Firebase environment variables for security
// To set this variable, run the following command in your terminal:
// firebase functions:config:set gemini.key="YOUR_API_KEY"
// Deployment trigger: 1
const GEMINI_API_KEY = functions.config().gemini.key;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

exports.generateGeminiResponse = functions.https.onCall(async (data, context) => {
    // Ensure the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userQuery = data.query;
    if (!userQuery) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with one argument "query".');
    }
    
    const system_prompt = `You are an AI assistant for a property management platform called Puul. Your name is 'Puul-E'. You can help users with tasks related to leasing, accounting, maintenance, and more. Be concise and helpful. When asked to perform an action, respond with what you will do and why. Do not use markdown in your response.`;

    try {
        const response = await axios.post(API_URL, {
            "contents": [
                { "role": "user", "parts": [{ "text": system_prompt }] },
                { "role": "model", "parts": [{ "text": "Understood. I am Puul-E, your property management assistant. How can I help?" }] },
                { "role": "user", "parts": [{ "text": userQuery }] }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 1,
                "topP": 1,
                "maxOutputTokens": 2048,
                "stopSequences": []
            },
        }, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.data.promptFeedback && response.data.promptFeedback.blockReason) {
             throw new functions.https.HttpsError('internal', `Request was blocked due to: ${response.data.promptFeedback.blockReason}`);
        }
        if (!response.data.candidates || response.data.candidates.length === 0) {
            throw new functions.https.HttpsError('internal', "No response from AI agent.");
        }
        
        const agentResponse = response.data.candidates[0].content.parts[0].text;
        return { response: agentResponse };

    } catch (error) {
        console.error("Error calling Gemini API:", error.response ? error.response.data : error.message);
        if (error.isAxiosError) {
             throw new functions.https.HttpsError('internal', 'Failed to call the Gemini API.', error.response ? error.response.data : null);
        }
        throw error; // re-throw other types of errors
    }
}); 