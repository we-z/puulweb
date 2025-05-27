import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getDatabase, ref, push, set, remove, serverTimestamp, query, orderByChild, equalTo, get, update } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyCTJnqW7xH0TpvDUEv73HWaVWp46bpIV9k",
    authDomain: "puul-app.firebaseapp.com",
    databaseURL: "https://puul-app-default-rtdb.firebaseio.com",
    projectId: "puul-app",
    storageBucket: "puul-app.appspot.com",
    messagingSenderId: "155293676322",
    appId: "1:155293676322:web:100962810832e88305ab7b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
let currentUserId = null;
let cachedUserDisplayName = sessionStorage.getItem('puulUserDisplayName');

// DOM Elements Cache (Common)
const DOMElements = {
    welcomeMessage: document.getElementById('welcomeMessage'),
    signOutBtn: document.getElementById('signOutBtn'),
    // Modals that are common to all pages
    customAlertModal: document.getElementById('customAlertModal'),
    customAlertTitle: document.getElementById('customAlertTitle'),
    customAlertMessage: document.getElementById('customAlertMessage'),
    customConfirmModal: document.getElementById('customConfirmModal'),
    customConfirmTitle: document.getElementById('customConfirmTitle'),
    customConfirmMessage: document.getElementById('customConfirmMessage'),
    customConfirmOk: document.getElementById('customConfirmOk'),
    customConfirmCancel: document.getElementById('customConfirmCancel'),
    // Generic close buttons for any modal
    closeButtons: document.querySelectorAll('.close-btn, .cancel-btn, .ok-btn') 
};

const editIconSVG = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg>`;
const deleteIconSVG = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>`;

// --- Custom Alert & Confirm --- 
function showAlert(message, title = "Notification") {
    if (!DOMElements.customAlertModal) return;
    DOMElements.customAlertTitle.textContent = title;
    DOMElements.customAlertMessage.textContent = message;
    DOMElements.customAlertModal.style.display = 'flex';
}

function showConfirm(message, title = "Confirm Action") {
    if (!DOMElements.customConfirmModal) return Promise.resolve(false);
    return new Promise((resolve) => {
        DOMElements.customConfirmTitle.textContent = title;
        DOMElements.customConfirmMessage.textContent = message;
        DOMElements.customConfirmModal.style.display = 'flex';

        DOMElements.customConfirmOk.onclick = () => {
            DOMElements.customConfirmModal.style.display = 'none';
            resolve(true);
        };
        DOMElements.customConfirmCancel.onclick = () => {
            DOMElements.customConfirmModal.style.display = 'none';
            resolve(false);
        };
    });
}

// --- Modal Management (Generic Close) ---
if (DOMElements.closeButtons) {
    DOMElements.closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modalId;
            if (modalId && document.getElementById(modalId)) {
                document.getElementById(modalId).style.display = 'none';
            }
        });
    });
}
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// --- Firebase Auth & Initialization Hook (to be called by each page) ---
function initializeAuth(pageSpecificInitCallback) {
    // Immediately try to set user name from cache to reduce flicker
    if (cachedUserDisplayName && DOMElements.welcomeMessage) {
        DOMElements.welcomeMessage.textContent = `Welcome, ${cachedUserDisplayName}!`;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            const displayName = user.displayName || user.email.split('@')[0];
            cachedUserDisplayName = displayName; // Update cache
            sessionStorage.setItem('puulUserDisplayName', displayName);

            if (DOMElements.welcomeMessage) {
                DOMElements.welcomeMessage.textContent = `Welcome, ${displayName}!`;
            }
            if (pageSpecificInitCallback && typeof pageSpecificInitCallback === 'function') {
                pageSpecificInitCallback(currentUserId, database, ref, push, set, remove, serverTimestamp, query, orderByChild, equalTo, getDbData, updateDbData, showAlert, showConfirm, editIconSVG, deleteIconSVG);
            }
        } else {
            currentUserId = null;
            window.location.href = '/'; // Redirect to home page if not signed in
        }
    });

    if (DOMElements.signOutBtn) {
        DOMElements.signOutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                sessionStorage.removeItem('puulUserDisplayName'); // Clear cache on sign out
                // onAuthStateChanged will handle redirect
            } catch (error) {
                console.error('Error signing out:', error);
                showAlert('Error signing out. Please try again.', 'Sign Out Error');
            }
        });
    }
}

// --- Firebase Data Helpers ---
async function getDbData(dataRef) {
    const { get: fbGet } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
    return fbGet(dataRef);
}

async function updateDbData(dataRef, values) {
    const { update: fbUpdate } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
    return fbUpdate(dataRef, values);
}

// Export functions that pages might need to call directly or use
export { 
    auth, database, 
    DOMElements, 
    showAlert, showConfirm, 
    editIconSVG, deleteIconSVG,
    getDbData, updateDbData,
    initializeAuth,
    // Firebase methods if needed directly by page-specific logic, though prefer passing them via callback
    ref, push, set, remove, serverTimestamp, query, orderByChild, equalTo
}; 