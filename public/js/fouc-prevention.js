(function() {
    try {
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
    } catch (e) {
        // In case of any error (e.g., localStorage is disabled), do nothing and let the page load normally.
        console.error("FOUC prevention script failed", e);
    }
})(); 