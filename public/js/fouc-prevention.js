(function() {
    try {
        // Enhanced FOUC Prevention - Set initial states before any rendering
        
        // Left Sidebar State
        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            document.documentElement.classList.add('sidebar-is-collapsed');
        }

        // AI Agent Sidebar State
        const aiAgentOpen = localStorage.getItem('aiAgentCollapsed') === 'false';
        if (aiAgentOpen) {
             document.documentElement.classList.add('ai-agent-is-open');
        }

        // Prevent layout shifts by setting initial dimensions
        const aiAgentWidth = localStorage.getItem('aiAgentWidth');
        if (aiAgentWidth && aiAgentOpen) {
            // Create a style element to set initial AI agent width
            const style = document.createElement('style');
            style.id = 'ai-agent-initial-width';
            style.textContent = `
                #ai-agent-container .ai-agent {
                    width: ${aiAgentWidth} !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Set initial body layout to prevent jumps - only if body exists
        if (document.body) {
            document.body.style.visibility = 'hidden';
            document.body.style.opacity = '0';
            
            // Add loading state classes
            document.documentElement.classList.add('initial-loading');
            
            // Remove loading states after a short delay to ensure smooth transitions
            setTimeout(() => {
                if (document.body) {
                    document.body.style.visibility = '';
                    document.body.style.opacity = '';
                }
                document.documentElement.classList.remove('initial-loading');
            }, 100);
        } else {
            // If body doesn't exist yet, wait for DOMContentLoaded
            document.addEventListener('DOMContentLoaded', function() {
                if (document.body) {
                    document.body.style.visibility = 'hidden';
                    document.body.style.opacity = '0';
                    document.documentElement.classList.add('initial-loading');
                    
                    setTimeout(() => {
                        if (document.body) {
                            document.body.style.visibility = '';
                            document.body.style.opacity = '';
                        }
                        document.documentElement.classList.remove('initial-loading');
                    }, 100);
                }
            });
        }

    } catch (e) {
        // In case of any error (e.g., localStorage is disabled), do nothing and let the page load normally.
        console.error("FOUC prevention script failed", e);
    }
})(); 