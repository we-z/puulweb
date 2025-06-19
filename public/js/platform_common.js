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

// --- AI Agent Sidebar ---
const AI_DOMElements = {
    container: null,
    toggleBtn: null,
    chatArea: null,
    input: null,
    sendBtn: null,
    agent: null
};

function generateAgentSidebarHTML() {
    return `
        <div class="ai-agent">
            <div class="ai-agent-header">
                <h5>AI Agent</h5>
            </div>
            <div class="ai-chat-area">
                <div class="ai-message agent">
                    <div class="avatar">AI</div>
                    <div class="message-content">
                        <p>Hello! How can I help you manage your properties today?</p>
                    </div>
                </div>
            </div>
            <div class="ai-input-area">
                <textarea id="ai-message-input" placeholder="Ask me anything..." rows="1"></textarea>
                <button id="ai-send-btn" title="Send">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                </button>
            </div>
        </div>
    `;
}

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
    const mainContent = document.querySelector('.main-content'); // Get main content
    console.log('[platform_common.js] Found #sidebar-container:', sidebarContainer);
    const contentHeader = document.querySelector('.content-header');
    console.log('[platform_common.js] Found .content-header:', contentHeader);

    if (!sidebarContainer || !mainContent) {
        console.error('[platform_common.js] CRITICAL: Sidebar container or Main Content not found in the DOM for page:', window.location.pathname);
        return;
    }
    if (!contentHeader) {
        console.error('[platform_common.js] CRITICAL: Content header .content-header not found in the DOM for page:', window.location.pathname);
        return;
    }

    const currentPage = window.location.pathname;
    sidebarContainer.innerHTML = generateSidebarHTML(currentPage);
    
    // --- Inject and Setup AI Agent Sidebar ---
    AI_DOMElements.container = document.getElementById('ai-agent-container');
    if (AI_DOMElements.container) {
        AI_DOMElements.container.innerHTML = generateAgentSidebarHTML();

        AI_DOMElements.agent = document.querySelector('.ai-agent');
        AI_DOMElements.chatArea = document.querySelector('.ai-chat-area');
        AI_DOMElements.input = document.getElementById('ai-message-input');
        AI_DOMElements.sendBtn = document.getElementById('ai-send-btn');

        if (!document.getElementById('aiAgentToggleBtn')) {
            AI_DOMElements.toggleBtn = document.createElement('button');
            AI_DOMElements.toggleBtn.id = 'aiAgentToggleBtn';
            AI_DOMElements.toggleBtn.className = 'ai-agent-toggle-btn';
            AI_DOMElements.toggleBtn.innerHTML = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>`;
            document.body.appendChild(AI_DOMElements.toggleBtn);
            
            AI_DOMElements.toggleBtn.addEventListener('click', () => {
                const isOpened = !AI_DOMElements.agent.classList.toggle('collapsed');
                document.documentElement.classList.toggle('ai-agent-is-open', isOpened);
                localStorage.setItem('aiAgentCollapsed', !isOpened);
            });
        }

        // --- Restore AI Agent Sidebar State on Page Load ---
        if (localStorage.getItem('aiAgentCollapsed') !== 'false') { // Default to collapsed
            AI_DOMElements.agent.classList.add('collapsed');
        } else {
            AI_DOMElements.agent.classList.remove('collapsed');
        }

        if(AI_DOMElements.sendBtn) {
            const handleSend = () => {
                const query = AI_DOMElements.input.value.trim();
                if (query) {
                    addMessageToChat(query, 'user');
                    handleAgentQuery(query);
                    AI_DOMElements.input.value = '';
                    AI_DOMElements.input.style.height = '20px';
                }
            };
            AI_DOMElements.sendBtn.addEventListener('click', handleSend);
            AI_DOMElements.input.addEventListener('keypress', (e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            });
            AI_DOMElements.input.addEventListener('input', () => {
                AI_DOMElements.input.style.height = 'auto';
                AI_DOMElements.input.style.height = (AI_DOMElements.input.scrollHeight) + 'px';
            });
        }
    } else {
        console.warn('[platform_common.js] AI Agent container #ai-agent-container not found. The AI sidebar will not be loaded.');
    }

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
        document.documentElement.classList.toggle('sidebar-is-collapsed', isCollapsed);
    });

    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
        menuToggleBtn.classList.add('open');
        menuToggleBtn.setAttribute('aria-expanded', 'false');
    } else {
        sidebar.classList.remove('collapsed');
        menuToggleBtn.classList.remove('open');
        menuToggleBtn.setAttribute('aria-expanded', 'true');
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

    // Remove the FOUC-prevention class now that the JS has loaded and can take over.
    document.documentElement.classList.remove('js-loading');
}

// --- AI Agent Chat Logic ---
function addMessageToChat(content, type, isSuggestion = false) {
    if (!AI_DOMElements.chatArea) return;

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('ai-message', type);
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = type === 'user' ? 'You' : 'AI';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    if (isSuggestion) {
        messageContent.innerHTML = content; // content is pre-formatted HTML for suggestions
    } else {
        const p = document.createElement('p');
        p.style.margin = 0;
        p.textContent = content;
        messageContent.appendChild(p);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    AI_DOMElements.chatArea.appendChild(messageDiv);
    AI_DOMElements.chatArea.scrollTop = AI_DOMElements.chatArea.scrollHeight;
}

function handleAgentQuery(query) {
    const lowerQuery = query.toLowerCase();
    let response = "I'm sorry, I don't understand that command. You can ask me to 'show open work orders' or 'create a new tenant'.";
    let isSuggestion = false;

    if (lowerQuery.includes('show open work orders')) {
        response = `
            <p>I can filter the table to show only 'Open' work orders.</p>
            <div class="suggestion-card">
                <div class="suggestion-actions">
                    <button class="btn-secondary cancel-btn">Reject</button>
                    <button class="btn-primary submit-btn" id="suggest-filter-wo">Accept</button>
                </div>
            </div>`;
        isSuggestion = true;

        // Add event listener for the accept button.
        // Use event delegation on chatArea for dynamically added buttons
        setTimeout(() => { // Use timeout to ensure button is in DOM
            document.getElementById('suggest-filter-wo')?.addEventListener('click', () => {
                showAlert("Filtering for open work orders.");
                // This is a mock action. In a real app, this would trigger the filter logic.
                const statusFilter = document.querySelector('#customFilterStatus .selected-value');
                if (statusFilter) {
                    statusFilter.textContent = 'Open';
                    // In a real app, you would also programmatically trigger the filter change event.
                }
            });
        }, 0);

    } else if (lowerQuery.includes('create a new tenant')) {
        response = `
            <p>I can open the 'Add New Tenant' form for you.</p>
            <div class="suggestion-card">
                 <div class="suggestion-actions">
                    <button class="btn-secondary cancel-btn">Reject</button>
                    <button class="btn-primary submit-btn" id="suggest-open-tenant-modal">Accept</button>
                </div>
            </div>`;
        isSuggestion = true;
         setTimeout(() => {
            document.getElementById('suggest-open-tenant-modal')?.addEventListener('click', () => {
                const addBtn = document.getElementById('addItemBtn');
                const subNav = document.querySelector('#peopleSubNav .sub-nav-item[data-subsection="tenants"]');
                if(addBtn && subNav) {
                    // Switch to tenants tab and open modal. This is a mock action.
                    // In real app, you'd navigate and then click. For now, just alert.
                     showAlert("Opening new tenant modal...");
                } else {
                    showAlert("Could not find the button to perform this action.", "Error");
                }
            });
        }, 0);
    }
    
    // Simulate thinking time
    setTimeout(() => {
        addMessageToChat(response, 'agent', isSuggestion);
    }, 500);
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

// Helper function to initialize simple dropdowns (without text input)
function initializeSimpleDropdown(dropdownElement, onChangeCallback) {
    if (!dropdownElement) return;

    const selectedElement = dropdownElement.querySelector('.dropdown-selected');
    const selectedValueSpan = dropdownElement.querySelector('.selected-value');
    const optionsContainer = dropdownElement.querySelector('.dropdown-options');
    
    if (!selectedElement || !selectedValueSpan || !optionsContainer) {
        console.error('Simple dropdown is missing required elements.', dropdownElement);
        return;
    }

    const toggleDropdown = () => {
        const isOpen = dropdownElement.classList.contains('open');
        if (isOpen) {
            dropdownElement.classList.remove('open');
        } else {
            dropdownElement.classList.add('open');
        }
    };

    selectedElement.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });

    selectedElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown();
        } else if (e.key === 'Escape' && dropdownElement.classList.contains('open')) {
            dropdownElement.classList.remove('open');
        }
    });

    optionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.dropdown-option');
        if (option) {
            // Update selected value
            selectedValueSpan.textContent = option.textContent;
            dropdownElement.dataset.value = option.dataset.value;
            
            // Update selected state
            optionsContainer.querySelectorAll('.dropdown-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
            
            // Close dropdown
            dropdownElement.classList.remove('open');
            
            // Call callback if provided
            if (onChangeCallback && typeof onChangeCallback === 'function') {
                onChangeCallback(option.dataset.value, option.textContent);
            }
        }
    });

    // Add a global click listener to close dropdowns
    if (!document.body.hasAttribute('data-global-simple-dropdown-listener')) {
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.custom-dropdown.open').forEach(openDropdown => {
                if (!openDropdown.contains(e.target)) {
                    openDropdown.classList.remove('open');
                }
            });
        });
        document.body.setAttribute('data-global-simple-dropdown-listener', 'true');
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
    document.addEventListener('DOMContentLoaded', () => {
        // Remove the FOUC-prevention class now that the JS has loaded and can take over.
        document.documentElement.classList.remove('js-loading');
        setupPageLayoutAndInteractivity();
    });

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
    initializeCustomDropdown,
    initializeSimpleDropdown
}; 