import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getDatabase, ref, push, set, remove, serverTimestamp, query, orderByChild, equalTo, get, update } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';

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
const functions = getFunctions(app);
const database = getDatabase(app);
let currentUserId = null;
let cachedUserDisplayName = sessionStorage.getItem('puulUserDisplayName');
let currentUserPlan = null;

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

let conversationHistory = [];
let conversationId = null;
let currentPageContext = 'unknown'; // This will be set on each page load

function generateSystemPrompt() {
    return `You are an AI assistant for a property management platform called Puul. Your name is 'Puul'. You are an expert property manager. Be concise and helpful. When a user's request can be fulfilled by one of your tools, you must call that tool directly. Do not first respond with text explaining what you will do. For example, if asked to 'go to the leasing page', use the navigateToPage tool immediately. The user is currently on the '${currentPageContext}' page. Do not use markdown in your response.`;
}

function initializeConversation() {
    console.log('[AI Agent] Initializing conversation. Current User ID:', currentUserId);
    conversationId = sessionStorage.getItem('aiCurrentConversationId');
    if (conversationId) {
        // Load existing conversation from Firebase
        const historyRef = ref(database, `aiConversations/${currentUserId}/${conversationId}`);
        get(historyRef).then((snapshot) => {
            if (snapshot.exists()) {
                conversationHistory = snapshot.val();
                 // Ensure the system prompt is up-to-date with the current page context
                conversationHistory[0].parts[0].text = generateSystemPrompt();
                renderConversation(conversationHistory);
            } else {
                startNewConversation();
            }
        });
    } else {
        startNewConversation();
    }
}

function startNewConversation() {
    conversationHistory = [
        { "role": "user", "parts": [{ "text": generateSystemPrompt() }] }
    ];
    // Generate a new ID for the conversation
    const newConversationRef = push(ref(database, `aiConversations/${currentUserId}`));
    conversationId = newConversationRef.key;
    sessionStorage.setItem('aiCurrentConversationId', conversationId);
    
    // Save the initial state to the new conversation ID
    set(newConversationRef, conversationHistory);
    renderConversation(conversationHistory);

    // If the agent panel is collapsed, expand it to make input visible.
    if (AI_DOMElements.agent && AI_DOMElements.agent.classList.contains('collapsed')) {
        AI_DOMElements.toggleBtn.click();
    }

    // Focus the input field for immediate typing.
    if (AI_DOMElements.input) {
        AI_DOMElements.input.focus();
    }
}

function generateAgentSidebarHTML() {
    return `
        <div class="ai-agent">
            <div class="ai-resizer"></div>
            <div class="ai-agent-header">
                <h5>AI Agent</h5>
                <div class="ai-header-buttons">
                    <div id="ai-history-container" class="custom-dropdown">
                        <button id="ai-history-btn" class="ai-header-btn" title="Chat History">
                            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor">
                               <path d="M0 0h24v24H0z" fill="none"/>
                               <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.41 1.41C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                            </svg>
                        </button>
                         <!-- Dropdown menu will be injected here -->
                    </div>
                    <button id="ai-new-chat-btn" class="ai-header-btn" title="New Chat">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="ai-chat-area">
            </div>
            <div class="ai-input-area">
                <textarea id="ai-message-input" placeholder="Ask me anything..." rows="1"></textarea>
                <button id="ai-send-btn" title="Send">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 13a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V12.5a.5.5 0 0 0 .5.5z"/></svg>
                </button>
            </div>
        </div>
    `;
}

function initializeAgentResizer(agentElement) {
    const resizer = agentElement.querySelector('.ai-resizer');
    if (!resizer) return;

    let isResizing = false;
    let startX, startWidth;

    const handleMouseDown = (e) => {
        // Only trigger on left-click
        if (e.button !== 0) return;
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(agentElement).width, 10);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (!isResizing) return;
        const dx = e.clientX - startX;
        let newWidth = startWidth - dx; // Dragging left decreases x, so we subtract dx to increase width

        // Add constraints
        if (newWidth < 250) newWidth = 250;
        if (newWidth > 800) newWidth = 800;

        agentElement.style.width = `${newWidth}px`;
        updateDynamicStyles(newWidth);
    };

    const handleMouseUp = () => {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // Save the new width
        if (agentElement.style.width) {
            localStorage.setItem('aiAgentWidth', agentElement.style.width);
        }
    };

    resizer.addEventListener('mousedown', handleMouseDown);

    function updateDynamicStyles(agentWidth) {
        let styleSheet = document.getElementById('ai-dynamic-styles');
        if (!styleSheet) {
            styleSheet = document.createElement('style');
            styleSheet.id = 'ai-dynamic-styles';
            document.head.appendChild(styleSheet);
        }
    }

    // Initial style update
    const initialWidth = parseInt(document.defaultView.getComputedStyle(agentElement).width, 10);
    updateDynamicStyles(initialWidth);
}

function renderConversation(history) {
    if (!AI_DOMElements.chatArea) return;
    // Clear existing messages
    AI_DOMElements.chatArea.innerHTML = '';

    // Skip the system prompt message at history[0].
    const messagesToRender = history.slice(1);

    if (messagesToRender.length === 0) {
        AI_DOMElements.chatArea.innerHTML = `
            <div class="ai-chat-placeholder">
                <p>Ask Puul anything to get started.</p>
                <svg class="down-arrow-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </div>
        `;
        return;
    }

    messagesToRender.forEach(message => {
        if (message.role === 'user') {
            addMessageToChat(message.parts[0].text, 'user');
        } else if (message.role === 'model') {
            const part = message.parts[0];
            if (part.text) {
                const existingLoading = AI_DOMElements.chatArea.querySelector('.loading-dots');
                if(existingLoading) existingLoading.closest('.ai-message').remove();
                addMessageToChat(part.text, 'agent');
            } else if (part.functionCall) {
                const toolName = part.functionCall.name;
                const toolArgs = part.functionCall.args;
                // Using a simple gear emoji to avoid all SVG rendering and cropping issues.
                const toolEmoji = '⚙️';
                const toolDisplay = `
                    <div class="tool-call" style="padding: 12px; background-color: rgba(0,0,0,0.05); border-radius: 8px;">
                        <div class="tool-call-header" style="display: flex; align-items: center; font-weight: 500; color: #333;">
                            <span style="font-size: 1.3em; margin-right: 8px; line-height: 1;">${toolEmoji}</span>
                            <span>Using tool: <strong>${toolName}</strong></span>
                        </div>
                        <pre class="tool-args" style="background-color: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; padding: 8px; margin-top: 8px; font-family: monospace; font-size: 0.85em; white-space: pre-wrap; word-break: break-all;"><code>${JSON.stringify(toolArgs, null, 2)}</code></pre>
                    </div>
                `;
                addMessageToChat(toolDisplay, 'agent', true);
            }
        }
        // We explicitly do not render function *responses* to keep the chat clean.
    });
}

// --- Sidebar Generation & Toggle ---
function generateSidebarHTML(activePage) {
    const pages = [
        { name: 'Dashboard', href: '/platform_dashboard.html', icon: '📊', plan: 'core' },
        { name: 'Calendar', href: '/platform_calendar.html', icon: '📅', plan: 'core' },
        { name: 'Leasing', href: '/platform_leasing.html', icon: '🔑', plan: 'core' },
        { name: 'Properties', href: '/platform_properties.html', icon: '🏠', plan: 'core' },
        { name: 'People', href: '/platform_people.html', icon: '👥', plan: 'core' },
        { name: 'Accounting', href: '/platform_accounting.html', icon: '💰', plan: 'core' },
        { name: 'Maintenance', href: '/platform_maintenance.html', icon: '🛠️', plan: 'core' },
        { name: 'Reporting', href: '/platform_reporting.html', icon: '📄', plan: 'core' },
        { name: 'Communication', href: '/platform_communication.html', icon: '💬', plan: 'core' },
        { name: 'Settings', href: '/platform_settings.html', icon: '⚙️', plan: 'core' }
    ];

    let navLinks = '';
    pages.forEach(page => {
        if (hasAccess(page.plan)) {
            const isActive = activePage === page.href;
            navLinks += `<li><a href="${page.href}" class="${isActive ? 'active' : ''}"><span class="icon">${page.icon}</span><span class="link-text">${page.name}</span></a></li>`;
        }
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
    const filledSparkleIcon = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10,0 Q11.75,8.25,20,10 Q11.75,11.75,10,20 Q8.25,11.75,0,10 Q8.25,8.25,10,0 Z" /></svg>`;
    const outlineSparkleIcon = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10,0 Q11.75,8.25,20,10 Q11.75,11.75,10,20 Q8.25,11.75,0,10 Q8.25,8.25,10,0 Z" stroke-linejoin="round" stroke-linecap="round" /></svg>`;
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

        initializeAgentResizer(AI_DOMElements.agent);

        AI_DOMElements.chatArea = document.querySelector('.ai-chat-area');
        AI_DOMElements.input = document.getElementById('ai-message-input');
        AI_DOMElements.sendBtn = document.getElementById('ai-send-btn');
        const newChatBtn = document.getElementById('ai-new-chat-btn');
        const historyBtn = document.getElementById('ai-history-btn');
        
        // Defer conversation loading until user is confirmed
        // initializeConversation(); 

        if (newChatBtn) {
            newChatBtn.addEventListener('click', startNewConversation);
        }

        if (historyBtn) {
            historyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleHistoryDropdown();
            });
        }

        // --- AI Agent Toggle Button ---
        if (!document.getElementById('aiAgentToggleBtn')) {
            AI_DOMElements.toggleBtn = document.createElement('button');
            AI_DOMElements.toggleBtn.id = 'aiAgentToggleBtn';
            AI_DOMElements.toggleBtn.className = 'ai-agent-toggle-btn';
            
            // Set initial icon state when creating the button, before adding the event listener.
            const isInitiallyCollapsed = localStorage.getItem('aiAgentCollapsed') !== 'false';
            AI_DOMElements.toggleBtn.innerHTML = isInitiallyCollapsed ? outlineSparkleIcon : filledSparkleIcon;
            
            // Create a wrapper for both toggle buttons
            let toggleWrapper = contentHeader.querySelector('.toggle-button-wrapper');
            if (!toggleWrapper) {
                toggleWrapper = document.createElement('div');
                toggleWrapper.className = 'toggle-button-wrapper';
                toggleWrapper.style.display = 'flex';
                toggleWrapper.style.alignItems = 'center';
                toggleWrapper.style.gap = '10px';
                contentHeader.appendChild(toggleWrapper);
            }
            toggleWrapper.appendChild(AI_DOMElements.toggleBtn);

            AI_DOMElements.toggleBtn.addEventListener('click', () => {
                const agent = AI_DOMElements.agent;
                const isCurrentlyCollapsed = agent.classList.contains('collapsed');

                if (isCurrentlyCollapsed) {
                    // --- EXPANDING ---
                    agent.classList.remove('collapsed');
                    AI_DOMElements.toggleBtn.innerHTML = filledSparkleIcon; // Change to filled icon when open
                    // Restore width from localStorage
                    const savedWidth = localStorage.getItem('aiAgentWidth');
                    if (savedWidth) {
                        agent.style.width = savedWidth;
                    }
                    document.documentElement.classList.add('ai-agent-is-open');
                    localStorage.setItem('aiAgentCollapsed', 'false');
                } else {
                    // --- COLLAPSING ---
                    // Clear the inline style so the .collapsed class's width can take over.
                    // The resizer already saved the width to localStorage on mouse up.
                    agent.style.width = '';
                    agent.classList.add('collapsed');
                    AI_DOMElements.toggleBtn.innerHTML = outlineSparkleIcon; // Change to outline icon when closed
                    document.documentElement.classList.remove('ai-agent-is-open');
                    localStorage.setItem('aiAgentCollapsed', 'true');
                }
            });
        }

        // --- Restore AI Agent Sidebar State on Page Load ---
        const isCollapsedOnLoad = localStorage.getItem('aiAgentCollapsed') !== 'false';
        AI_DOMElements.agent.classList.toggle('collapsed', isCollapsedOnLoad);
        document.documentElement.classList.toggle('ai-agent-is-open', !isCollapsedOnLoad);

        if (!isCollapsedOnLoad) {
            // Restore width only if it's not supposed to be collapsed
            const savedWidth = localStorage.getItem('aiAgentWidth');
            if (savedWidth) {
                AI_DOMElements.agent.style.width = savedWidth;
            }
        }

        if(AI_DOMElements.sendBtn) {
            const handleSend = () => {
                const query = AI_DOMElements.input.value.trim();
                if (query) {
                    // If placeholder is visible, clear the chat area before adding the first message.
                    const placeholder = AI_DOMElements.chatArea.querySelector('.ai-chat-placeholder');
                    if (placeholder) {
                        AI_DOMElements.chatArea.innerHTML = '';
                    }

                    addMessageToChat(query, 'user');
                    conversationHistory.push({ role: "user", parts: [{ text: query }] });
                    set(ref(database, `aiConversations/${currentUserId}/${conversationId}`), conversationHistory);
                    handleAgentQuery(conversationHistory);
                    AI_DOMElements.input.value = '';
                    AI_DOMElements.input.style.height = 'auto';
                    AI_DOMElements.input.style.height = (AI_DOMElements.input.scrollHeight) + 'px';
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
        
        // Place the button directly in the header, before the title.
        const titleElement = contentHeader.querySelector('h2');
        if (titleElement) {
            titleElement.insertAdjacentElement('beforebegin', menuToggleBtn);
        } else {
            // Fallback: if no h2, put it at the start of the header.
            contentHeader.prepend(menuToggleBtn);
        }
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

    // Initialize resizable tables
    initializeResizableTables();
}

// --- AI Agent Chat Logic ---
function addMessageToChat(content, type, isSuggestion = false) {
    if (!AI_DOMElements.chatArea) return;

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('ai-message', type);

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    if (isSuggestion) {
        messageContent.innerHTML = content; // content is pre-formatted HTML for suggestions
    } else {
        const p = document.createElement('p');
        p.style.margin = 0;
        p.innerHTML = content.replace(/\n/g, '<br>'); // Support line breaks
        messageContent.appendChild(p);
    }
    
    messageDiv.appendChild(messageContent);
    AI_DOMElements.chatArea.appendChild(messageDiv);
    AI_DOMElements.chatArea.scrollTop = AI_DOMElements.chatArea.scrollHeight;

    return messageDiv;
}

async function handleAgentQuery(history) {
    const loadingMessage = addMessageToChat('<div class="loading-dots"><span></span><span></span><span></span></div>', 'agent', true);
    AI_DOMElements.sendBtn.disabled = true;
    AI_DOMElements.input.disabled = true;

    try {
        const generateGeminiResponse = httpsCallable(functions, 'generateGeminiResponse');
        // The history sent to the function is now the single source of truth.
        const result = await generateGeminiResponse({ history: history });

        loadingMessage.remove();

        // The server returns the complete, updated history.
        // We replace our local history with the authoritative one from the server.
        const serverHistory = result.data.updatedHistory;
        if (serverHistory) {
            conversationHistory = serverHistory;
            // Save the complete history to Firebase.
            set(ref(database, `aiConversations/${currentUserId}/${conversationId}`), conversationHistory);

            // Find if a tool was used in the latest turn to provide better UX
            let lastUserIndex = -1;
            for (let i = serverHistory.length - 1; i >= 0; i--) {
                if (serverHistory[i].role === 'user') {
                    lastUserIndex = i;
                    break;
                }
            }
            const turnHistory = lastUserIndex !== -1 ? serverHistory.slice(lastUserIndex) : [];
            const functionCallMsg = turnHistory.find(msg => msg.role === 'model' && msg.parts[0].functionCall);

            if (functionCallMsg) {
                // A tool was used. Animate the display for better UX.
                const toolName = functionCallMsg.parts[0].functionCall.name;
                const toolLoadingMessage = addMessageToChat(
                    `<div style="display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 4px;">
                        <div>Calling <strong>${toolName}</strong></div>
                        <div class="loading-dots" style="margin: 0 auto;"><span></span><span></span><span></span></div>
                     </div>`,
                    'agent',
                    true
                );
                
                // Wait a moment to simulate the call before showing the result.
                await new Promise(res => setTimeout(res, 1200));
                
                toolLoadingMessage.remove();
                renderConversation(conversationHistory); // Render the final state
            } else {
                // No tool was used, just render the final state immediately.
                renderConversation(conversationHistory);
            }
        } else if (result.data.response) { // Fallback for old format or errors
            addMessageToChat(result.data.response, 'agent');
        } else {
            addMessageToChat("I'm not sure how to respond to that. Can you try rephrasing?", 'agent');
        }

    } catch (error) {
        console.error("Error calling Firebase Function:", error);
        const errorMessage = `Sorry, I encountered an error: ${error.message}`;
        loadingMessage.remove();
        addMessageToChat(errorMessage, 'agent');
    } finally {
        AI_DOMElements.sendBtn.disabled = false;
        AI_DOMElements.input.disabled = false;
        AI_DOMElements.input.focus();
    }
}

// Helper function to initialize searchable dropdowns
function initializeSearchableDropdown(dropdownElement, onChangeCallback, isDynamic = false) {
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
function initializeSimpleDropdown(dropdown, onChangeCallback) {
    if (!dropdown) return;

    const selectedElement = dropdown.querySelector('.dropdown-selected');
    const selectedValueSpan = dropdown.querySelector('.selected-value');
    const optionsContainer = dropdown.querySelector('.dropdown-options');
    
    if (!selectedElement || !selectedValueSpan || !optionsContainer) {
        console.error('Simple dropdown is missing required elements.', dropdown);
        return;
    }

    const toggleDropdown = (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        // Close all other dropdowns first
        document.querySelectorAll('.custom-dropdown.open').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });
        // Then toggle the current one
        dropdown.classList.toggle('open', !isOpen);
    };

    selectedElement.addEventListener('click', toggleDropdown);

    selectedElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown(e);
        } else if (e.key === 'Escape' && dropdown.classList.contains('open')) {
            dropdown.classList.remove('open');
        }
    });

    optionsContainer.addEventListener('click', (e) => {
        const option = e.target.closest('.dropdown-option');
        if (option) {
            // Update selected value
            selectedValueSpan.textContent = option.textContent;
            dropdown.dataset.value = option.dataset.value;
            
            // Update selected state
            optionsContainer.querySelectorAll('.dropdown-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
            
            // Close dropdown
            dropdown.classList.remove('open');
            
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

const plans = {
    'price_1RcNOUFsHlNG9dRePimNz27G': 'core',
    'price_1RcNOvFsHlNG9dReHwB7t69Q': 'plus',
    'price_1RcNPWFsHlNG9dReUWEWXkMJ': 'max'
};

const planFeatures = {
    core: ['dashboard', 'calendar', 'leasing', 'properties', 'people', 'accounting', 'maintenance', 'reporting', 'communication', 'settings'],
    plus: ['core', 'advanced-budgeting', 'advanced-analysis', 'custom-fields', 'automated-workflows', 'premium-integrations', 'scale-control', 'api-read', 'enhanced-support', 'smart-maintenance'],
    max: ['plus', 'leasing-crm', 'leasing-signals', 'api-write', 'dedicated-support']
};

function hasAccess(requiredPlan) {
    if (!currentUserPlan) return false;
    if (requiredPlan === 'core') return true; // all plans have core features

    const planHierarchy = ['core', 'plus', 'max'];
    const userPlanIndex = planHierarchy.indexOf(currentUserPlan);
    const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);

    if (userPlanIndex === -1 || requiredPlanIndex === -1) return false;

    return userPlanIndex >= requiredPlanIndex;
}

// --- Firebase Auth & Initialization Hook (to be called by each page) ---
let pageInitCallback = null;

function initializeAuth(callback) {
    pageInitCallback = callback;
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        const displayName = user.displayName || user.email.split('@')[0];
        cachedUserDisplayName = displayName;
        sessionStorage.setItem('puulUserDisplayName', displayName);

        // Fetch user's subscription plan
        const userDbRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userDbRef);
        const userData = userSnapshot.val();

        if (userData && userData.stripePriceId) {
            currentUserPlan = plans[userData.stripePriceId];
        } else {
            currentUserPlan = 'core'; // Default to core if no plan found to prevent UI breaking
        }

        // Check if user has data, if not, populate it.
        const userRootRef = ref(database, `properties/${user.uid}`);
        const snapshot = await get(userRootRef);
        if (!snapshot.exists()) {
            console.log(`User ${user.uid} has no data. Populating...`);
            try {
                const populateUserData = httpsCallable(functions, 'populateUserData');
                await populateUserData();
                console.log("Mock data population function called successfully.");
                // No need to reload, onValue listeners will pick up the new data.
            } catch (error) {
                console.error("Error calling populateUserData function:", error);
                showAlert("Could not initialize your account with sample data. Please contact support.", "Error");
            }
        }

        // Now that we have a user, initialize the AI conversation.
        initializeConversation();

        // Add/update user in the public /users directory for messaging user search
        const userPublicRef = ref(database, 'users/' + user.uid);
        update(userPublicRef, {
            displayName: displayName,
            email: user.email,
            uid: user.uid
        }).catch(error => console.error("Failed to update user in public directory", error));

        // Ensure welcome message is updated now that we have a user.
        if (DOMElements.welcomeMessage) {
            DOMElements.welcomeMessage.textContent = `Welcome, ${displayName}!`;
        }
        
        // Now that the user and plan are known, build the UI.
        setupPageLayoutAndInteractivity();

        // If a page-specific init function is waiting, call it now that we're authenticated.
        if (typeof pageInitCallback === 'function') {
            pageInitCallback(user.uid, database, ref, push, set, remove, serverTimestamp, query, orderByChild, equalTo, getDbData, updateDbData, showAlert, showConfirm, editIconSVG, deleteIconSVG, initializeSearchableDropdown, initializeSimpleDropdown, getFunctions, httpsCallable, hasAccess, currentUserPlan);
        }
    } else {
        currentUserId = null;
        currentUserPlan = null;
        sessionStorage.removeItem('puulUserDisplayName');
        window.location.href = '/';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // This is a bit of a hack to get the current page name for the AI context.
    const pathName = window.location.pathname.split('/').pop();
    currentPageContext = pathName.replace('platform_', '').replace('.html', '');
    
    // Remove the FOUC-prevention class now that the JS has loaded and can take over.
    document.documentElement.classList.remove('js-loading');
    // setupPageLayoutAndInteractivity(); // This is now called after auth completes.
});


// --- Firebase Data Helpers ---
async function getDbData(dataRef) {
    const { get: fbGet } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
    return fbGet(dataRef);
}

async function updateDbData(dataRef, values) {
    const { update: fbUpdate } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
    return fbUpdate(dataRef, values);
}

// Ensure DOMElements is globally accessible for initializeSearchableDropdown if it's not already
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
    initializeSearchableDropdown,
    initializeSimpleDropdown,
    getFunctions, httpsCallable,
    hasAccess,
    currentUserPlan
}; 

function initializeResizableTables() {
    const tables = document.querySelectorAll('.data-table');

    tables.forEach(table => {
        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
            // Check if a resizer already exists
            if (header.querySelector('.resizer')) {
                return;
            }
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            header.appendChild(resizer);
            addResizerListener(header, resizer);
        });
    });
}

function addResizerListener(header, resizer) {
    let x = 0;
    let w = 0;

    const mouseDownHandler = function (e) {
        // Prevent event from bubbling up to header text selection, etc.
        e.preventDefault();
        e.stopPropagation();

        x = e.clientX;

        const styles = window.getComputedStyle(header);
        w = parseInt(styles.width, 10);

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        
        resizer.classList.add('resizing');
        // Also add a class to the body to prevent text selection everywhere during resize
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    };

    const mouseMoveHandler = function (e) {
        const dx = e.clientX - x;
        const newWidth = w + dx;
        // Optional: add a minimum width
        if (newWidth > 50) {
            header.style.width = `${newWidth}px`;
        }
    };

    const mouseUpHandler = function () {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        resizer.classList.remove('resizing');
        // Restore body styles
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
}


// --- AI Chat History Dropdown ---
let isHistoryDropdownOpen = false;

function closeHistoryDropdown() {
    const container = document.getElementById('ai-history-container');
    if (container) {
        container.classList.remove('open');
        const menu = container.querySelector('.dropdown-menu');
        if (menu) {
            // Let the CSS transition finish before removing
            setTimeout(() => menu.remove(), 200);
        }
    }
    isHistoryDropdownOpen = false;
    document.removeEventListener('click', handleClickOutsideHistoryDropdown, true);
}

function handleClickOutsideHistoryDropdown(event) {
    const container = document.getElementById('ai-history-container');
    if (container && !container.contains(event.target)) {
        closeHistoryDropdown();
    }
}

function loadConversation(convoId) {
    if (conversationId === convoId) {
        closeHistoryDropdown();
        return;
    }
    console.log(`[AI Agent] Loading conversation ${convoId}`);
    sessionStorage.setItem('aiCurrentConversationId', convoId);
    initializeConversation();
    closeHistoryDropdown();
}

function showHistoryDropdown(container, histories) {
    // Remove existing menu if it's there
    let menu = container.querySelector('.dropdown-menu');
    if (menu) menu.remove();

    menu = document.createElement('div');
    menu.id = 'ai-history-menu';
    menu.className = 'dropdown-menu';

    const options = document.createElement('div');
    options.className = 'dropdown-options';
    
    const historyKeys = Object.keys(histories);

    if (historyKeys.length === 0) {
        options.innerHTML = `<div class="dropdown-option no-history">No past conversations.</div>`;
    } else {
        historyKeys.reverse().forEach(convoId => { // Show newest first
            const history = histories[convoId];
            const firstUserMessage = history.find(msg => msg.role === 'user' && !msg.parts[0].text.startsWith('You are an AI assistant'));
            const title = firstUserMessage ? firstUserMessage.parts[0].text : 'Conversation';

            const item = document.createElement('div');
            item.className = 'dropdown-option';
            if (convoId === conversationId) {
                item.classList.add('selected');
            }
            item.textContent = title.substring(0, 35) + (title.length > 35 ? '...' : '');
            item.title = title;
            item.dataset.conversationId = convoId;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                loadConversation(convoId);
            });
            options.appendChild(item);
        });
    }

    menu.appendChild(options);
    container.appendChild(menu);
    
    // Trigger the 'open' class to show the menu with transition
    setTimeout(() => {
        container.classList.add('open');
        isHistoryDropdownOpen = true;
        document.addEventListener('click', handleClickOutsideHistoryDropdown, true);
    }, 10); // A tiny delay ensures the transition works
}

async function toggleHistoryDropdown() {
    const container = document.getElementById('ai-history-container');
    if (!container) return;
    
    isHistoryDropdownOpen = container.classList.contains('open');

    if (isHistoryDropdownOpen) {
        closeHistoryDropdown();
        return;
    }

    const historiesRef = ref(database, `aiConversations/${currentUserId}`);
    try {
        const snapshot = await get(historiesRef);
        const allHistories = snapshot.exists() ? snapshot.val() : {};
        showHistoryDropdown(container, allHistories);
    } catch (error) {
        console.error("Error fetching chat histories:", error);
        showAlert("Could not load chat history.");
    }
} 