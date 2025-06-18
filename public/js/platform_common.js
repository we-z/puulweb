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

// DOM Elements Cache (Common) - some will be populated by initializeSidebar
const DOMElements = {
    customAlertModal: null, // This is the container, will be #customAlertModal
    customAlertMessage: null, // This will be the <p> tag inside .custom-alert
    customConfirmModal: null,
    customConfirmTitle: null,
    customConfirmMessage: null,
    customConfirmOk: null,
    customConfirmCancel: null,
    closeButtons: null,
    welcomeMessage: null, // Populated in initializeSidebar
    signOutBtn: null      // Populated in initializeSidebar
};

// --- Sidebar Generation & Toggle ---
function generateSidebarHTML(activePage) {
    const pages = [
        { name: 'Dashboard', href: '/platform_dashboard.html', icon: '📊' },
        { name: 'Calendar', href: '/platform_calendar.html', icon: '📅' },
        { name: 'Leasing', href: '/platform_leasing.html', icon: '🔑' },
        { name: 'Properties', href: '/platform_properties.html', icon: '🏠' },
        { name: 'People', href: '/platform_people.html', icon: '👥' },
        { name: 'Accounting', href: '/platform_accounting.html', icon: '💰' },
        { name: 'Maintenance', href: '/platform_maintenance.html', icon: '🛠️' },
        { name: 'Reporting', href: '/platform_reporting.html', icon: '📄' },
        { name: 'Communication', href: '/platform_communication.html', icon: '💬' },
        { name: 'Settings', href: '/platform_settings.html', icon: '⚙️' }
    ];

    let navLinks = '';
    pages.forEach(page => {
        const isActive = activePage === page.href;
        navLinks += `<li><a href="${page.href}" class="${isActive ? 'active' : ''}"><span class="icon">${page.icon}</span><span class="link-text">${page.name}</span></a></li>`;
    });

    return `
        <div class="sidebar">
            <div class="sidebar-header">
                <a href="/platform_dashboard.html" class="logo">
                    <img src="https://firebasestorage.googleapis.com/v0/b/puul-app.appspot.com/o/puul-logo.svg?alt=media&token=aac48fcb-cc8d-4af8-9744-c7eca1e7cf04" alt="Puul Logo">
                    <h1 class="logo-text">Puul</h1>
                </a>
            </div>
            <ul class="nav-menu">
                ${navLinks}
            </ul>
            <div class="user-profile">
                <div class="user-info">
                     <div class="welcome-message" id="welcomeMessage">Loading user...</div>
                     <button class="sign-out-btn" id="signOutBtn">Sign Out</button>
                </div>
            </div>
        </div>
    `;
}

// Wrapped in a function to be called on DOMContentLoaded
function setupPageLayoutAndInteractivity() {
    console.log('[platform_common.js] Executing setupPageLayoutAndInteractivity for page:', window.location.pathname);
    const sidebarContainer = document.getElementById('sidebar-container');
    console.log('[platform_common.js] Found #sidebar-container:', sidebarContainer);
    const contentHeader = document.querySelector('.content-header');
    console.log('[platform_common.js] Found .content-header:', contentHeader);

    if (!sidebarContainer) {
        console.error('[platform_common.js] CRITICAL: Sidebar container #sidebar-container not found in the DOM for page:', window.location.pathname);
        return;
    }
    if (!contentHeader) {
        console.error('[platform_common.js] CRITICAL: Content header .content-header not found in the DOM for page:', window.location.pathname);
        return;
    }

    const currentPage = window.location.pathname;
    sidebarContainer.innerHTML = generateSidebarHTML(currentPage);
    
    const sidebar = sidebarContainer.querySelector('.sidebar');
    if (!sidebar) {
        console.error('Dynamically generated .sidebar element not found after injection.');
        return;
    }

    let menuToggleBtn = document.getElementById('sidebarToggleBtn');
    if (!menuToggleBtn) {
        menuToggleBtn = document.createElement('button');
        menuToggleBtn.id = 'sidebarToggleBtn';
        menuToggleBtn.classList.add('sidebar-toggle-btn');
        menuToggleBtn.setAttribute('aria-label', 'Toggle sidebar');
        menuToggleBtn.setAttribute('aria-expanded', 'true');
        menuToggleBtn.innerHTML = `<div class="menu-icon"><span></span><span></span><span></span></div>`;
        contentHeader.insertBefore(menuToggleBtn, contentHeader.firstChild);
    }

    menuToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        menuToggleBtn.classList.toggle('open', isCollapsed);
        menuToggleBtn.setAttribute('aria-expanded', !isCollapsed);
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        document.body.classList.toggle('sidebar-is-collapsed', isCollapsed);

        // On mobile, when sidebar is open (not collapsed), ensure it has transform: translateX(0)
        // and when it is collapsed, it has transform: translateX(-100%)
        // The CSS handles this via :not(.collapsed) and .collapsed selectors within the media query.
        // No explicit JS style change for transform is needed here due to the CSS setup.
    });

    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
        menuToggleBtn.classList.add('open');
        menuToggleBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.add('sidebar-is-collapsed');
    } else {
        sidebar.classList.remove('collapsed'); // Ensure it's not collapsed by default if no local storage state
        menuToggleBtn.classList.remove('open');
        menuToggleBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.remove('sidebar-is-collapsed');
    }

    DOMElements.welcomeMessage = document.getElementById('welcomeMessage');
    DOMElements.signOutBtn = document.getElementById('signOutBtn');

    if (DOMElements.signOutBtn) {
        DOMElements.signOutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                sessionStorage.removeItem('puulUserDisplayName');
            } catch (error) {
                console.error('Error signing out:', error);
                showAlert('Error signing out. Please try again.', 'Sign Out Error');
            }
        });
    }

    if (cachedUserDisplayName && DOMElements.welcomeMessage) {
        DOMElements.welcomeMessage.textContent = `Welcome, ${cachedUserDisplayName}!`;
    }
    
    // Initialize common modal elements after sidebar is definitely there
    DOMElements.customAlertModal = document.getElementById('customAlertModal');
    // Adjust to find the message paragraph within the new structure
    if (DOMElements.customAlertModal) {
        DOMElements.customAlertMessage = DOMElements.customAlertModal.querySelector('.custom-alert p'); 
    }
    DOMElements.customAlertTitle = null; // Title is no longer used for alerts

    DOMElements.customConfirmModal = document.getElementById('customConfirmModal');
    DOMElements.customConfirmTitle = document.getElementById('customConfirmTitle');
    DOMElements.customConfirmMessage = document.getElementById('customConfirmMessage');
    DOMElements.customConfirmOk = document.getElementById('customConfirmOk');
    DOMElements.customConfirmCancel = document.getElementById('customConfirmCancel');
    DOMElements.closeButtons = document.querySelectorAll('.close-btn, .cancel-btn, .ok-btn');

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
}

// Helper function to initialize custom dropdowns
function initializeCustomDropdown(dropdownElement, onChangeCallback, isDynamic = false) {
    if (!dropdownElement) return;

    const textInput = dropdownElement.querySelector('.dropdown-input');
    const menu = dropdownElement.querySelector('.dropdown-menu');
    const optionsContainer = menu.querySelector('.dropdown-options');
    // The hidden input is now expected to be a sibling of the dropdown container, not inside.
    // Let's find it in the parent form group.
    const hiddenInput = dropdownElement.closest('.form-group').querySelector('input[type="hidden"]');
    
    if (!textInput || !menu || !optionsContainer || !hiddenInput) {
        console.error('Custom dropdown is missing required elements (input, menu, options, hidden input).', dropdownElement);
        return;
    }

    const showMenu = () => {
        dropdownElement.classList.add('open');
        menu.style.visibility = 'visible';
        menu.style.opacity = '1';
        menu.style.transform = 'translateY(0)';
        menu.style.pointerEvents = 'auto';
    };

    const hideMenu = () => {
        dropdownElement.classList.remove('open');
        menu.style.opacity = '0';
        menu.style.transform = 'translateY(-10px)';
        // Let transition finish before hiding completely
        setTimeout(() => {
            menu.style.visibility = 'hidden';
            menu.style.pointerEvents = 'none';
        }, 150);
    };

    const filterOptions = () => {
        const filter = textInput.value.toLowerCase();
        let hasVisibleOptions = false;
        optionsContainer.querySelectorAll('.dropdown-option').forEach(option => {
            const text = option.textContent.toLowerCase();
            const isVisible = text.includes(filter);
            option.style.display = isVisible ? '' : 'none';
            if (isVisible) hasVisibleOptions = true;
        });
        return hasVisibleOptions;
    };

    textInput.addEventListener('focus', () => {
        // Show all options on focus, then filter.
        optionsContainer.querySelectorAll('.dropdown-option').forEach(opt => opt.style.display = '');
        showMenu();
    });

    textInput.addEventListener('input', () => {
        hiddenInput.value = ''; // Clear hidden value if user is typing a new value
        if (filterOptions()) {
            showMenu();
        } else {
            hideMenu();
        }
    });

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideMenu();
        }
    });

    optionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('dropdown-option')) {
            const option = e.target;
            textInput.value = option.textContent;
            hiddenInput.value = option.dataset.value;

            hideMenu();

            if (onChangeCallback && typeof onChangeCallback === 'function') {
                onChangeCallback(option.dataset.value, option.textContent);
            }
        }
    });

    // Add a global click listener to close dropdowns.
    // A single listener is more efficient than one per dropdown.
    if (!document.body.hasAttribute('data-global-dropdown-listener')) {
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.custom-dropdown.open').forEach(openDropdown => {
                if (!openDropdown.contains(e.target)) {
                    // Find the associated menu and hide it.
                    const menuToHide = openDropdown.querySelector('.dropdown-menu');
                    if (menuToHide) {
                         openDropdown.classList.remove('open');
                         menuToHide.style.opacity = '0';
                         menuToHide.style.transform = 'translateY(-10px)';
                         setTimeout(() => {
                             menuToHide.style.visibility = 'hidden';
                             menuToHide.style.pointerEvents = 'none';
                         }, 150);
                    }
                }
            });
        });
        document.body.setAttribute('data-global-dropdown-listener', 'true');
    }
}

const editIconSVG = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg>`;
const deleteIconSVG = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>`;

// --- Custom Alert & Confirm ---
let alertTimeout = null; // Keep track of the timeout

function showAlert(message, title = "Notification") { // title argument is now ignored and will be removed in usage
    if (!DOMElements.customAlertModal || !DOMElements.customAlertMessage) {
        console.warn('Custom alert elements not found. DOM not ready or element missing?');
        window.alert(message); // Fallback to browser alert
        return;
    }

    // Clear any existing timeout to prevent premature hiding if showAlert is called multiple times
    if (alertTimeout) {
        clearTimeout(alertTimeout);
    }

    const alertBox = DOMElements.customAlertModal.querySelector('.custom-alert');
    if (!alertBox) {
        console.warn('.custom-alert box not found within #customAlertModal');
        window.alert(message); // Fallback
        return;
    }

    DOMElements.customAlertMessage.textContent = message;
    
    // Make sure it's initially not shown by class, then trigger show
    alertBox.classList.remove('show');
    alertBox.style.display = 'block'; // Or 'flex' if your .custom-alert needs it

    // Timeout to allow display property to take effect before adding class for transition
    setTimeout(() => {
        alertBox.classList.add('show');
    }, 20); // Small delay

    // Set a timeout to hide the modal by removing the .show class
    alertTimeout = setTimeout(() => {
        alertBox.classList.remove('show');
        // After the transition out (0.25s), set display to none
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 250); // Matches CSS transition duration
    }, 3000); // Total visible time before starting to fade out
}

function showConfirm(message, title = "Confirm Action") {
    if (!DOMElements.customConfirmModal) {
        console.warn('Custom confirm modal not found in DOMElements. DOM not ready or element missing?');
        return Promise.resolve(false);
    }
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

// --- Firebase Auth & Initialization Hook (to be called by each page) ---
function initializeAuth(pageSpecificInitCallback) {
    // Defer layout setup until DOM is ready
    document.addEventListener('DOMContentLoaded', setupPageLayoutAndInteractivity);

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            const displayName = user.displayName || user.email.split('@')[0];
            cachedUserDisplayName = displayName;
            sessionStorage.setItem('puulUserDisplayName', displayName);

            // Add/update user in the public /users directory for messaging user search
            const userPublicRef = ref(database, 'users/' + user.uid);
            update(userPublicRef, {
                displayName: displayName,
                email: user.email,
                uid: user.uid
            }).catch(error => console.error("Failed to update user in public directory", error));

            // Ensure welcome message is updated after DOM might have been populated by setupPageLayoutAndInteractivity
            if (DOMElements.welcomeMessage) {
                DOMElements.welcomeMessage.textContent = `Welcome, ${displayName}!`;
            } else {
                // If setupPageLayoutAndInteractivity hasn't run yet, try to update when it does
                document.addEventListener('DOMContentLoaded', () => {
                    if(DOMElements.welcomeMessage) DOMElements.welcomeMessage.textContent = `Welcome, ${displayName}!`;
                });
            }

            if (pageSpecificInitCallback && typeof pageSpecificInitCallback === 'function') {
                pageSpecificInitCallback(user.uid, database, ref, push, set, remove, serverTimestamp, query, orderByChild, equalTo, getDbData, updateDbData, showAlert, showConfirm, editIconSVG, deleteIconSVG, initializeCustomDropdown);
            }
        } else {
            currentUserId = null;
            sessionStorage.removeItem('puulUserDisplayName');
            window.location.href = '/';
        }
    });
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

// Ensure DOMElements is globally accessible for initializeCustomDropdown if it's not already
if (typeof window.DOMElements === 'undefined') {
    window.DOMElements = DOMElements;
}

export { 
    auth, database, 
    DOMElements, 
    showAlert, showConfirm, 
    editIconSVG, deleteIconSVG,
    getDbData, updateDbData,
    initializeAuth,
    ref, push, set, remove, serverTimestamp, query, orderByChild, equalTo,
    initializeCustomDropdown
}; 