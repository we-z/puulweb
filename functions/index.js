const functions = require("firebase-functions");
const axios = require("axios");

// It's recommended to store your API key in Firebase environment variables for security
// To set this variable, run the following command in your terminal:
// firebase functions:config:set gemini.key="YOUR_API_KEY"
// Deployment trigger: 1
const GEMINI_API_KEY = functions.config().gemini.key;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Define the tools the AI can use
const tools = [{
    "functionDeclarations": [
        {
            "name": "navigateToPage",
            "description": "Navigates the user to a specific page in the application.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "pageName": {
                        "type": "STRING",
                        "description": "The name of the page to navigate to. Must be one of: dashboard, calendar, leasing, properties, people, accounting, maintenance, reporting, communication, settings."
                    }
                },
                "required": ["pageName"]
            }
        },
        {
            "name": "filterTable",
            "description": "Applies a filter to the data table currently visible on the page.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                     "page": {
                        "type": "STRING",
                        "description": "The page the user is currently on, to identify the correct table. E.g., 'maintenance', 'leasing'."
                    },
                    "filterBy": {
                        "type": "STRING",
                        "description": "The field or category to filter by (e.g., 'status', 'priority')."
                    },
                    "value": {
                        "type": "STRING",
                        "description": "The specific value to filter for (e.g., 'Open', 'High', 'Active')."
                    }
                },
                "required": ["page", "filterBy", "value"]
            }
        },
        {
            "name": "openAddItemModal",
            "description": "Opens the modal window used to add a new item on the current page.",
            "parameters": {
                 "type": "OBJECT",
                "properties": {
                    "itemType": {
                        "type": "STRING",
                        "description": "The type of item to add, which corresponds to the subsection on a page. E.g., 'workOrders', 'tenants', 'leases', 'properties'."
                    }
                },
                "required": ["itemType"]
            }
        }
    ]
}];

exports.generateGeminiResponse = functions.https.onCall(async (data, context) => {
    // Ensure the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const conversationHistory = data.history;
    if (!conversationHistory || !Array.isArray(conversationHistory)) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "history" array.');
    }

    try {
        const response = await axios.post(API_URL, {
            "contents": conversationHistory,
            "tools": tools,
            "generationConfig": {
                "temperature": 0.7,
                "topK": 1,
                "topP": 1,
                "maxOutputTokens": 2048,
                "stopSequences": []
            },
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data.promptFeedback && response.data.promptFeedback.blockReason) {
             throw new functions.https.HttpsError('internal', `Request was blocked due to: ${response.data.promptFeedback.blockReason}`);
        }
        if (!response.data.candidates || response.data.candidates.length === 0) {
            throw new functions.https.HttpsError('internal', "No response from AI agent.");
        }
        
        const candidate = response.data.candidates[0];
        const content = candidate.content;

        // Check if the model wants to call a function
        if (content.parts[0].functionCall) {
            return { functionCall: content.parts[0].functionCall };
        }
        
        // Otherwise, return the text response
        const agentResponse = content.parts[0].text;
        return { response: agentResponse };

    } catch (error) {
        console.error("Error calling Gemini API:", error.response ? error.response.data : error.message);
        if (error.isAxiosError) {
             throw new functions.https.HttpsError('internal', 'Failed to call the Gemini API.', error.response ? error.response.data : null);
        }
        throw error; // re-throw other types of errors
    }
}); 