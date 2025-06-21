const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const stripe = require("stripe")(functions.config().stripe.secret);

admin.initializeApp();

// It's recommended to store your API key in Firebase environment variables for security
// To set this variable, run the following command in your terminal:
// firebase functions:config:set gemini.key="YOUR_API_KEY"
// firebase functions:config:set stripe.secret="YOUR_STRIPE_SECRET_KEY"
// firebase functions:config:set stripe.webhook_secret="YOUR_STRIPE_WEBHOOK_SECRET"
// Deployment trigger: 2
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
    const endpointSecret = functions.config().stripe.webhook_secret;

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
        const { url } = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: data.returnUrl || 'https://puul.ai/platform_settings.html',
        });
        return { url };
    } catch (error) {
        console.error("Stripe Portal Link Error:", error);
        throw new functions.https.HttpsError('internal', 'Unable to create portal link.');
    }
});

exports.generateGeminiResponse = functions.https.onCall(async (data, context) => {
    // Ensure the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userRef = admin.database().ref(`users/${context.auth.uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();
    
    if (!userData || !userData.stripeSubscriptionStatus || userData.stripeSubscriptionStatus !== 'active') {
        throw new functions.https.HttpsError('permission-denied', 'You must have an active subscription to use this feature.');
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