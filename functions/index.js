const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const nodemailer = require("nodemailer");
const { toolImplementations } = require("./tools");
let stripe;

console.log("Attempting to initialize Stripe...");
console.log("Stripe secret key from config:", functions.config().stripe ? functions.config().stripe.secret : "Not found");

try {
    stripe = require("stripe")(functions.config().stripe.secret);
    console.log("Stripe initialized successfully.");
} catch (e) {
    console.warn('Stripe config not found or invalid, Stripe functionality will be disabled.', e);
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
                    "type": "ARRAY",
                    "description": "An array of filter objects to apply to the data. All filters are applied with AND logic. Each object must contain 'field', 'operator', and 'value'. Supported operators are: 'eq' (equal), 'neq' (not equal), 'gt' (greater than), 'gte' (greater than or equal), 'lt' (less than), 'lte' (less than or equal), 'contains' (for strings), 'notContains' (for strings). Example: [{ \"field\": \"status\", \"operator\": \"eq\", \"value\": \"Open\" }]",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "field": { "type": "STRING" },
                            "operator": { "type": "STRING" },
                            "value": {}
                        },
                        "required": ["field", "operator", "value"]
                    }
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
    },
    {
        "name": "createData",
        "description": "Creates a new data record in the user's database. For work orders, the 'newData' object should include fields like 'title', 'status', and 'priority'. For example: { \"title\": \"Fix leaky faucet\", \"status\": \"Open\", \"priority\": \"High\" }",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "dataType": {
                    "type": "STRING",
                    "description": "The type of data to create, e.g., 'workOrders', 'tenants'."
                },
                "newData": {
                    "type": "OBJECT",
                    "description": "An object representing the new record to create.",
                    "properties": {}
                }
            },
            "required": ["dataType", "newData"]
        }
    },
    {
        "name": "deleteData",
        "description": "Deletes a specific data record from the user's database.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "dataType": {
                    "type": "STRING",
                    "description": "The type of data to delete, e.g., 'workOrders', 'leases'."
                },
                "itemId": {
                    "type": "STRING",
                    "description": "The unique ID of the item to be deleted."
                }
            },
            "required": ["dataType", "itemId"]
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

    console.log(`[createCheckoutSession] Function called for user UID: ${uid}`);
    console.log(`[createCheckoutSession] Attempting to create session with Price ID: ${priceId}`);

    try {
        const customer = await getOrCreateCustomer(uid);
        console.log(`[createCheckoutSession] Using Stripe Customer ID: ${customer.id}`);

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
    const eventType = event.type;
    
    // Check for metadata to route to the correct handler
    let metadata = dataObject.metadata;
    if (eventType === 'checkout.session.completed') {
        // For checkout sessions, the subscription metadata is nested
        const subscription = await stripe.subscriptions.retrieve(dataObject.subscription);
        metadata = subscription.metadata;
    } else if (dataObject.object === 'subscription') {
        metadata = dataObject.metadata;
    } else if (dataObject.object === 'invoice') {
        // For invoices, get metadata from the subscription line item
        const subscriptionId = dataObject.subscription;
        if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            metadata = subscription.metadata;
        }
    }


    if (metadata && metadata.type === 'tenant_rent') {
        // It's a tenant rent event
        await handleTenantRentWebhook(eventType, dataObject, metadata);
    } else {
        // Assume it's a platform subscription event
        await handlePlatformSubscriptionWebhook(eventType, dataObject);
    }


    res.status(200).send();
});

async function handleTenantRentWebhook(eventType, dataObject, metadata) {
    const { firebaseUID, leaseId, tenantId } = metadata;
    const db = admin.database();

    switch (eventType) {
        case 'checkout.session.completed':
            const subscriptionId = dataObject.subscription;
            if (subscriptionId) {
                await db.ref(`leases/${firebaseUID}/${leaseId}`).update({
                    stripeSubscriptionId: subscriptionId,
                    stripeTenantId: tenantId,
                    stripeSubscriptionStatus: 'active'
                });
                console.log(`[Webhook] Activated auto-pay for lease ${leaseId}, subscription ${subscriptionId}`);
            }
            break;

        case 'invoice.payment_succeeded':
            // Only create a receivable if it's not the first payment (which is handled by checkout session)
            if (dataObject.billing_reason === 'subscription_cycle') {
                const leaseSnap = await db.ref(`leases/${firebaseUID}/${leaseId}`).once('value');
                const lease = leaseSnap.val();
                const tenantSnap = await db.ref(`tenants/${firebaseUID}/${tenantId}`).once('value');
                const tenant = tenantSnap.val();

                if (lease && tenant) {
                    const receivable = {
                        date: new Date(dataObject.created * 1000).toISOString().split('T')[0],
                        payerName: tenant.fullName,
                        propertyId: lease.propertyId,
                        description: `Monthly Rent - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
                        amountDue: lease.rentAmount,
                        amountPaid: parseFloat(dataObject.amount_paid / 100).toFixed(2),
                        status: 'Paid',
                        userId: firebaseUID,
                        createdAt: admin.database.ServerValue.TIMESTAMP,
                        updatedAt: admin.database.ServerValue.TIMESTAMP,
                    };
                    await db.ref(`receivables/${firebaseUID}`).push(receivable);
                    console.log(`[Webhook] Created receivable for lease ${leaseId} from invoice ${dataObject.id}`);
                }
            }
            break;
        
        case 'customer.subscription.deleted':
             await db.ref(`leases/${firebaseUID}/${leaseId}`).update({
                stripeSubscriptionStatus: 'canceled'
            });
            console.log(`[Webhook] Canceled auto-pay for lease ${leaseId}`);
            break;
    }
}

async function handlePlatformSubscriptionWebhook(eventType, dataObject) {
     switch (eventType) {
        case 'checkout.session.completed':
            const customerId = dataObject.customer;
            const subscription = await stripe.subscriptions.retrieve(dataObject.subscription, { expand: ['items'] });
            const userRef = admin.database().ref(`users/${dataObject.client_reference_id}`);
            
            // Assuming one subscription item per plan
            const priceId = subscription.items.data[0]?.price.id;

            await userRef.update({
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscription.id,
                stripeSubscriptionStatus: subscription.status,
                stripePriceId: priceId,
            });
            break;
        case 'customer.subscription.updated':
            const subscriptionData = dataObject;
            const customer = await stripe.customers.retrieve(subscriptionData.customer);
            const user = await admin.database().ref(`users`).orderByChild('stripeCustomerId').equalTo(customer.id).once('value');
            if (user.exists()) {
                const uid = Object.keys(user.val())[0];
                const priceId = subscriptionData.items.data[0]?.price.id;
                await admin.database().ref(`users/${uid}`).update({
                    stripeSubscriptionStatus: subscriptionData.status,
                    stripePriceId: priceId,
                });
            }
            break;
        case 'customer.subscription.deleted':
            const deletedSubscriptionData = dataObject;
            const deletedCustomer = await stripe.customers.retrieve(deletedSubscriptionData.customer);
            const deletedUser = await admin.database().ref(`users`).orderByChild('stripeCustomerId').equalTo(deletedCustomer.id).once('value');
            if (deletedUser.exists()) {
                const uid = Object.keys(deletedUser.val())[0];
                await admin.database().ref(`users/${uid}`).update({
                    stripeSubscriptionStatus: deletedSubscriptionData.status,
                    // Optionally keep the price ID for historical purposes or set to null
                    // stripePriceId: null 
                });
            }
            break;
        default:
            // Unhandled event type
            console.log(`[Webhook] Unhandled platform event type: ${eventType}`);
    }
}

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

exports.createTenantRentSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const uid = context.auth.uid;
    const { leaseId, tenantId } = data;

    if (!leaseId || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "leaseId" and "tenantId".');
    }

    try {
        const db = admin.database();
        
        // 1. Fetch all necessary data from Firebase
        const leaseSnap = await db.ref(`leases/${uid}/${leaseId}`).once('value');
        const lease = leaseSnap.val();
        if (!lease) throw new functions.https.HttpsError('not-found', 'Lease not found.');
        
        // Add robust validation for rent amount
        const rentAmount = parseFloat(lease.rentAmount);
        if (isNaN(rentAmount) || rentAmount <= 0) {
            throw new functions.https.HttpsError('invalid-argument', `Lease has an invalid rent amount: "${lease.rentAmount}". Please set a valid, positive number.`);
        }

        const tenantSnap = await db.ref(`tenants/${uid}/${tenantId}`).once('value');
        const tenant = tenantSnap.val();
        if (!tenant) throw new functions.https.HttpsError('not-found', 'Tenant not found.');
        
        // Add validation for tenant's full name
        if (!tenant.fullName || tenant.fullName.trim() === '') {
            throw new functions.https.HttpsError('invalid-argument', `Tenant record with ID "${tenantId}" does not have a full name. Please add one in the People tab.`);
        }
        
        // Add validation for tenant email
        if (!tenant.email || !tenant.email.includes('@')) {
            throw new functions.https.HttpsError('invalid-argument', `Tenant "${tenant.fullName || tenantId}" does not have a valid email address. Please add one in the People tab.`);
        }
        
        // Validate that the lease end date is in the future.
        const leaseEndDate = new Date(lease.endDate);
        if (isNaN(leaseEndDate.getTime())) {
            throw new functions.https.HttpsError('invalid-argument', 'Lease has an invalid end date format.');
        }
        // Set to the end of the day to ensure the entire day is included.
        leaseEndDate.setUTCHours(23, 59, 59, 999);
        if (leaseEndDate.getTime() <= Date.now()) {
            throw new functions.https.HttpsError('failed-precondition', 'The lease end date must be in the future to set up auto-pay.');
        }

        const propertySnap = await db.ref(`properties/${uid}/${lease.propertyId}`).once('value');
        const property = propertySnap.val();
        if (!property) throw new functions.https.HttpsError('not-found', 'Property not found.');

        // Add validation for property address
        if (!property.address || property.address.trim() === '') {
            throw new functions.https.HttpsError('invalid-argument', `The associated property does not have an address. Please add one in the Properties tab.`);
        }

        // 2. Get or Create Stripe Customer for the Tenant
        let tenantStripeCustomerId = tenant.stripeCustomerId;
        if (!tenantStripeCustomerId) {
            const customer = await stripe.customers.create({
                email: tenant.email,
                name: tenant.fullName,
                metadata: { firebaseUID: uid, tenantId: tenantId }
            });
            tenantStripeCustomerId = customer.id;
            await db.ref(`tenants/${uid}/${tenantId}/stripeCustomerId`).set(tenantStripeCustomerId);
        }

        // 3. Create Stripe Product & Price for the rent
        const product = await stripe.products.create({
            name: `Rent for ${property.address}`,
            metadata: { leaseId: leaseId, propertyId: lease.propertyId }
        });

        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: Math.round(rentAmount * 100), // Stripe expects amount in cents
            currency: 'usd',
            recurring: { interval: 'month' },
        });

        // 4. Create a Subscription Schedule to handle the fixed term
        const schedule = await stripe.subscriptionSchedules.create({
          customer: tenantStripeCustomerId,
          start_date: 'now',
          end_behavior: 'cancel',
          phases: [
            {
              items: [{ price: price.id, quantity: 1 }],
              iterations: 12, // This will be calculated or managed differently in a real app
            },
          ],
          metadata: {
              type: 'tenant_rent',
              leaseId: leaseId,
              tenantId: tenantId,
              firebaseUID: uid
          }
        });

        // 5. Create a checkout session for the schedule
        const successUrl = `https://puul.ai/platform_leasing.html?payment_success=true&leaseId=${leaseId}`;
        const cancelUrl = `https://puul.ai/platform_leasing.html?payment_cancelled=true&leaseId=${leaseId}`;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer: tenantStripeCustomerId,
            line_items: [{ price: price.id, quantity: 1 }],
             subscription_data: {
                metadata: {
                    type: 'tenant_rent',
                    leaseId: leaseId,
                    tenantId: tenantId,
                    firebaseUID: uid
                }
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        return { checkoutUrl: session.url };

    } catch (error) {
        console.error("Full error object:", JSON.stringify(error, null, 2));
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        
        // Check if this is a Stripe-specific error and provide a more detailed message.
        let errorMessage = 'An unexpected error occurred. Please check the function logs for more details.';
        if (error.type === 'StripeInvalidRequestError' || error.type === 'StripeAPIError' || error.type === 'StripeCardError') {
            errorMessage = error.message;
        } else if (error.raw && error.raw.message) {
            errorMessage = error.raw.message;
        } else if (error.message) {
            errorMessage = error.message;
        }

        throw new functions.https.HttpsError('internal', errorMessage, error);
    }
});

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

// Email sending function
async function sendApplicationEmail(applicationData, propertyData) {
    console.log('=== EMAIL SENDING START ===');
    console.log('Application data received:', JSON.stringify(applicationData, null, 2));
    console.log('Property data received:', JSON.stringify(propertyData, null, 2));
    
    try {
        // Check email configuration
        const emailUser = functions.config().email?.user;
        const emailPassword = functions.config().email?.password;
        
        console.log('Email config check:');
        console.log('- Email user configured:', !!emailUser);
        console.log('- Email password configured:', !!emailPassword);
        
        if (!emailUser || !emailPassword) {
            console.error('Email configuration missing!');
            console.log('Available config keys:', Object.keys(functions.config()));
            throw new Error('Email configuration not set up properly');
        }
        
        // Create transporter using Gmail (you can configure this with your email service)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPassword
            }
        });
        
        console.log('Email transporter created successfully');

        // Create HTML email content
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #1a202c; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .section { margin-bottom: 20px; }
                    .section h3 { color: #1a202c; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
                    .detail-item { margin-bottom: 10px; }
                    .label { font-weight: bold; color: #4a5568; }
                    .value { margin-left: 10px; }
                    .footer { background: #f7fafc; padding: 20px; text-align: center; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Rental Application Confirmation</h1>
                </div>
                <div class="content">
                    <p>Dear ${applicationData.firstName} ${applicationData.lastName},</p>
                    <p>Thank you for submitting your rental application. We have received your application and will review it shortly.</p>
                    
                    <div class="section">
                        <h3>Property Information</h3>
                        <div class="detail-item">
                            <span class="label">Address:</span>
                            <span class="value">${propertyData?.address || 'Property Information'}</span>
                        </div>
                        ${propertyData?.type ? `<div class="detail-item"><span class="label">Type:</span><span class="value">${propertyData.type}</span></div>` : ''}
                        ${propertyData?.bedrooms ? `<div class="detail-item"><span class="label">Bedrooms:</span><span class="value">${propertyData.bedrooms}</span></div>` : ''}
                        ${propertyData?.bathrooms ? `<div class="detail-item"><span class="label">Bathrooms:</span><span class="value">${propertyData.bathrooms}</span></div>` : ''}
                    </div>

                    <div class="section">
                        <h3>Your Application Details</h3>
                        <div class="detail-item">
                            <span class="label">Name:</span>
                            <span class="value">${applicationData.firstName} ${applicationData.lastName}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Email:</span>
                            <span class="value">${applicationData.email}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Phone:</span>
                            <span class="value">${applicationData.phone}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Monthly Income:</span>
                            <span class="value">$${parseFloat(applicationData.monthlyIncome).toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Desired Move-in Date:</span>
                            <span class="value">${applicationData.moveInDate}</span>
                        </div>
                    </div>

                    <div class="section">
                        <h3>Next Steps</h3>
                        <p>We will review your application and contact you within 2-3 business days with our decision. Please ensure all information provided is accurate and complete.</p>
                        <p>If you have any questions, please don't hesitate to contact us.</p>
                    </div>
                </div>
                <div class="footer">
                    <p>Thank you for choosing our property management services.</p>
                    <p>Application submitted on: ${new Date().toLocaleDateString()}</p>
                </div>
            </body>
            </html>
        `;

        // Send email
        const mailOptions = {
            from: emailUser,
            to: applicationData.email,
            subject: 'Rental Application Confirmation - Puul Platform',
            html: emailHtml
        };

        console.log('Sending email with options:', {
            from: emailUser,
            to: applicationData.email,
            subject: 'Rental Application Confirmation - Puul Platform'
        });

        const result = await transporter.sendMail(mailOptions);
        console.log('=== EMAIL SENT SUCCESSFULLY ===');
        console.log('Email message ID:', result.messageId);
        console.log('Email response:', result);
        return true;
    } catch (error) {
        console.error('=== EMAIL SENDING FAILED ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return false;
    }
}

exports.submitApplication = functions.https.onCall(async (data, context) => {
    console.log('=== APPLICATION SUBMISSION START ===');
    console.log('Function called with data:', JSON.stringify(data, null, 2));
    console.log('Context auth:', context.auth ? 'Authenticated' : 'Not authenticated');
    
    const { propertyId, applicationData, userId } = data;
    const uid = userId || (context.auth ? context.auth.uid : null);

    console.log('Extracted parameters:');
    console.log('- propertyId:', propertyId);
    console.log('- userId:', userId);
    console.log('- uid:', uid);
    console.log('- applicationData keys:', Object.keys(applicationData || {}));

    if (!uid) {
        console.error('No user ID provided');
        throw new functions.https.HttpsError('invalid-argument', 'User ID is required.');
    }

    if (!propertyId || !applicationData) {
        console.error('Missing required data:', { propertyId: !!propertyId, applicationData: !!applicationData });
        throw new functions.https.HttpsError('invalid-argument', 'Property ID and application data are required.');
    }

    try {
        console.log('Initializing database...');
        const db = admin.database();
        const applicationRef = db.ref(`applications/${uid}/${propertyId}`);
        
        console.log('Fetching property information...');
        // Get property information for email
        const propertyRef = db.ref(`properties/${uid}/${propertyId}`);
        const propertySnapshot = await propertyRef.once('value');
        const propertyData = propertySnapshot.val();
        
        console.log('Property data retrieved:', propertyData ? 'Success' : 'No data found');
        
        // Add metadata to application
        const applicationWithMetadata = {
            ...applicationData,
            submittedAt: admin.database.ServerValue.TIMESTAMP,
            status: 'pending',
            propertyId: propertyId,
            userId: uid
        };

        console.log('Saving application to database...');
        const newApplicationRef = await applicationRef.push(applicationWithMetadata);
        console.log('Application saved with ID:', newApplicationRef.key);
        
        // Send confirmation email
        console.log('Attempting to send confirmation email...');
        try {
            const emailResult = await sendApplicationEmail(applicationData, propertyData);
            console.log('Email sending result:', emailResult);
        } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            console.error('Email error details:', {
                message: emailError.message,
                stack: emailError.stack
            });
            // Don't fail the application submission if email fails
        }
        
        console.log('=== APPLICATION SUBMISSION SUCCESS ===');
        return { 
            success: true, 
            applicationId: newApplicationRef.key,
            message: 'Application submitted successfully' 
        };
    } catch (error) {
        console.error('=== APPLICATION SUBMISSION FAILED ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        throw new functions.https.HttpsError('internal', 'Failed to submit application: ' + error.message);
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
                let toolResult = await toolImplementations[functionName](functionArgs, uid);

                // Add specific advice for certain successful tool calls
                if (functionName === 'createData' && functionArgs.dataType === 'workOrders' && !toolResult.error) {
                    toolResult.result += " Please go in and select the property for the work order from the dropdown menu.";
                }
                
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