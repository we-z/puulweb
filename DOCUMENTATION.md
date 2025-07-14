# Puul Platform Documentation

## Table of Contents
1. [Quickstart](#quickstart)
2. [Backend API (Cloud Functions)](#backend-api-cloud-functions)
   - [Public Callable Functions](#public-callable-functions)
   - [HTTP Endpoints](#http-endpoints)
   - [Generic Data Utilities](#generic-data-utilities)
3. [Frontend Functions & Components](#frontend-functions--components)
   - [AI Agent Sidebar](#ai-agent-sidebar)
   - [Sidebar & Layout](#sidebar--layout)
   - [Dropdowns](#dropdowns)
   - [Alerts & Confirms](#alerts--confirms)
   - [Firebase Auth & Data Helpers](#firebase-auth--data-helpers)
4. [UI Components & Design System](#ui-components--design-system)
   - [Sidebar](#sidebar)
   - [Buttons](#buttons)
   - [Dropdowns](#dropdowns-1)
   - [Modals](#modals)
   - [Badges & Status](#badges--status)
5. [Best Practices & Extending](#best-practices--extending)

---

## Quickstart

1. **Clone the repo and install dependencies:**
   ```bash
   cd functions && npm install
   ```
2. **Set Firebase config:**
   ```bash
   firebase functions:config:set gemini.key="YOUR_API_KEY"
   firebase functions:config:set stripe.secret="YOUR_STRIPE_SECRET_KEY"
   firebase functions:config:set stripe.webhook_secret="YOUR_STRIPE_WEBHOOK_SECRET"
   ```
3. **Deploy:**
   ```bash
   firebase deploy
   ```
4. **Open the site** (hosted on Firebase) and sign up.

---

## Backend API (Cloud Functions)

### Public Callable Functions

#### `populateUserData`
- **Type:** Callable
- **Purpose:** Populates a new user's database with mock/sample data.
- **Usage (frontend):**
  ```js
  const populateUserData = httpsCallable(functions, 'populateUserData');
  await populateUserData();
  ```
- **Returns:** `{ success: true, message: 'Mock data populated successfully.' }`

#### `createCheckoutSession`
- **Type:** Callable
- **Purpose:** Creates a Stripe checkout session for a subscription.
- **Params:** `{ priceId, successUrl, cancelUrl }`
- **Returns:** `{ sessionId }`

#### `createTenantRentSubscription`
- **Type:** Callable
- **Purpose:** Sets up a recurring rent payment subscription for a tenant.
- **Params:** `{ leaseId, tenantId }`
- **Returns:** `{ checkoutUrl }`

#### `createStripePortalLink`
- **Type:** Callable
- **Purpose:** Generates a Stripe billing portal link for the current user.
- **Params:** `{ returnUrl? }`
- **Returns:** `{ url }`

#### `submitApplication`
- **Type:** Callable
- **Purpose:** Submits a rental application and sends a confirmation email.
- **Params:** `{ propertyId, applicationData, userId? }`
- **Returns:** `{ success, applicationId, message }`

#### `generateGeminiResponse`
- **Type:** Callable
- **Purpose:** Handles AI chat requests, including tool calls and conversation history.
- **Params:** `{ history: Array }`
- **Returns:** `{ response, updatedHistory }`

### HTTP Endpoints

#### `stripeWebhook`
- **Type:** HTTP
- **Purpose:** Handles Stripe webhook events for subscriptions and rent payments.
- **Usage:** Set Stripe to POST to `/stripeWebhook`.

### Generic Data Utilities

These are used internally and by the AI agent, but can be called from custom functions:

#### `getData({ dataType, filters }, uid)`
- **Purpose:** Retrieve a list of records (e.g., properties, workOrders) with optional filters.
- **Example:**
  ```js
  await getData({ dataType: 'workOrders', filters: [{ field: 'status', operator: 'eq', value: 'Open' }] }, uid);
  ```

#### `updateData({ dataType, itemId, updates }, uid)`
- **Purpose:** Update a record by ID.
- **Example:**
  ```js
  await updateData({ dataType: 'workOrders', itemId: 'wo_1', updates: { status: 'Closed' } }, uid);
  ```

#### `createData({ dataType, newData }, uid)`
- **Purpose:** Create a new record.
- **Example:**
  ```js
  await createData({ dataType: 'tenants', newData: { fullName: 'Jane Doe', email: 'jane@example.com' } }, uid);
  ```

#### `deleteData({ dataType, itemId }, uid)`
- **Purpose:** Delete a record by ID.
- **Example:**
  ```js
  await deleteData({ dataType: 'workOrders', itemId: 'wo_1' }, uid);
  ```

---

## Frontend Functions & Components

### AI Agent Sidebar
- **Location:** `platform_common.js`
- **Key Functions:**
  - `initializeConversation()`, `startNewConversation()`, `renderConversation(history)`, `handleAgentQuery(history)`
- **Usage:**
  - The sidebar is auto-initialized on every platform page. Users can chat with the AI, which can call backend tools.
  - **Customizable:** You can extend the sidebar or AI logic by editing these functions.

### Sidebar & Layout
- **Function:** `setupPageLayoutAndInteractivity()`
- **Purpose:** Injects the sidebar, AI agent, and handles responsive layout and toggles.
- **Usage:** Called after Firebase auth completes.

### Dropdowns
- **Functions:**
  - `initializeSearchableDropdown(dropdownElement, onChangeCallback, isDynamic = false)`
  - `initializeSimpleDropdown(dropdown, onChangeCallback)`
- **Usage:**
  - Attach to custom dropdown elements for searchable/selectable lists.

### Alerts & Confirms
- **Functions:**
  - `showAlert(message)`: Shows a custom alert modal.
  - `showConfirm(message, title)`: Shows a confirm modal, returns a Promise.
- **Usage:**
  ```js
  showAlert('Saved!');
  const confirmed = await showConfirm('Are you sure?');
  ```

### Firebase Auth & Data Helpers
- **Functions:**
  - `initializeAuth(callback)`: Call on each page to set up auth and run your page logic.
  - `getDbData(dataRef)`, `updateDbData(dataRef, values)`: Async helpers for Firebase Realtime Database.
- **Usage:**
  ```js
  initializeAuth((uid, db, ref, push, set, remove, serverTimestamp, query, orderByChild, equalTo, getDbData, updateDbData, ...etc) => {
    // Your page logic here
  });
  ```

---

## UI Components & Design System

### Sidebar
- **Class:** `.sidebar`, `.sidebar.collapsed`
- **Features:**
  - Monotone, high-contrast, rounded, shadowed, mobile-friendly.
  - Responsive collapse/expand with smooth transitions.

### Buttons
- **Classes:** `.sign-out-btn`, `.btn-primary`, `.btn-danger`, `.btn-secondary`
- **Features:**
  - Monotone, rounded, soft shadows, no gradients or borders.
  - Large, accessible, with hover effects.

### Dropdowns
- **Classes:** `.custom-dropdown`, `.dropdown-selected`, `.dropdown-menu`, `.dropdown-option`
- **Features:**
  - Minimal, high-contrast, rounded, with smooth open/close transitions.
  - Searchable and simple variants.

### Modals
- **Classes:** `.modal`, `.custom-alert`, `.confirm-modal-content`
- **Features:**
  - Centered, rounded, shadowed, monotone.
  - Accessible and mobile-friendly.

### Badges & Status
- **Classes:** `.status-badge`, `.priority-badge`, `.status-open`, `.status-in-progress`, `.status-closed`, `.priority-high`, `.priority-medium`, `.priority-low`
- **Features:**
  - Color-coded, rounded, minimal.

---

## Best Practices & Extending

- **Follow the design system:** Use the provided CSS classes for all new UI elements.
- **Mobile first:** All components are responsive; test on mobile.
- **Custom icons:** Use large, simple SVGs. Avoid cluttered or detailed icons.
- **Backend:** Add new callable functions in `functions/index.js` and document their params and return values.
- **Frontend:** Export new utilities from `platform_common.js` and document their usage.
- **Testing:** Always test new features in both desktop and mobile views before deploying.

---

For further details, see inline code comments in each file. For questions, contact the Puul Platform team.