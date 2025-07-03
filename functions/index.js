const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { toolImplementations } = require("./tools");
let stripe;
try {
    stripe = require("stripe")(functions.config().stripe.secret);
} catch (e) {
    console.warn('Stripe config not found, Stripe functionality will be disabled.');
    stripe = {
        checkout: { sessions: { create: () => { throw new Error('Stripe not configured'); } } },
        webhooks: { constructEvent: () => { throw new Error('Stripe not configured'); } },
        subscriptions: { retrieve: () => { throw new Error('Stripe not configured'); }, list: () => ({ data: [] }) },
        customers: { retrieve: () => { throw new Error('Stripe not configured'); }, create: () => { throw new Error('Stripe not configured'); } },
        billingPortal: { sessions: { create: () => { throw new Error('Stripe not configured'); } } },
    };
}
const { getMockData } = require("./mock-data");

admin.initializeApp();

// It's recommended to store your API key in Firebase environment variables for security
// To set this variable, run the following command in your terminal:
// firebase functions:config:set gemini.key="YOUR_API_KEY"
// firebase functions:config:set stripe.secret="YOUR_STRIPE_SECRET_KEY"
// firebase functions:config:set stripe.webhook_secret="YOUR_STRIPE_WEBHOOK_SECRET"
// Deployment trigger: 2
let GEMINI_API_KEY;
try {
    GEMINI_API_KEY = functions.config().gemini.key;
} catch (e) {
    console.warn('Gemini API key not found, Gemini functionality will be disabled.');
    GEMINI_API_KEY = null;
}
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Define the tools the AI can use. We separate them into client-side and server-side.
const serverSideTools = [
    {
        "name": "getData",
        "description": "Retrieves a list of data records from the user's database, with optional filtering.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "dataType": {
                    "type": "STRING",
                    "description": "The type of data to retrieve. Must be one of the top-level keys in the database, e.g., 'properties', 'workOrders', 'tenants', 'leases', 'inspections'."
                },
                "filters": {
                    "type": "OBJECT",
                    "description": "An object of key-value pairs to filter the data. The key should be a field name and the value is what to filter by.",
                    "properties": {} // Define specific properties if you want to be more restrictive
                }
            },
            "required": ["dataType"]
        }
    },
    {
        "name": "updateData",
        "description": "Updates a specific data record in the user's database.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "dataType": {
                    "type": "STRING",
                    "description": "The type of data to update, e.g., 'workOrders', 'leases'."
                },
                "itemId": {
                    "type": "STRING",
                    "description": "The unique ID of the item to be updated."
                },
                "updates": {
                    "type": "OBJECT",
                    "description": "An object of key-value pairs representing the fields to update.",
                    "properties": {}
                }
            },
            "required": ["dataType", "itemId", "updates"]
        }
    }
];


const allTools = [{
    "functionDeclarations": [...serverSideTools]
}];

exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    console.log(`New user created: ${user.uid}. Populating with mock data.`);
    const { uid, email, displayName } = user;
    try {
        const mockData = getMockData(uid, email, displayName);
        const db = admin.database();
        const updates = {};
        for (const [key, value] of Object.entries(mockData)) {
            updates[`/${key}/${uid}`] = value;
        }
        await db.ref().update(updates);
        console.log(`Successfully populated mock data for user ${uid}.`);
    } catch (error) {
        console.error(`Failed to populate mock data for user ${uid}:`, error);
    }
});

exports.populateUserData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { uid, token } = context.auth;
    const { email, name } = token;

    console.log(`Populate data requested for user: ${uid}`);
    try {
        const mockData = getMockData(uid, email, name);
         const db = admin.database();
        const updates = {};
        for (const [key, value] of Object.entries(mockData)) {
            updates[`/${key}/${uid}`] = value;
        }
        await db.ref().update(updates);
        console.log(`Successfully populated mock data for user ${uid} via onCall.`);
        return { success: true, message: 'Mock data populated successfully.' };
    } catch (error) {
        console.error(`Failed to populate mock data for user ${uid} via onCall:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to populate data.');
    }
});

exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { priceId, successUrl, cancelUrl } = data;
    const uid = context.auth.uid;

    try {
        const customer = await getOrCreateCustomer(uid);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer: customer.id,
            client_reference_id: uid,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: cancelUrl,
        });

        return { sessionId: session.id };
    } catch (error) {
        console.error("Stripe Checkout Session Error:", error);
        throw new functions.https.HttpsError('internal', 'Unable to create checkout session.');
    }
});

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let endpointSecret;
    try {
        endpointSecret = functions.config().stripe.webhook_secret;
    } catch (e) {
        console.warn('Stripe webhook secret not found, webhook processing will be skipped.');
        res.status(200).send();
        return;
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const dataObject = event.data.object;

    switch (event.type) {
        case 'checkout.session.completed':
            const customerId = dataObject.customer;
            const subscription = await stripe.subscriptions.retrieve(dataObject.subscription);
            const userRef = admin.database().ref(`users/${dataObject.client_reference_id}`);
            await userRef.update({
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                stripeSubscriptionStatus: subscription.status,
            });
            break;
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            const subscriptionData = dataObject;
            const customer = await stripe.customers.retrieve(subscriptionData.customer);
            const user = await admin.database().ref(`users`).orderByChild('stripeCustomerId').equalTo(customer.id).once('value');
            if (user.exists()) {
                const uid = Object.keys(user.val())[0];
                await admin.database().ref(`users/${uid}`).update({
                    stripeSubscriptionStatus: subscriptionData.status,
                });
            }
            break;
        default:
            // Unhandled event type
    }

    res.status(200).send();
});

async function getOrCreateCustomer(uid) {
    const userRef = admin.database().ref(`users/${uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();

    if (userData && userData.stripeCustomerId) {
        try {
            const customer = await stripe.customers.retrieve(userData.stripeCustomerId);
            if (!customer.deleted) {
                return customer;
            }
        } catch (error) {
            // Customer might have been deleted in Stripe, create a new one.
        }
    }
    
    const userAuth = await admin.auth().getUser(uid);
    const newCustomer = await stripe.customers.create({
        email: userAuth.email,
        metadata: { firebaseUID: uid },
    });

    await userRef.update({ stripeCustomerId: newCustomer.id });
    return newCustomer;
}

exports.createStripePortalLink = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    try {
        const customer = await getOrCreateCustomer(context.auth.uid);
        
        // Check if customer has an active subscription
        const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1
        });
        
        if (subscriptions.data.length === 0) {
            // If no active subscription, still try to create portal session
            // as Stripe allows customers to view past invoices even without active subscription
            console.log('Customer has no active subscription, but attempting to create portal session anyway');
        }
        
        const session = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: data.returnUrl || 'https://puul.ai/platform_settings.html',
        });
        
        return { url: session.url };
    } catch (error) {
        console.error("Stripe Portal Link Error:", error);
        console.error("Error details:", {
            message: error.message,
            type: error.type,
            statusCode: error.statusCode,
            raw: error.raw
        });
        
        // Provide more specific error messages
        if (error.statusCode === 400) {
            if (error.message.includes('portal')) {
                throw new functions.https.HttpsError('failed-precondition', 'The billing portal has not been configured in Stripe. Please contact support.');
            } else if (error.message.includes('customer')) {
                throw new functions.https.HttpsError('failed-precondition', 'Unable to create portal session for this customer.');
            }
        }
        
        throw new functions.https.HttpsError('internal', 'Unable to create portal link: ' + error.message);
    }
});

exports.generateGeminiResponse = functions.https.onCall(async (data, context) => {
    if (!GEMINI_API_KEY) {
        throw new functions.https.HttpsError('failed-precondition', 'The Gemini API key is not configured.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const uid = context.auth.uid;
    const userRef = admin.database().ref(`users/${uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();
    
    if (!userData || !userData.stripeSubscriptionStatus || userData.stripeSubscriptionStatus !== 'active') {
        throw new functions.https.HttpsError('permission-denied', 'You must have an active subscription to use this feature.');
    }

    const conversationHistory = data.history;
    if (!conversationHistory || !Array.isArray(conversationHistory)) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "history" array.');
    }

    const MAX_TOOL_CALLS = 5;

    try {
        for (let i = 0; i < MAX_TOOL_CALLS; i++) {
            const response = await axios.post(API_URL, {
                "contents": conversationHistory,
                "tools": allTools,
                "generationConfig": { "temperature": 0.7, "topK": 1, "topP": 1, "maxOutputTokens": 2048, "stopSequences": [] },
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
            if (!content.parts[0].functionCall) {
                // If not, we have our final text response.
                const agentResponse = content.parts[0].text;
                // Append the final response to the history before returning
                conversationHistory.push({ role: 'model', parts: [{ text: agentResponse }] });
                return { response: agentResponse, updatedHistory: conversationHistory };
            }

            const functionCall = content.parts[0].functionCall;
            const functionName = functionCall.name;
            const functionArgs = functionCall.args;
            
            // Check if the called function is a server-side tool
            if (toolImplementations[functionName]) {
                console.log(`Executing server-side tool: ${functionName}`, functionArgs);

                // Append the model's function call to the history
                conversationHistory.push({ role: 'model', parts: [{ functionCall }] });

                // Execute the tool
                const toolResult = await toolImplementations[functionName](functionArgs, uid);

                // Append the tool's result to the history
                conversationHistory.push({
                    role: 'function',
                    parts: [{ functionResponse: { name: functionName, response: toolResult } }]
                });

                // Continue to the next iteration of the loop to get the final text response
            } else {
                 // The model tried to call a tool that doesn't exist on the server.
                 console.error(`Error: Model attempted to call unimplemented tool: ${functionName}`);
                 const finalResponse = "I'm sorry, I can't perform that action. I can only read and update data from your database.";
                 conversationHistory.push({ role: 'model', parts: [{ text: finalResponse }] });
                 return { response: finalResponse, updatedHistory: conversationHistory };
            }
        }
        
        // If the loop completes, it means we hit the max tool calls.
        // Return a message to the user.
        const finalResponse = "I seem to be having trouble completing your request. Please try rephrasing.";
        conversationHistory.push({ role: 'model', parts: [{ text: finalResponse }] });
        return { response: finalResponse, updatedHistory: conversationHistory };

    } catch (error) {
        console.error("Error in generateGeminiResponse loop:", error.response ? error.response.data : error.message);
        if (error.isAxiosError) {
             throw new functions.https.HttpsError('internal', 'Failed to call the Gemini API.', error.response ? error.response.data : null);
        }
        throw error; // re-throw other types of errors
    }
}); 