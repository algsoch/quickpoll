// QuickPoll Frontend Application - v68 (Updated for new Render deployment)
// Configuration
// Read primary/fallback API URLs from meta tags
// OLD account (xgc3) is SUSPENDED - only use NEW account (3lqv)
const META_API_PRIMARY = document.querySelector('meta[name="api-primary"]')?.content;
const META_API_FALLBACK = document.querySelector('meta[name="api-fallback"]')?.content;

function deriveApiFromHostname() {
    const hostname = window.location.hostname;

    // Local development (localhost or LAN IP)
    if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        return `http://${hostname}:8080`;
    }

    // Render deployment - if frontend has the quickpoll-frontend-<suffix>.onrender.com pattern,
    // derive the API host with the same suffix. This is useful when both frontend and backend
    // are created from the same Render blueprint and share suffixes.
    if (hostname.includes('quickpoll-frontend') && hostname.endsWith('.onrender.com')) {
        const match = hostname.match(/quickpoll-frontend-([a-z0-9]+)\.onrender\.com/);
        if (match) {
            return `https://quickpoll-api-${match[1]}.onrender.com`;
        }
        // If pattern exists but can't extract, don't crash — return null to let other candidates win
        return null;
    }

    // Custom domain fallback
    return 'https://api.algsoch.tech';
}

// Build ordered candidate list for API endpoint selection
// Only use active backends - old account (xgc3) is suspended
function buildApiCandidates() {
    const candidates = [];
    if (META_API_PRIMARY) candidates.push(META_API_PRIMARY);
    const derived = deriveApiFromHostname();
    if (derived) candidates.push(derived);
    if (META_API_FALLBACK) candidates.push(META_API_FALLBACK);
    // Final fallback
    candidates.push('https://api.algsoch.tech');

    // Deduplicate while preserving order
    return [...new Set(candidates.filter(Boolean))];
}

// Start with a safe default (will be overwritten by wakeUpAPI if a better candidate is found)
let API_BASE_URL = META_API_PRIMARY || deriveApiFromHostname() || META_API_FALLBACK || 'https://api.algsoch.tech';
let WS_BASE_URL = API_BASE_URL.replace('http', 'ws').replace('https', 'wss');

// Reaction constants
const ALLOWED_EMOJIS = ["👍", "👎", "😂", "❤️", "🎉", "🤔"];
const EMOJI_LABELS = {
    "👍": "Thumbs Up",
    "👎": "Thumbs Down",
    "😂": "Laughing",
    "❤️": "Love",
    "🎉": "Celebrate",
    "🤔": "Thinking"
};

// State
let currentUser = null;
let currentToken = null;
let currentPollId = null;
let pollWebSocket = null;
let pollChart = null;
let notificationInterval = null;
let confirmCallback = null;
let sessionId = null;  // For anonymous reactions
let lastUnreadCount = 0;  // Track last notification count
let lastBadgeCount = 0;  // Track last badge count
let notificationCache = [];  // Cache notifications
let lastNotificationCheck = 0;  // Timestamp of last check

// Helper function to get current token
function getToken() {
    // Return the current token from memory, or check storage as fallback
    if (currentToken) {
        return currentToken;
    }
    // Fallback: check storage directly
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

// Theme Management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();
    // Try candidates and pick the first responsive API before initializing the app
    await wakeUpAPI(); // wakeUpAPI will update API_BASE_URL and WS_BASE_URL
    initializeApp();
});

// Wake up API on page load (for Render free tier cold starts)
// Render free tier can take 30-60 seconds to wake up from sleep
async function wakeUpAPI() {
    console.log('🔄 Waking up API server (probing candidates)...');
    const wakeupIndicator = document.getElementById('wakeupIndicator');
    if (wakeupIndicator) {
        wakeupIndicator.style.display = 'flex';
        wakeupIndicator.innerHTML = '<div class="wakeup-spinner"></div><span>Waking up server (free tier)...</span>';
    }

    const candidates = buildApiCandidates();
    console.log('API candidates:', candidates);

    let chosen = null;
    const maxRetries = 3;  // Retry up to 3 times for cold starts
    const retryDelay = 15000;  // Wait 15 seconds between retries (Render cold start takes ~30-60s)
    const fetchTimeout = 20000;  // 20 second timeout per request

    // Helper function to fetch with timeout
    async function fetchWithTimeout(url, options = {}, timeout = fetchTimeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    for (let retry = 0; retry < maxRetries; retry++) {
        if (retry > 0) {
            console.log(`🔄 Retry ${retry}/${maxRetries - 1} - Server may be waking up...`);
            if (wakeupIndicator) {
                wakeupIndicator.innerHTML = `<div class="wakeup-spinner"></div><span>Server is waking up... (attempt ${retry + 1}/${maxRetries})</span>`;
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        for (const candidate of candidates) {
            try {
                const startTime = Date.now();

                // Prefer /health (always exists), then /ping, then root
                const probes = [`${candidate}/health`, `${candidate}/ping`, `${candidate}/`];
                let probeOk = false;

                for (const probe of probes) {
                    try {
                        console.log(`🔍 Probing ${probe}...`);
                        const resp = await fetchWithTimeout(probe, { 
                            method: 'GET', 
                            headers: { 'Accept': 'application/json' }
                        });
                        const elapsed = Date.now() - startTime;
                        
                        if (resp.ok) {
                            console.log(`✅ ${probe} responded OK (${elapsed}ms)`);
                            probeOk = true;
                            break;
                        } else {
                            console.log(`ℹ️ ${probe} responded ${resp.status}`);
                        }
                    } catch (err) {
                        if (err.name === 'AbortError') {
                            console.log(`⏱️ Timeout for ${probe} - server may be waking up`);
                        } else {
                            console.log(`✖️ Probe failed for ${probe}:`, err.message);
                        }
                    }
                }

                if (probeOk) {
                    chosen = candidate;
                    break;
                }
            } catch (error) {
                console.warn('Error probing candidate', candidate, error.message);
            }
        }

        if (chosen) break;
    }

    if (chosen) {
        API_BASE_URL = chosen;
        WS_BASE_URL = API_BASE_URL.replace('http', 'ws').replace('https', 'wss');
        console.log('➡️ Selected API_BASE_URL =', API_BASE_URL);
        if (wakeupIndicator) {
            wakeupIndicator.innerHTML = '<span>✅ Server ready!</span>';
            setTimeout(() => { wakeupIndicator.style.display = 'none'; }, 1500);
        }
        // Update connection status to connecting, will be updated by health check
        updateConnectionStatus('connected', 'checking');
    } else {
        console.warn('⚠️ No API candidates responded after retries; using default:', API_BASE_URL);
        if (wakeupIndicator) {
            wakeupIndicator.innerHTML = `
                <span>⚠️ Server is starting up. Please wait or </span>
                <button onclick="location.reload()" style="margin-left: 8px; padding: 4px 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc;">
                    🔄 Refresh
                </button>
            `;
            // Don't auto-hide - let user click refresh
        }
        // Update connection status to disconnected
        updateConnectionStatus('disconnected', 'disconnected');
    }

    return API_BASE_URL;
}

// Connection Status Management
let connectionCheckInterval = null;
let isBackendConnected = false;

function updateConnectionStatus(backendStatus, databaseStatus, backendMessage, databaseMessage) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) {
        console.warn('Connection status element not found');
        return;
    }
    
    const backendDot = statusEl.querySelector('.backend-dot');
    const backendText = statusEl.querySelector('.backend-text');
    const databaseDot = statusEl.querySelector('.database-dot');
    const databaseText = statusEl.querySelector('.database-text');
    
    if (!backendDot || !backendText || !databaseDot || !databaseText) {
        console.warn('Connection status elements not found');
        return;
    }
    
    // Update backend status
    backendDot.className = 'connection-dot backend-dot ' + backendStatus;
    backendText.className = 'connection-text backend-text ' + backendStatus;
    backendText.textContent = backendStatus === 'connected' ? 'Connected' : 
                             backendStatus === 'connecting' ? 'Connecting...' : 'Disconnected';
    
    // Update database status
    databaseDot.className = 'connection-dot database-dot ' + databaseStatus;
    databaseText.className = 'connection-text database-text ' + databaseStatus;
    databaseText.textContent = databaseStatus === 'connected' ? 'Connected' : 
                              databaseStatus === 'checking' ? 'Checking...' : 'Disconnected';
    
    // Update tooltip
    const tooltip = `Backend: ${backendStatus}\nDatabase: ${databaseStatus}`;
    statusEl.setAttribute('data-tooltip', tooltip);
    
    // Store connection state
    isBackendConnected = backendStatus === 'connected';
    
    // Auto-hide when both are connected
    if (backendStatus === 'connected' && databaseStatus === 'connected') {
        setTimeout(() => {
            if (isBackendConnected && statusEl) {
                statusEl.classList.add('hidden');
            }
        }, 5000);
    } else {
        statusEl.classList.remove('hidden');
    }
    
    console.log(`Connection status - Backend: ${backendStatus}, Database: ${databaseStatus}`);
}

// Check backend health periodically
async function checkBackendHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            const backendStatus = data.status === 'healthy' ? 'connected' : 'disconnected';
            const databaseStatus = data.database === 'healthy' ? 'connected' : 'disconnected';
            
            updateConnectionStatus(backendStatus, databaseStatus);
            return backendStatus === 'connected';
        }
        throw new Error('Health check failed');
    } catch (error) {
        console.error('Health check error:', error.message);
        updateConnectionStatus('disconnected', 'disconnected', 'Connection lost', 'Database unavailable');
        return false;
    }
}

// Start periodic health checks
function startConnectionMonitoring() {
    // Initial check after a short delay
    setTimeout(checkBackendHealth, 2000);
    
    // Check every 30 seconds
    connectionCheckInterval = setInterval(checkBackendHealth, 30000);
}

// Handle click on connection status to retry
function setupConnectionStatusClickHandler() {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        statusEl.addEventListener('click', async () => {
            if (!isBackendConnected) {
                updateConnectionStatus('connecting', 'checking', 'Retrying...', 'Checking...');
                const success = await checkBackendHealth();
                if (!success) {
                    // Try full wake-up process
                    await wakeUpAPI();
                }
            } else {
                // Toggle visibility when connected
                statusEl.classList.toggle('hidden');
            }
        });
    }
}

function initializeApp() {
    // Check for OAuth callback with token
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('token');
    const oauthSuccess = urlParams.get('oauth');
    const oauthError = urlParams.get('error');
    const sharedPollId = urlParams.get('poll'); // Check for shared poll
    
    if (oauthToken && oauthSuccess === 'success') {
        // Google OAuth successful - save token
        currentToken = oauthToken;
        localStorage.setItem('token', oauthToken);
        localStorage.setItem('rememberMe', 'true');
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show success message
        showSuccessNotification('✅ Successfully signed in with Google!');
        
        // Validate token and load user data
        validateToken();
    } else if (oauthError) {
        // OAuth error
        showErrorNotification(`❌ OAuth Error: ${oauthError}`);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        // Check for saved token (localStorage for "Remember Me", sessionStorage for current session)
        currentToken = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (currentToken) {
            validateToken();
        } else {
            showGuestView();
        }

        // Check for password reset token in URL (reuse urlParams from above)
        const resetToken = urlParams.get('token');
        if (resetToken) {
            // Automatically open reset password modal with token
            document.getElementById('resetToken').value = resetToken;
            showModal('resetPasswordModal');
            // Clean URL without reloading page
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Setup event listeners (always run)
    setupEventListeners();
    
    // Setup activity feed filters
    setupActivityFilters();
    
    // Load statistics
    loadStatistics();
    
    // Load categories for filtering and create poll form
    loadCategories();
    
    // Refresh statistics every 30 seconds
    setInterval(loadStatistics, 30000);
    
    // If shared poll ID exists, open that poll directly
    if (sharedPollId) {
        // Clean URL first
        window.history.replaceState({}, document.title, window.location.pathname);
        // Load the shared poll after a short delay to ensure page is ready
        setTimeout(() => {
            loadPollDetail(sharedPollId);
        }, 500);
    } else {
        // Load polls normally
        loadPolls();
    }
    
    // Start connection monitoring
    setupConnectionStatusClickHandler();
    startConnectionMonitoring();
    
    // Welcome tour is now triggered after login, not on page load
}

function setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Auth modals
    document.getElementById('loginBtn').addEventListener('click', () => {
        showModal('loginModal');
        // Pre-check "Remember Me" if user previously used it
        const wasRemembered = localStorage.getItem('rememberMe') === 'true';
        document.getElementById('rememberMe').checked = wasRemembered;
    });
    document.getElementById('signupBtn').addEventListener('click', () => {
        showModal('registerModal');
        // Reset password requirements display
        updatePasswordRequirements('');
    });
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('apiKeysBtn').addEventListener('click', () => {
        showModal('apiKeysModal');
        loadAPIKeys();
        // Show API keys tour for first-time users
        if (currentUser && currentUser.id && !hasSeenTour(currentUser.id, TOUR_TYPES.API_KEYS)) {
            setTimeout(() => {
                startAPIKeysTour();
            }, 600);
        }
    });
    document.getElementById('helpBtn').addEventListener('click', restartTour);
    
    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
    document.getElementById('createPollForm').addEventListener('submit', handleCreatePoll);
    document.getElementById('editPollForm').addEventListener('submit', handleEditPoll);
    document.getElementById('createApiKeyForm').addEventListener('submit', handleCreateAPIKey);
    
    // API Keys buttons
    document.getElementById('createApiKeyBtn').addEventListener('click', () => {
        showModal('createApiKeyModal');
    });
    document.getElementById('testApiKeyBtn').addEventListener('click', () => {
        showModal('testApiKeyModal');
    });
    document.getElementById('copyApiKeyBtn').addEventListener('click', copyAPIKeyToClipboard);
    document.getElementById('testApiKeyForm').addEventListener('submit', handleTestAPIKey);
    
    // Real-time password strength checking
    const registerPassword = document.getElementById('registerPassword');
    const newPassword = document.getElementById('newPassword');
    
    if (registerPassword) {
        registerPassword.addEventListener('input', (e) => {
            checkPasswordStrength(e.target.value, 'strengthMeterFill', 'strengthLabel');
        });
    }
    
    if (newPassword) {
        newPassword.addEventListener('input', (e) => {
            checkPasswordStrength(e.target.value, 'resetStrengthMeterFill', 'resetStrengthLabel');
        });
    }
    
    // Real-time username availability checking
    const registerUsername = document.getElementById('registerUsername');
    if (registerUsername) {
        let usernameCheckTimeout;
        registerUsername.addEventListener('input', (e) => {
            clearTimeout(usernameCheckTimeout);
            const username = e.target.value.trim();
            
            if (username.length >= 3) {
                // Show checking status
                document.getElementById('usernameStatus').textContent = '⏳';
                document.getElementById('usernameStatus').className = 'username-status checking';
                
                // Debounce the API call (wait 500ms after user stops typing)
                usernameCheckTimeout = setTimeout(() => {
                    checkUsernameAvailability(username);
                }, 500);
            } else {
                document.getElementById('usernameStatus').textContent = '';
                document.getElementById('usernameStatus').className = 'username-status';
                document.getElementById('usernameSuggestions').style.display = 'none';
            }
        });
    }
    
    // Real-time password match validation
    const registerConfirmPassword = document.getElementById('registerConfirmPassword');
    const confirmNewPassword = document.getElementById('confirmNewPassword');
    
    if (registerConfirmPassword) {
        registerConfirmPassword.addEventListener('input', () => {
            checkPasswordMatch('registerPassword', 'registerConfirmPassword', 'passwordMatch');
        });
    }
    
    if (confirmNewPassword) {
        confirmNewPassword.addEventListener('input', () => {
            checkPasswordMatch('newPassword', 'confirmNewPassword', 'resetPasswordMatch');
        });
    }
    
    // Poll creation
    document.getElementById('createPollBtn').addEventListener('click', () => {
        showModal('createPollModal');
        // Initialize tag inputs when modal opens
        setTimeout(() => {
            initializeTagInputs();
        }, 100);
        // Show create poll tour for first-time users
        if (currentUser && currentUser.id && !hasSeenTour(currentUser.id, TOUR_TYPES.CREATE_POLL)) {
            setTimeout(() => {
                startCreatePollTour();
            }, 500);
        }
    });
    document.getElementById('addOptionBtn').addEventListener('click', addPollOption);
    
    // Poll Templates
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const button = e.currentTarget;
            const template = button.dataset.template;
            
            // Toggle active state
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            
            // Apply template
            applyPollTemplate(template);
        });
    });
    
    // AI Suggestions button
    const aiSuggestBtn = document.getElementById('aiSuggestBtn');
    if (aiSuggestBtn) {
        aiSuggestBtn.addEventListener('click', getAIPollSuggestions);
    }
    
    // Poll duration selector
    document.getElementById('pollDuration').addEventListener('change', (e) => {
        const customDateGroup = document.getElementById('customDateGroup');
        if (e.target.value === 'custom') {
            customDateGroup.classList.remove('hidden');
        } else {
            customDateGroup.classList.add('hidden');
        }
    });
    
    // Navigation
    document.getElementById('backBtn').addEventListener('click', showPollsList);
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const currentFilter = e.target.dataset.filter;
            const searchParams = getCurrentSearchParams();
            loadPolls(currentFilter, searchParams);
        });
    });
    
    // Search and Advanced Filters
    let searchTimeout;
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const clearFiltersBtn = document.getElementById('clearFilters');
    
    // Debounced search
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const currentFilter = document.querySelector('.filter-btn.active').dataset.filter;
            const searchParams = getCurrentSearchParams();
            loadPolls(currentFilter, searchParams);
        }, 300);
    });
    
    // Sort change
    sortSelect.addEventListener('change', () => {
        const currentFilter = document.querySelector('.filter-btn.active').dataset.filter;
        const searchParams = getCurrentSearchParams();
        loadPolls(currentFilter, searchParams);
    });
    
    // Date range change
    dateFromInput.addEventListener('change', () => {
        const currentFilter = document.querySelector('.filter-btn.active').dataset.filter;
        const searchParams = getCurrentSearchParams();
        loadPolls(currentFilter, searchParams);
    });
    
    dateToInput.addEventListener('change', () => {
        const currentFilter = document.querySelector('.filter-btn.active').dataset.filter;
        const searchParams = getCurrentSearchParams();
        loadPolls(currentFilter, searchParams);
    });
    
    // Clear all filters
    clearFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        sortSelect.value = 'newest';
        dateFromInput.value = '';
        dateToInput.value = '';
        const currentFilter = document.querySelector('.filter-btn.active').dataset.filter;
        loadPolls(currentFilter, {});
        showToast('✨ Filters cleared', 'success');
    });
    
    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal').id);
        });
    });
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
    
    // Notification button
    document.getElementById('notificationBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'block';
            loadNotifications();
        } else {
            dropdown.style.display = 'none';
        }
    });
    
    // Mark all notifications as read
    document.getElementById('markAllReadBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        markAllNotificationsRead();
    });
    
    // Close notification dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notificationDropdown');
        const notificationBtn = document.getElementById('notificationBtn');
        if (!notificationBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Badges button
    document.getElementById('badgesBtn').addEventListener('click', () => {
        showModal('badgesModal');
        loadBadges();
    });
    
    // Profile button
    document.getElementById('profileBtn').addEventListener('click', () => {
        showModal('profileModal');
        loadUserProfile();
    });
    
    // Bio character counter
    const bioTextarea = document.getElementById('bio');
    if (bioTextarea) {
        bioTextarea.addEventListener('input', (e) => {
            document.getElementById('bioCount').textContent = e.target.value.length;
            updateLivePreview();
        });
    }
    
    // Live preview updates for all profile fields
    ['location', 'website', 'twitterHandle', 'avatarUrl', 'coverImageUrl'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', updateLivePreview);
        }
    });
    
    // Profile image upload tabs
    setupUploadTabs();
    setupImageUploads();
    
    // Badge category filters
    document.querySelectorAll('.badge-category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.badge-category-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterBadges(e.target.dataset.category);
        });
    });
    
    // Share modal buttons
    document.getElementById('copyShareUrlBtn').addEventListener('click', copyShareUrl);
    document.getElementById('shareTwitterBtn').addEventListener('click', shareToTwitter);
    document.getElementById('shareFacebookBtn').addEventListener('click', shareToFacebook);
    document.getElementById('shareWhatsAppBtn').addEventListener('click', shareToWhatsApp);
    document.getElementById('shareEmailBtn').addEventListener('click', shareToEmail);
    document.getElementById('downloadQrBtn').addEventListener('click', downloadQRCode);
}

// Auth Functions
async function validateToken() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            showUserView();
        } else {
            localStorage.removeItem('token');
            currentToken = null;
            showGuestView();
        }
    } catch (error) {
        console.error('Token validation failed:', error);
        showGuestView();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    setButtonLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentToken = data.access_token;
            
            // Store token based on "Remember Me" preference
            if (rememberMe) {
                localStorage.setItem('token', currentToken);
                localStorage.setItem('rememberMe', 'true');
                // Clear sessionStorage if it exists
                sessionStorage.removeItem('token');
            } else {
                sessionStorage.setItem('token', currentToken);
                // Clear localStorage if it exists
                localStorage.removeItem('token');
                localStorage.removeItem('rememberMe');
            }
            
            await validateToken();
            setButtonSuccess(submitBtn);
            showSuccessToast('Welcome back! You have successfully logged in.');
            
            // Check if first-time user (after short delay for UI to load)
            setTimeout(() => {
                checkFirstTimeUser();
            }, 1500);
            
            setTimeout(() => {
                closeModal('loginModal');
                document.getElementById('loginForm').reset();
                
                // Refresh current view - if viewing a poll, reload it; otherwise load polls list
                if (currentPollId && document.getElementById('pollDetailSection').style.display !== 'none') {
                    loadPollDetail(currentPollId);
                } else {
                    loadPolls();
                }
            }, 1000);
        } else {
            const error = await response.json();
            showMessage('loginMessage', error.detail || 'Login failed', 'error');
            showErrorToast(error.detail || 'Login failed');
            setButtonLoading(submitBtn, false);
        }
    } catch (error) {
        showMessage('loginMessage', 'Network error. Please try again.', 'error');
        showErrorToast('Network error. Please try again.');
        setButtonLoading(submitBtn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Validation
    if (!name) {
        showMessage('registerMessage', '⚠️ Please enter your full name', 'error');
        return;
    }
    
    if (!agreeTerms) {
        showMessage('registerMessage', '⚠️ Please agree to the Terms of Service', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('registerMessage', '❌ Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 8) {
        showMessage('registerMessage', '⚠️ Password must be at least 8 characters', 'error');
        return;
    }
    
    // Check if all password requirements are met
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        showMessage('registerMessage', '⚠️ Password must meet all requirements', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        if (response.ok) {
            setButtonSuccess(submitBtn);
            showSuccessToast('Account created successfully! Please sign in.', 'Welcome!');
            showMessage('registerMessage', `✅ Welcome ${name}! Registration successful. Please login.`, 'success');
            setTimeout(() => {
                closeModal('registerModal');
                showModal('loginModal');
                document.getElementById('registerForm').reset();
                // Reset password requirements display
                updatePasswordRequirements('');
            }, 2000);
        } else {
            const error = await response.json();
            showErrorToast(error.detail || 'Registration failed');
            showMessage('registerMessage', error.detail || 'Registration failed', 'error');
            setButtonLoading(submitBtn, false);
        }
    } catch (error) {
        showErrorToast('Network error. Please try again.');
        showMessage('registerMessage', 'Network error. Please try again.', 'error');
        setButtonLoading(submitBtn, false);
    }
}

function logout() {
    // Clear authentication state from both storage locations
    localStorage.removeItem('token');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    currentToken = null;
    currentUser = null;
    currentPollId = null;
    
    // Clear notification and badge caches
    notificationCache = [];
    lastUnreadCount = 0;
    lastBadgeCount = 0;
    lastNotificationCheck = 0;
    
    // Close WebSocket connection if open
    if (pollWebSocket) {
        pollWebSocket.close();
        pollWebSocket = null;
    }
    
    // Destroy chart if exists
    if (pollChart) {
        pollChart.destroy();
        pollChart = null;
    }
    
    // Return to polls list view
    document.getElementById('pollsSection').style.display = 'block';
    document.getElementById('pollDetailSection').style.display = 'none';
    
    // Update UI to guest view
    showGuestView();
    
    // Reload polls (will show all polls for guests)
    loadPolls();
    
    // Reload statistics
    loadStatistics();
    
    console.log('User logged out successfully');
}

// Enhanced Authentication Functions

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
    }
}

function checkPasswordStrength(password, meterFillId, labelId) {
    const meterFill = document.getElementById(meterFillId);
    const label = document.getElementById(labelId);
    
    // Update visual requirements checklist (only for registration form)
    const isRegistration = meterFillId === 'strengthMeterFill';
    if (isRegistration) {
        updatePasswordRequirements(password);
    }
    
    if (!password) {
        meterFill.className = 'strength-meter-fill';
        meterFill.style.width = '0%';
        label.textContent = '-';
        label.className = '';
        return;
    }
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    
    // Character variety checks
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    // Determine strength level
    if (strength <= 2) {
        meterFill.className = 'strength-meter-fill weak';
        label.textContent = 'Weak';
        label.className = 'weak';
    } else if (strength <= 4) {
        meterFill.className = 'strength-meter-fill medium';
        label.textContent = 'Medium';
        label.className = 'medium';
    } else {
        meterFill.className = 'strength-meter-fill strong';
        label.textContent = 'Strong';
        label.className = 'strong';
    }
}

function updatePasswordRequirements(password) {
    // Update each requirement indicator
    const requirements = {
        'req-length': password.length >= 8,
        'req-uppercase': /[A-Z]/.test(password),
        'req-lowercase': /[a-z]/.test(password),
        'req-number': /[0-9]/.test(password),
        'req-special': /[^a-zA-Z0-9]/.test(password)
    };
    
    for (const [reqId, isValid] of Object.entries(requirements)) {
        const reqElement = document.getElementById(reqId);
        if (reqElement) {
            reqElement.className = 'requirement-item';
            if (password.length > 0) {
                reqElement.classList.add(isValid ? 'valid' : 'invalid');
            }
        }
    }
}

function checkPasswordMatch(password1Id, password2Id, messageId) {
    const password1 = document.getElementById(password1Id).value;
    const password2 = document.getElementById(password2Id).value;
    const message = document.getElementById(messageId);
    
    if (!password2) {
        message.textContent = '';
        message.className = 'form-helper-text';
        return false;
    }
    
    if (password1 === password2) {
        message.textContent = '✅ Passwords match';
        message.className = 'form-helper-text match';
        return true;
    } else {
        message.textContent = '❌ Passwords do not match';
        message.className = 'form-helper-text no-match';
        return false;
    }
}

// Username availability checking
async function checkUsernameAvailability(username) {
    const statusElement = document.getElementById('usernameStatus');
    const helperElement = document.getElementById('usernameHelper');
    const suggestionsElement = document.getElementById('usernameSuggestions');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/check-username/${encodeURIComponent(username)}`);
        const data = await response.json();
        
        if (data.available) {
            // Username is available
            statusElement.textContent = '✅';
            statusElement.className = 'username-status available';
            helperElement.textContent = 'Username is available!';
            helperElement.style.color = '#10b981';
            suggestionsElement.style.display = 'none';
        } else {
            // Username is taken - show suggestions
            statusElement.textContent = '❌';
            statusElement.className = 'username-status taken';
            helperElement.textContent = 'Username is already taken. Try one of these:';
            helperElement.style.color = '#ef4444';
            
            // Show suggestions
            showUsernameSuggestions(username);
        }
    } catch (error) {
        console.error('Error checking username:', error);
        statusElement.textContent = '';
        statusElement.className = 'username-status';
        helperElement.textContent = 'Could not check username availability';
        helperElement.style.color = '#6b7280';
    }
}

function showUsernameSuggestions(baseUsername) {
    const suggestionsElement = document.getElementById('usernameSuggestions');
    
    // Generate suggestions
    const suggestions = [];
    const cleanBase = baseUsername.replace(/[0-9]+$/, ''); // Remove trailing numbers
    
    // Add numbered variations
    for (let i = 1; i <= 3; i++) {
        const randomNum = Math.floor(Math.random() * 1000);
        suggestions.push(`${cleanBase}${randomNum}`);
    }
    
    // Add suffix variations
    const suffixes = ['_dev', '_user', '_pro', '123', '2024', '_official'];
    suggestions.push(`${cleanBase}${suffixes[Math.floor(Math.random() * suffixes.length)]}`);
    
    // Create HTML for suggestions
    suggestionsElement.innerHTML = `
        <h4>💡 Available suggestions:</h4>
        ${suggestions.map(suggestion => 
            `<span class="username-suggestion-item" onclick="selectUsername('${suggestion}')">${suggestion}</span>`
        ).join('')}
    `;
    
    suggestionsElement.style.display = 'block';
}

function selectUsername(username) {
    const usernameInput = document.getElementById('registerUsername');
    usernameInput.value = username;
    
    // Trigger the availability check for the selected username
    checkUsernameAvailability(username);
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Sending...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            const data = await response.json();
            const messageEl = document.getElementById('forgotPasswordMessage');
            
            // Check if email was successfully sent
            if (data.email_sent) {
                // Email was sent successfully
                messageEl.className = 'form-message success';
                messageEl.innerHTML = `
                    <div style="text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 15px;">📧</div>
                        <p style="margin-bottom: 15px; font-size: 1.1em;">
                            <strong>Check your email!</strong>
                        </p>
                        <p style="color: #666; font-size: 0.95em; margin-bottom: 15px;">
                            We've sent a password reset link to <strong>${email}</strong>
                        </p>
                        <p style="color: #888; font-size: 0.85em;">
                            ⏰ The link will expire in 1 hour.<br>
                            Don't see it? Check your spam folder.
                        </p>
                    </div>
                `;
            } else if (data.dev_token) {
                // Development mode or email not configured
                const isDevMode = data.dev_mode;
                const isEmailError = data.email_error;
                
                messageEl.className = 'form-message success';
                messageEl.innerHTML = `
                    <div style="text-align: center;">
                        <p style="margin-bottom: 15px;">✅ <strong>Password reset link generated!</strong></p>
                        <p style="margin-bottom: 15px; color: #666; font-size: 0.9em;">
                            ${isEmailError ? '⚠️ Email delivery failed. Use the button below:' : '🔧 <strong>Development Mode:</strong> Email is not configured yet.'}<br>
                            Click the button below to reset your password directly:
                        </p>
                        <button class="btn btn-primary" style="width: 100%; max-width: 300px; margin-bottom: 10px;" id="devResetBtn">
                            🔓 Reset Password Now
                        </button>
                        <details style="margin-top: 15px; text-align: left; font-size: 0.85em; color: #666;">
                            <summary style="cursor: pointer; font-weight: 500;">📋 Show Reset Link (for testing)</summary>
                            <div style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px; word-break: break-all;">
                                <code style="font-size: 0.8em;">${window.location.origin}/?token=${data.dev_token}</code>
                            </div>
                        </details>
                    </div>
                `;
                
                // Add event listener to the button
                document.getElementById('devResetBtn').onclick = () => {
                    closeModal('forgotPasswordModal');
                    document.getElementById('resetToken').value = data.dev_token;
                    showModal('resetPasswordModal');
                };
            } else {
                // Generic success message
                showMessage('forgotPasswordMessage', '✅ If an account exists with this email, a password reset link has been sent.', 'success');
            }
            
            document.getElementById('forgotPasswordForm').reset();
        } else {
            const error = await response.json();
            showMessage('forgotPasswordMessage', error.detail || 'Failed to send reset link', 'error');
        }
    } catch (error) {
        showMessage('forgotPasswordMessage', '⚠️ Network error. Backend may be offline. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📨 Send Reset Link';
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    
    const token = document.getElementById('resetToken').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (newPassword !== confirmPassword) {
        showMessage('resetPasswordMessage', '❌ Passwords do not match', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Resetting...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                token,
                new_password: newPassword 
            })
        });
        
        if (response.ok) {
            showMessage('resetPasswordMessage', '✅ Password reset successful! Please login.', 'success');
            document.getElementById('resetPasswordForm').reset();
            setTimeout(() => {
                closeModal('resetPasswordModal');
                showModal('loginModal');
            }, 2000);
        } else {
            const error = await response.json();
            showMessage('resetPasswordMessage', error.detail || 'Failed to reset password', 'error');
        }
    } catch (error) {
        showMessage('resetPasswordMessage', 'Network error. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✅ Reset Password';
    }
}

function showUserView() {
    document.getElementById('guestMenu').style.display = 'none';
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('username').textContent = currentUser.username;
    
    // Show "My Polls" filter button for logged in users
    const myPollsBtn = document.querySelector('[data-filter="my"]');
    if (myPollsBtn) myPollsBtn.style.display = 'inline-block';
    
    // Start notification polling
    startNotificationPolling();
    
    // Initialize badge count to prevent false notifications on first login
    initializeBadgeCount();
    
    // Activity feed temporarily disabled - will be fixed later
    // loadActivityFeed(true);
    // startActivityAutoRefresh();
    
    // Check if this is user's first time logging in
    checkAndStartTourForUser();
}

function showGuestView() {
    document.getElementById('guestMenu').style.display = 'flex';
    document.getElementById('userMenu').style.display = 'none';
    
    // Hide notification dropdown
    document.getElementById('notificationDropdown').style.display = 'none';
    updateNotificationBadge(0);
    
    // Stop notification polling
    stopNotificationPolling();
    
    // Hide "My Polls" filter button for guests
    const myPollsBtn = document.querySelector('[data-filter="my"]');
    if (myPollsBtn) {
        myPollsBtn.style.display = 'none';
        // If "My Polls" was active, switch to "All"
        if (myPollsBtn.classList.contains('active')) {
            myPollsBtn.classList.remove('active');
            document.querySelector('[data-filter="all"]').classList.add('active');
            loadPolls('all');
        }
    }
}

// Helper function to get current search parameters
function getCurrentSearchParams() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    
    return {
        search: searchInput ? searchInput.value : '',
        sort: sortSelect ? sortSelect.value : 'newest',
        dateFrom: dateFromInput ? dateFromInput.value : '',
        dateTo: dateToInput ? dateToInput.value : ''
    };
}

// Poll Functions
async function loadPolls(filter = 'all', searchParams = {}) {
    const pollsList = document.getElementById('pollsList');
    
    // Show skeleton loading
    pollsList.innerHTML = `
        ${Array(3).fill(0).map(() => `
            <div class="skeleton-poll-card">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text-short"></div>
            </div>
        `).join('')}
    `;
    
    try {
        // Build query parameters
        const queryParams = new URLSearchParams({
            active_only: 'false'
        });
        
        // Add search parameter
        if (searchParams.search && searchParams.search.trim()) {
            queryParams.append('search', searchParams.search.trim());
        }
        
        // Add sort parameter
        if (searchParams.sort) {
            queryParams.append('sort_by', searchParams.sort);
        }
        
        // Add date range parameters
        if (searchParams.dateFrom) {
            queryParams.append('date_from', searchParams.dateFrom);
        }
        if (searchParams.dateTo) {
            queryParams.append('date_to', searchParams.dateTo);
        }
        
        // Fetch all polls with filters
        const response = await fetch(`${API_BASE_URL}/api/polls?${queryParams.toString()}`);
        
        if (response.ok) {
            const polls = await response.json();
            
            let filteredPolls = polls;
            if (filter === 'my' && currentUser) {
                filteredPolls = polls.filter(p => p.owner_id === currentUser.id);
            } else if (filter === 'active') {
                filteredPolls = polls.filter(p => p.is_active);
            } else if (filter === 'closed') {
                filteredPolls = polls.filter(p => !p.is_active);
            }
            
            if (filteredPolls.length === 0) {
                // Context-aware empty state messages
                let emptyMessage = 'No polls found.';
                if (searchParams.search) {
                    emptyMessage = `No polls found matching "${escapeHtml(searchParams.search)}". Try a different search term.`;
                } else if (filter === 'my') {
                    emptyMessage = 'You haven\'t created any polls yet. Click "Create Poll" to get started!';
                } else if (filter === 'active') {
                    emptyMessage = 'No active polls found. Check the "Closed" tab for completed polls.';
                } else if (filter === 'closed') {
                    emptyMessage = 'No closed polls found. Active polls will appear here once they are closed.';
                }
                pollsList.innerHTML = `<p class="loading">${emptyMessage}</p>`;
            } else {
                pollsList.innerHTML = filteredPolls.map(poll => createPollCard(poll)).join('');
                
                // Add click listeners
                document.querySelectorAll('.poll-card').forEach(card => {
                    card.addEventListener('click', () => {
                        loadPollDetail(card.dataset.pollId);
                    });
                });
            }
        } else {
            pollsList.innerHTML = '<p class="loading">Failed to load polls.</p>';
        }
    } catch (error) {
        console.error('Error loading polls:', error);
        pollsList.innerHTML = '<p class="loading">Network error. Please try again.</p>';
    }
}

// Categories functionality
let categories = [];
let selectedCategoryId = null;

async function loadCategories() {
    try {
        console.log('Loading categories from:', `${API_BASE_URL}/api/categories/`);
        const response = await fetch(`${API_BASE_URL}/api/categories/`);
        console.log('Categories response status:', response.status);
        if (response.ok) {
            categories = await response.json();
            console.log('Loaded categories:', categories);
            renderCategoryFilters();
            populateCategorySelect();
        } else {
            console.error('Failed to load categories. Status:', response.status, await response.text());
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    if (!container) return;
    
    const allButton = `
        <button class="category-filter-btn active" data-category="" onclick="filterByCategory(null)">
            <span class="category-icon">📊</span>
            <span class="category-name">All</span>
        </button>
    `;
    
    const categoryButtons = categories.map(cat => `
        <button class="category-filter-btn" data-category="${cat.id}" onclick="filterByCategory(${cat.id})">
            <span class="category-icon">${cat.icon || '📂'}</span>
            <span class="category-name">${escapeHtml(cat.name)}</span>
        </button>
    `).join('');
    
    container.innerHTML = allButton + categoryButtons;
}

function populateCategorySelect() {
    const select = document.getElementById('pollCategory');
    if (!select) return;
    
    const options = categories.map(cat => 
        `<option value="${cat.id}">${cat.icon || '📂'} ${escapeHtml(cat.name)}</option>`
    ).join('');
    
    select.innerHTML = '<option value="">Select a category (optional)</option>' + options;
}

async function filterByCategory(categoryId) {
    selectedCategoryId = categoryId;
    
    // Update active state
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
        if (btn.dataset.category === (categoryId ? String(categoryId) : '')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Reload polls with category filter
    const pollsList = document.getElementById('pollsList');
    pollsList.innerHTML = `
        ${Array(3).fill(0).map(() => `
            <div class="skeleton-poll-card">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text-short"></div>
            </div>
        `).join('')}
    `;
    
    try {
        const queryParams = new URLSearchParams({ active_only: 'false' });
        if (categoryId) {
            queryParams.append('category_id', categoryId);
        }
        
        // Include current search params
        const search = document.getElementById('searchInput')?.value;
        if (search && search.trim()) {
            queryParams.append('search', search.trim());
        }
        
        const response = await fetch(`${API_BASE_URL}/api/polls?${queryParams.toString()}`);
        
        if (response.ok) {
            const polls = await response.json();
            
            if (polls.length === 0) {
                const categoryName = categories.find(c => c.id === categoryId)?.name || 'this category';
                pollsList.innerHTML = `<p class="loading">No polls found in ${categoryName}.</p>`;
            } else {
                pollsList.innerHTML = polls.map(poll => createPollCard(poll)).join('');
                
                // Add click listeners
                document.querySelectorAll('.poll-card').forEach(card => {
                    card.addEventListener('click', () => {
                        loadPollDetail(card.dataset.pollId);
                    });
                });
            }
        } else {
            pollsList.innerHTML = '<p class="loading">Failed to load polls.</p>';
        }
    } catch (error) {
        console.error('Error filtering polls:', error);
        pollsList.innerHTML = '<p class="loading">Network error. Please try again.</p>';
    }
}

function createPollCard(poll) {
    const date = new Date(poll.created_at).toLocaleDateString();
    const statusBadge = poll.is_active 
        ? '<span class="badge badge-active">🟢 Active</span>' 
        : '<span class="badge badge-closed">🔴 Closed</span>';
    
    // Creator info
    const creatorAvatar = poll.owner_profile_picture 
        ? `<img src="${escapeHtml(poll.owner_profile_picture)}" alt="${escapeHtml(poll.owner_username || 'User')}" class="creator-avatar">` 
        : '<span class="creator-avatar-placeholder">👤</span>';
    const creatorName = poll.owner_username || 'Anonymous';
    
    // Make creator clickable if we have owner info
    const creatorClickable = poll.owner_id ? `onclick="event.stopPropagation(); viewUserProfile(${poll.owner_id})" style="cursor: pointer;"` : '';
    
    // Category badge
    let categoryBadge = '';
    if (poll.category_name) {
        const categoryIcon = poll.category_icon || '📂';
        categoryBadge = `<div class="poll-category-badge" style="background: ${poll.category_color}15; color: ${poll.category_color}">
            <span class="category-icon">${categoryIcon}</span>
            <span>${escapeHtml(poll.category_name)}</span>
        </div>`;
    }
    
    // Tags
    let tagsHtml = '';
    if (poll.tags && poll.tags.length > 0) {
        const tagsArray = typeof poll.tags === 'string' ? poll.tags.split(',').map(t => t.trim()) : poll.tags;
        tagsHtml = '<div class="poll-tags">' + 
            tagsArray.map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('') +
            '</div>';
    }
    
    return `
        <div class="poll-card" data-poll-id="${poll.id}">
            ${categoryBadge}
            <div class="poll-card-header">
                <h3>${escapeHtml(poll.title)}</h3>
                ${statusBadge}
            </div>
            <p>${escapeHtml(poll.description || 'No description')}</p>
            ${tagsHtml}
            <div class="poll-creator" ${creatorClickable} title="${poll.owner_id ? 'Click to view profile' : ''}">
                ${creatorAvatar}
                <span class="creator-name">Created by ${escapeHtml(creatorName)}</span>
            </div>
            <div class="poll-meta">
                <span>📊 ${poll.total_votes} votes</span>
                <span>❤️ ${poll.like_count} likes</span>
                <span>📅 ${date}</span>
            </div>
            <div class="poll-actions">
                <button class="btn-share" onclick="event.stopPropagation(); openShareModal(${poll.id}, '${escapeHtml(poll.title)}')">🔗 Share</button>
            </div>
        </div>
    `;
}

async function loadPollDetail(pollId) {
    currentPollId = pollId;
    
    // Show loading state immediately
    document.getElementById('pollsSection').style.display = 'none';
    document.getElementById('pollDetailSection').style.display = 'block';
    document.getElementById('pollDetail').innerHTML = `
        <div class="loading-state" style="text-align: center; padding: 60px 20px;">
            <div class="spinner" style="width: 60px; height: 60px; border: 4px solid #f3f3f3; border-top: 4px solid #4a90e2; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <p style="color: #666; font-size: 1.1em;">Loading poll details...</p>
        </div>
    `;
    
    try {
        const headers = {};
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}`, { headers });
        
        if (response.ok) {
            const poll = await response.json();
            displayPollDetail(poll);
            
            // Connect WebSocket for live updates
            connectPollWebSocket(pollId);
        } else {
            const error = await response.json().catch(() => ({ detail: 'Failed to load poll details' }));
            document.getElementById('pollDetail').innerHTML = `
                <div class="error-message">
                    <h3>❌ Error Loading Poll</h3>
                    <p>${error.detail || 'Failed to load poll details'}</p>
                    <button class="btn btn-primary" onclick="showPollsList()">Back to Polls</button>
                </div>
            `;
            document.getElementById('pollsSection').style.display = 'none';
            document.getElementById('pollDetailSection').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading poll:', error);
        document.getElementById('pollDetail').innerHTML = `
            <div class="error-message">
                <h3>❌ Network Error</h3>
                <p>Could not connect to the server. Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="showPollsList()">Back to Polls</button>
            </div>
        `;
        document.getElementById('pollsSection').style.display = 'none';
        document.getElementById('pollDetailSection').style.display = 'block';
    }
}

function displayPollDetail(poll) {
    console.log('📊 Poll Data:', {
        id: poll.id,
        allow_anonymous_votes: poll.allow_anonymous_votes,
        allow_anonymous_comments: poll.allow_anonymous_comments,
        is_active: poll.is_active,
        user_has_voted: poll.user_has_voted,
        tags: poll.tags,
        description: poll.description
    });
    
    document.getElementById('pollsSection').style.display = 'none';
    document.getElementById('pollDetailSection').style.display = 'block';
    
    const isOwner = currentUser && poll.owner_id === currentUser.id;
    const hasVoted = poll.user_has_voted;
    const canVote = poll.is_active && (!hasVoted || poll.allow_multiple_votes);
    const needsAuth = !poll.allow_anonymous_votes && !currentUser;
    
    // Creator info for poll detail
    const creatorAvatar = poll.owner_profile_picture 
        ? `<img src="${escapeHtml(poll.owner_profile_picture)}" alt="${escapeHtml(poll.owner_username || 'User')}" class="creator-avatar">` 
        : '<span class="creator-avatar-placeholder">👤</span>';
    const creatorName = poll.owner_username || 'Anonymous';
    const creatorClickable = poll.owner_id ? `onclick="viewUserProfile(${poll.owner_id})" style="cursor: pointer;"` : '';
    
    // Category badge for detail view
    let categoryBadge = '';
    if (poll.category_name) {
        const categoryIcon = poll.category_icon || '📂';
        categoryBadge = `<div class="poll-category-badge" style="background: ${poll.category_color}15; color: ${poll.category_color}; margin-bottom: 15px;">
            <span class="category-icon">${categoryIcon}</span>
            <span>${escapeHtml(poll.category_name)}</span>
        </div>`;
    }
    
    // Tags display
    let tagsHtml = '';
    if (poll.tags && poll.tags.length > 0) {
        const tagsArray = typeof poll.tags === 'string' ? poll.tags.split(',').map(t => t.trim()) : poll.tags;
        tagsHtml = `<div class="poll-tags" style="margin-bottom: 15px;">
            ${tagsArray.map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}
        </div>`;
    }
    
    const pollDetailHtml = `
        <div class="poll-detail">
            <p class="form-message" id="pollDetailMessage" style="display: none;"></p>
            <h2>${escapeHtml(poll.title)}</h2>
            ${categoryBadge}
            ${poll.description ? `<p class="poll-description" style="margin: 15px 0; font-size: 1rem; line-height: 1.6; color: var(--text-secondary);">${escapeHtml(poll.description)}</p>` : ''}
            ${tagsHtml}
            
            <!-- Poll Creator in Detail View -->
            <div class="poll-creator" ${creatorClickable} title="${poll.owner_id ? 'Click to view profile' : ''}">
                ${creatorAvatar}
                <span class="creator-name">Created by ${escapeHtml(creatorName)}</span>
            </div>
            
            <div class="poll-detail-meta">
                <span>📊 ${poll.total_votes} total votes</span>
                <span>❤️ ${poll.like_count} likes</span>
                <span>📅 ${new Date(poll.created_at).toLocaleString()}</span>
                ${poll.expires_at ? `<span>⏰ Expires: ${new Date(poll.expires_at).toLocaleString()}</span>` : ''}
                <span>${poll.is_active ? '🟢 Active' : '🔴 Closed'}</span>
            </div>
            
            <div class="poll-actions">
                <button class="btn-share" onclick="openShareModal(${poll.id}, '${escapeHtml(poll.title)}')">🔗 Share Poll</button>
                ${currentUser && poll.is_active ? `
                    <button class="btn ${poll.user_has_liked ? 'btn-danger' : 'btn-secondary'}" id="likeBtn">
                        ${poll.user_has_liked ? `❤️ Unlike (${poll.like_count})` : `🤍 Like (${poll.like_count})`}
                    </button>
                ` : ''}
                ${isOwner ? `
                    <button class="btn btn-secondary" id="editPollBtn">✏️ Edit</button>
                    ${poll.is_active ? `
                        <button class="btn btn-warning" id="closePollBtn">🔒 Close Poll</button>
                    ` : ''}
                    <button class="btn btn-danger" id="deletePollBtn">🗑️ Delete</button>
                ` : ''}
            </div>
            
            <!-- Emoji Reactions -->
            <div class="reactions-container">
                <h4>Quick Reactions</h4>
                ${createReactionPicker('poll', poll.id)}
            </div>
            
            <div class="poll-options" id="pollOptions">${poll.options.map(option => createPollOption(option, poll, hasVoted)).join('')}
            </div>
            
            ${!currentUser && poll.is_active && !poll.allow_anonymous_votes ? `
                <div class="info-message">
                    ℹ️ <strong>Please sign in to vote on this poll</strong>
                    <button class="btn btn-primary" onclick="document.getElementById('loginBtn').click()">Sign In</button>
                </div>
            ` : ''}
            
            ${canVote && (currentUser || poll.allow_anonymous_votes) ? `
                <button class="btn btn-primary" id="submitVoteBtn">Submit Vote</button>
            ` : ''}
            
            ${hasVoted && currentUser && poll.is_active && !poll.allow_multiple_votes ? `
                <button class="btn btn-secondary" id="changeVoteBtn">🔄 Change Vote</button>
            ` : ''}
            
            ${hasVoted && currentUser && poll.is_active ? `
                <div class="info-message success-message">
                    ${poll.allow_multiple_votes ? 
                        '✅ <strong>Thank you for voting!</strong> You can vote again if you change your mind.' : 
                        '✅ <strong>Thank you for voting!</strong> Your vote has been recorded.'}
                </div>
            ` : ''}
            
            ${!poll.is_active ? `
                <div class="info-message">
                    🔒 <strong>This poll is closed</strong>
                </div>
            ` : ''}
            
            <div class="chart-container">
                <canvas id="pollChart"></canvas>
            </div>
            
            <!-- Comments Section -->
            <div class="comments-section">
                <h3>💬 Comments & Discussion</h3>
                
                ${currentUser || poll.allow_anonymous_comments ? `
                    <div class="comment-form">
                        <textarea id="newCommentText" placeholder="Share your thoughts..." maxlength="2000" rows="3"></textarea>
                        <div class="comment-form-footer">
                            <span class="char-count"><span id="commentCharCount">0</span>/2000</span>
                            <button class="btn btn-primary" id="submitCommentBtn" data-poll-id="${poll.id}" data-allow-anonymous="${poll.allow_anonymous_comments}">Post Comment</button>
                        </div>
                    </div>
                ` : `
                    <div class="info-message">
                        ℹ️ <strong>Sign in to join the discussion</strong>
                        <button class="btn btn-primary" onclick="document.getElementById('loginBtn').click()">Sign In</button>
                    </div>
                `}
                
                <div id="commentsList" class="comments-list">
                    <p class="loading">Loading comments...</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('pollDetail').innerHTML = pollDetailHtml;
    
    // Setup event listeners
    if (currentUser && poll.is_active) {
        const likeBtn = document.getElementById('likeBtn');
        if (likeBtn) {
            likeBtn.addEventListener('click', () => toggleLike(poll.id));
        }
    }
    
    if (canVote && (currentUser || poll.allow_anonymous_votes)) {
        document.querySelectorAll('.poll-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.poll-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        const submitBtn = document.getElementById('submitVoteBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => submitVote(poll.id, poll.allow_anonymous_votes));
        }
    }
    
    // Handle change vote button (for users who already voted)
    if (hasVoted && currentUser && poll.is_active && !poll.allow_multiple_votes) {
        const changeVoteBtn = document.getElementById('changeVoteBtn');
        if (changeVoteBtn) {
            changeVoteBtn.addEventListener('click', () => enableVoteChange(poll));
        }
    }
    
    if (isOwner) {
        const editBtn = document.getElementById('editPollBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => editPoll(poll));
        }
        
        const closePollBtn = document.getElementById('closePollBtn');
        if (closePollBtn) {
            closePollBtn.addEventListener('click', () => closePoll(poll.id));
        }
        
        const deleteBtn = document.getElementById('deletePollBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deletePoll(poll.id));
        }
    }
    
    // Render chart
    renderPollChart(poll);
    
    // Animate poll results
    setTimeout(() => {
        animatePollResults();
    }, 100); // Small delay to ensure DOM is ready
    
    // Load comments
    loadComments(poll.id);
    
    // Load emoji reactions
    loadPollReactions(poll.id);
    
    // Start poll detail tour for first-time users (only if logged in)
    if (currentUser && currentUser.id && !hasSeenTour(currentUser.id, TOUR_TYPES.POLL_DETAIL)) {
        setTimeout(() => {
            startPollDetailTour();
        }, 1200);
    }
    
    // Setup comment form if available (for logged in users OR anonymous commenting)
    if (currentUser || poll.allow_anonymous_comments) {
        const commentText = document.getElementById('newCommentText');
        const charCount = document.getElementById('commentCharCount');
        const submitCommentBtn = document.getElementById('submitCommentBtn');
        
        console.log('📝 Setting up comment form:', {
            hasCommentText: !!commentText,
            hasCharCount: !!charCount,
            hasSubmitBtn: !!submitCommentBtn,
            allowAnonymous: poll.allow_anonymous_comments
        });
        
        if (commentText && charCount) {
            commentText.addEventListener('input', () => {
                charCount.textContent = commentText.value.length;
            });
        }
        
        if (submitCommentBtn) {
            console.log('✅ Attaching click listener to comment button');
            submitCommentBtn.addEventListener('click', () => {
                const allowAnonymous = submitCommentBtn.dataset.allowAnonymous === 'true';
                console.log('🖱️ Comment button clicked!', { allowAnonymous });
                submitComment(poll.id, null, allowAnonymous);
            });
        } else {
            console.error('❌ Submit comment button not found!');
        }
    } else {
        console.log('⚠️ Comment form not set up - user not logged in and anonymous comments not allowed');
    }
}

function createPollOption(option, poll, hasVoted) {
    const percentage = poll.total_votes > 0 
        ? ((option.vote_count / poll.total_votes) * 100).toFixed(1) 
        : 0;
    
    // Determine color category based on percentage
    let percentageCategory = 'low';
    if (percentage >= 60) {
        percentageCategory = 'high';
    } else if (percentage >= 30) {
        percentageCategory = 'medium';
    }
    
    // Check if this is the winning option
    const isWinning = poll.total_votes > 0 && option.vote_count === Math.max(...poll.options.map(o => o.vote_count)) && option.vote_count > 0;
    
    return `
        <div class="poll-option ${!hasVoted && currentUser && poll.is_active ? 'selectable' : ''} ${isWinning ? 'winning' : ''}" 
             data-option-id="${option.id}">
            <div class="poll-option-text">${escapeHtml(option.text)}</div>
            <div class="poll-option-bar">
                <div class="poll-option-fill" 
                     data-percentage="${percentageCategory}"
                     data-target-width="${percentage}"
                     style="width: 0%"></div>
            </div>
            <div class="poll-option-stats">
                <span class="vote-count-number" data-target="${option.vote_count}">0</span>
                <span class="percentage-number" data-target="${percentage}">0%</span>
            </div>
        </div>
    `;
}

// Animate poll results with CountUp.js and enhanced visuals
function animatePollResults() {
    // Animate progress bars with stagger effect
    const progressBars = document.querySelectorAll('.poll-option-fill[data-target-width]');
    progressBars.forEach((bar, index) => {
        const targetWidth = parseFloat(bar.dataset.targetWidth);
        
        // Stagger animations for visual appeal
        setTimeout(() => {
            bar.style.width = `${targetWidth}%`;
            
            // Add completion ripple effect for high percentages
            if (targetWidth > 50) {
                setTimeout(() => {
                    bar.style.transform = 'scaleY(1.1)';
                    setTimeout(() => {
                        bar.style.transform = 'scaleY(1)';
                    }, 200);
                }, 1500);
            }
        }, index * 150); // Increased stagger delay
    });
    
    // Animate vote counts with CountUp.js
    const voteCountElements = document.querySelectorAll('.vote-count-number[data-target]');
    voteCountElements.forEach((el, index) => {
        const target = parseInt(el.dataset.target);
        
        setTimeout(() => {
            if (typeof CountUp !== 'undefined') {
                const countUp = new CountUp(el, target, {
                    duration: 2,
                    useEasing: true,
                    useGrouping: true,
                    suffix: target === 1 ? ' vote' : ' votes',
                    easingFn: (t, b, c, d) => {
                        // Custom easing function for smooth deceleration
                        return c * ((t = t / d - 1) * t * t + 1) + b;
                    }
                });
                
                if (!countUp.error) {
                    countUp.start();
                } else {
                    el.textContent = `${target} vote${target !== 1 ? 's' : ''}`;
                }
            } else {
                el.textContent = `${target} vote${target !== 1 ? 's' : ''}`;
            }
        }, index * 150);
    });
    
    // Animate percentages with CountUp.js
    const percentageElements = document.querySelectorAll('.percentage-number[data-target]');
    percentageElements.forEach((el, index) => {
        const target = parseFloat(el.dataset.target);
        
        setTimeout(() => {
            if (typeof CountUp !== 'undefined') {
                const countUp = new CountUp(el, target, {
                    duration: 2,
                    useEasing: true,
                    decimalPlaces: 1,
                    suffix: '%',
                    easingFn: (t, b, c, d) => {
                        // Custom easing function for smooth deceleration
                        return c * ((t = t / d - 1) * t * t + 1) + b;
                    }
                });
                
                if (!countUp.error) {
                    countUp.start(() => {
                        // Add subtle pulse effect after animation completes
                        if (target > 50) {
                            el.style.transform = 'scale(1.1)';
                            setTimeout(() => {
                                el.style.transform = 'scale(1)';
                            }, 200);
                        }
                    });
                } else {
                    el.textContent = `${target}%`;
                }
            } else {
                el.textContent = `${target}%`;
            }
        }, index * 150);
    });
    
    // Add confetti for winning option if votes exist
    setTimeout(() => {
        const winningOption = document.querySelector('.poll-option.winning');
        if (winningOption && typeof confetti !== 'undefined') {
            const rect = winningOption.getBoundingClientRect();
            const x = (rect.left + rect.width / 2) / window.innerWidth;
            const y = (rect.top + rect.height / 2) / window.innerHeight;
            
            confetti({
                particleCount: 30,
                spread: 60,
                origin: { x, y },
                colors: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
                ticks: 100,
                gravity: 1.2,
                scalar: 0.8
            });
        }
    }, 1800); // Fire confetti near end of animations
}

function renderPollChart(poll) {
    const ctx = document.getElementById('pollChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (pollChart) {
        pollChart.destroy();
    }
    
    pollChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: poll.options.map(o => o.text),
            datasets: [{
                label: 'Votes',
                data: poll.options.map(o => o.vote_count),
                backgroundColor: '#4F46E5',
                borderColor: '#4338CA',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

async function submitVote(pollId, allowAnonymous = false) {
    console.log('🗳️ Submit Vote:', { pollId, allowAnonymous, hasToken: !!currentToken });
    
    const selectedOption = document.querySelector('.poll-option.selected');
    if (!selectedOption) {
        showPollMessage('⚠️ Please select an option', 'error');
        return;
    }
    
    const optionId = parseInt(selectedOption.dataset.optionId);
    const submitBtn = document.getElementById('submitVoteBtn');
    
    // Disable submit button and show loading state
    if (submitBtn) {
        setButtonLoading(submitBtn, true);
    }
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Only send auth token if user is logged in
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        console.log('📤 Sending vote request...', { optionId, hasAuth: !!currentToken });
        
        const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}/vote`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ option_id: optionId })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // 🎊 Small confetti for voting!
            if (typeof confetti !== 'undefined') {
                confetti({
                    particleCount: 30,
                    spread: 50,
                    origin: { y: 0.7 },
                    colors: ['#4F46E5', '#10B981', '#F59E0B']
                });
            }
            
            // Show success message
            showSuccessToast('Your vote has been recorded!', 'Vote Submitted');
            showPollMessage('✅ Vote submitted successfully!', 'success');
            
            // Show success state on button
            if (submitBtn) {
                setButtonSuccess(submitBtn);
            }
            
            // Optimistic update: immediately update vote counts in the UI
            const optionElements = document.querySelectorAll('.poll-option');
            optionElements.forEach(el => {
                const elOptionId = parseInt(el.dataset.optionId);
                const voteCountEl = el.querySelector('.vote-count');
                const progressBar = el.querySelector('.vote-progress');
                
                // Find matching option from server response
                const serverOption = data.poll?.options?.find(opt => opt.id === elOptionId);
                if (serverOption && voteCountEl) {
                    voteCountEl.textContent = `${serverOption.vote_count} votes`;
                    
                    // Update progress bar if present
                    if (progressBar && data.poll?.total_votes > 0) {
                        const percentage = (serverOption.vote_count / data.poll.total_votes) * 100;
                        progressBar.style.width = `${percentage}%`;
                    }
                }
            });
            
            // Update total votes count
            const totalVotesEl = document.querySelector('.total-votes');
            if (totalVotesEl && data.poll?.total_votes !== undefined) {
                totalVotesEl.textContent = `🗳️ ${data.poll.total_votes} total votes`;
            }
            
            // Deselect option and disable voting UI
            selectedOption.classList.remove('selected');
            optionElements.forEach(el => el.style.pointerEvents = 'none');
            if (submitBtn) submitBtn.style.display = 'none';
            
            // Check for new badges
            checkForNewBadges();
            
        } else if (response.status === 400) {
            const error = await response.json();
            showErrorToast(error.detail || 'Cannot submit vote');
            showPollMessage(`⚠️ ${error.detail || 'Cannot submit vote'}`, 'error');
            if (submitBtn) {
                setButtonLoading(submitBtn, false);
            }
        } else if (response.status === 401) {
            // Only show sign-in message if poll doesn't allow anonymous voting
            if (!allowAnonymous) {
                showErrorToast('Please sign in to vote on this poll');
                showPollMessage('⚠️ Please sign in to vote on this poll', 'error');
            } else {
                const error = await response.json().catch(() => ({ detail: 'Authentication failed' }));
                showErrorToast(error.detail || 'Failed to submit vote');
                showPollMessage(`❌ ${error.detail || 'Failed to submit vote'}`, 'error');
            }
            if (submitBtn) {
                setButtonLoading(submitBtn, false);
            }
        } else {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            showErrorToast(error.detail || 'Failed to submit vote');
            showPollMessage(`❌ ${error.detail || 'Failed to submit vote'}`, 'error');
            if (submitBtn) {
                setButtonLoading(submitBtn, false);
            }
        }
    } catch (error) {
        console.error('Error submitting vote:', error);
        showErrorToast('Network error. Please check your connection.');
        showPollMessage('❌ Network error. Please check if the backend server is running.', 'error');
        if (submitBtn) {
            setButtonLoading(submitBtn, false);
        }
    }
}

function enableVoteChange(poll) {
    // Enable selection on poll options
    document.querySelectorAll('.poll-option').forEach(option => {
        option.classList.add('selectable');
        option.addEventListener('click', () => {
            document.querySelectorAll('.poll-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // Replace "Change Vote" button with "Update Vote" button
    const changeVoteBtn = document.getElementById('changeVoteBtn');
    if (changeVoteBtn) {
        changeVoteBtn.outerHTML = `<button class="btn btn-primary" id="updateVoteBtn">💾 Update Vote</button>`;
        
        const updateVoteBtn = document.getElementById('updateVoteBtn');
        if (updateVoteBtn) {
            updateVoteBtn.addEventListener('click', () => updateVote(poll.id));
        }
    }
    
    // Show info message
    const messageEl = document.getElementById('pollDetailMessage');
    if (messageEl) {
        messageEl.textContent = 'ℹ️ Select a new option and click "Update Vote"';
        messageEl.className = 'form-message info';
        messageEl.style.display = 'block';
    }
}

async function updateVote(pollId) {
    const selectedOption = document.querySelector('.poll-option.selected');
    if (!selectedOption) {
        showPollMessage('⚠️ Please select an option', 'error');
        return;
    }
    
    const optionId = parseInt(selectedOption.dataset.optionId);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}/vote`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ option_id: optionId })
        });
        
        if (response.ok) {
            showPollMessage('✅ Vote updated successfully!', 'success');
            
            // Reload poll to show updated results
            setTimeout(() => {
                loadPollDetail(pollId);
            }, 1000);
        } else if (response.status === 405) {
            showPollMessage('⚠️ Please restart the backend server to enable vote editing', 'error');
        } else if (response.status === 404) {
            showPollMessage('⚠️ You haven\'t voted on this poll yet', 'error');
        } else if (response.status === 400) {
            const error = await response.json();
            showPollMessage(`⚠️ ${error.detail || 'Cannot update vote'}`, 'error');
        } else {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            showPollMessage(`❌ ${error.detail || 'Failed to update vote'}`, 'error');
        }
    } catch (error) {
        console.error('Error updating vote:', error);
        showPollMessage('❌ Network error. Please check if the backend server is running.', 'error');
    }
}

function showPollMessage(message, type = 'info') {
    const messageEl = document.getElementById('pollDetailMessage');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `form-message ${type === 'success' ? 'success' : 'error'}`;
        messageEl.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 2000);
        }
    }
}

async function toggleLike(pollId) {
    const likeBtn = document.getElementById('likeBtn');
    const likeCountElements = document.querySelectorAll('.like-count');
    
    if (!likeBtn) return;
    
    // Get current state
    const isLiked = likeBtn.classList.contains('btn-danger');
    const currentCount = parseInt(likeBtn.textContent.match(/\d+/)?.[0] || 0);
    
    // Optimistic UI update (instant feedback)
    const newCount = isLiked ? currentCount - 1 : currentCount + 1;
    likeBtn.classList.toggle('btn-danger');
    likeBtn.classList.toggle('btn-secondary');
    likeBtn.innerHTML = isLiked ? `🤍 Like (${newCount})` : `❤️ Unlike (${newCount})`;
    
    // Update all like count displays
    likeCountElements.forEach(el => {
        el.textContent = `❤️ ${newCount} likes`;
    });
    
    // Disable button during request
    likeBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Update with server values to ensure accuracy
            likeBtn.innerHTML = data.user_has_liked ? `❤️ Unlike (${data.like_count})` : `🤍 Like (${data.like_count})`;
            likeBtn.classList.toggle('btn-danger', data.user_has_liked);
            likeBtn.classList.toggle('btn-secondary', !data.user_has_liked);
            
            likeCountElements.forEach(el => {
                el.textContent = `❤️ ${data.like_count} likes`;
            });
            
            // Show toast notification
            if (data.user_has_liked) {
                showSuccessToast('You liked this poll!');
                // Check for new badges when liking
                checkForNewBadges();
            } else {
                showInfoToast('Like removed');
            }
        } else {
            // Revert on error
            likeBtn.classList.toggle('btn-danger');
            likeBtn.classList.toggle('btn-secondary');
            likeBtn.innerHTML = isLiked ? `❤️ Unlike (${currentCount})` : `🤍 Like (${currentCount})`;
            likeCountElements.forEach(el => {
                el.textContent = `❤️ ${currentCount} likes`;
            });
            showErrorToast('Failed to toggle like');
            showPollMessage('❌ Failed to toggle like', 'error');
        }
    } catch (error) {
        // Revert on error
        console.error('Error toggling like:', error);
        likeBtn.classList.toggle('btn-danger');
        likeBtn.classList.toggle('btn-secondary');
        likeBtn.innerHTML = isLiked ? `❤️ Unlike (${currentCount})` : `🤍 Like (${currentCount})`;
        likeCountElements.forEach(el => {
            el.textContent = `❤️ ${currentCount} likes`;
        });
        showErrorToast('Network error');
        showPollMessage('❌ Network error', 'error');
    } finally {
        likeBtn.disabled = false;
    }
}

async function deletePoll(pollId) {
    const confirmed = await customConfirm(
        '🗑️ Delete Poll',
        'Are you sure you want to delete this poll permanently? This action cannot be undone. All votes and data will be lost.',
        'Yes, Delete',
        'Cancel'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            showPollsList();
            loadPolls();
            // Show temporary success message
            const pollsList = document.getElementById('pollsList');
            pollsList.innerHTML = '<p class="success-message">✅ Poll deleted successfully!</p>' + pollsList.innerHTML;
            setTimeout(() => {
                const msg = pollsList.querySelector('.success-message');
                if (msg) msg.remove();
            }, 3000);
        } else {
            const error = await response.json().catch(() => ({ detail: 'Failed to delete poll' }));
            showErrorToast(error.detail || 'Failed to delete poll');
        }
    } catch (error) {
        console.error('Error deleting poll:', error);
        showErrorToast('Network error. Please try again.');
    }
}

async function closePoll(pollId) {
    const confirmed = await customConfirm(
        '🔒 Close Poll',
        'Are you sure you want to close this poll? Once closed, no one will be able to vote anymore. This action cannot be undone.',
        'Yes, Close Poll',
        'Cancel'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ is_active: false })
        });
        
        if (response.ok) {
            showSuccessToast('Poll has been closed successfully!', 'Poll Closed');
            showMessage('pollDetailMessage', 'Poll closed successfully! 🔒', 'success');
            loadPollDetail(pollId);
        } else {
            const error = await response.json();
            showErrorToast(error.detail || 'Failed to close poll');
            showMessage('pollDetailMessage', error.detail || 'Failed to close poll', 'error');
        }
    } catch (error) {
        console.error('Error closing poll:', error);
        showErrorToast('Network error. Please try again.');
        showMessage('pollDetailMessage', 'Network error. Please try again.', 'error');
    }
}

async function editPoll(poll) {
    // Store poll ID for submission
    document.getElementById('editPollForm').dataset.pollId = poll.id;
    
    console.log('📝 Edit Poll - Full data:', poll);
    console.log('📝 Tags received:', poll.tags, 'Type:', typeof poll.tags);
    
    // Populate form fields
    document.getElementById('editPollTitle').value = poll.title;
    document.getElementById('editPollDescription').value = poll.description || '';
    document.getElementById('editPollActive').checked = poll.is_active;
    
    // Populate category dropdown
    const categorySelect = document.getElementById('editPollCategory');
    if (categorySelect && categories && categories.length > 0) {
        categorySelect.innerHTML = '<option value="">Select a category (optional)</option>' +
            categories.map(cat => 
                `<option value="${cat.id}" ${poll.category_id === cat.id ? 'selected' : ''}>
                    ${cat.icon} ${escapeHtml(cat.name)}
                </option>`
            ).join('');
    }
    
    // Initialize tag inputs first
    initializeTagInputs();
    
    // Populate tags using the new tag input component
    if (tagInputs['editPollTags'] && poll.tags) {
        const tagsArray = Array.isArray(poll.tags) ? poll.tags : (poll.tags.split(',').map(t => t.trim()).filter(t => t));
        tagInputs['editPollTags'].setTags(tagsArray);
    }
    
    // Populate poll options
    const optionsContainer = document.getElementById('editPollOptions');
    if (poll.options && poll.options.length > 0) {
        optionsContainer.innerHTML = poll.options.map(option => `
            <div class="option-input">
                <input type="text" class="poll-option" value="${escapeHtml(option.text)}" data-option-id="${option.id}" required>
            </div>
        `).join('');
    } else {
        optionsContainer.innerHTML = '<p>No options available</p>';
    }
    
    // Populate settings checkboxes
    console.log('🔧 Edit Poll - Received data:', {
        allow_multiple_votes: poll.allow_multiple_votes,
        allow_anonymous_votes: poll.allow_anonymous_votes,
        allow_anonymous_comments: poll.allow_anonymous_comments
    });
    
    document.getElementById('editAllowMultipleVotes').checked = poll.allow_multiple_votes || false;
    document.getElementById('editAllowAnonymousVotes').checked = poll.allow_anonymous_votes || false;
    document.getElementById('editAllowAnonymousComments').checked = poll.allow_anonymous_comments || false;
    document.getElementById('editAllowAnonymousLikes').checked = poll.allow_anonymous_likes || false;
    
    // Clear any previous messages
    showMessage('editPollMessage', '', '');
    
    // Show modal
    showModal('editPollModal');
}

async function handleEditPoll(e) {
    e.preventDefault();
    
    const pollId = document.getElementById('editPollForm').dataset.pollId;
    const title = document.getElementById('editPollTitle').value.trim();
    const description = document.getElementById('editPollDescription').value.trim();
    const isActive = document.getElementById('editPollActive').checked;
    const categoryId = document.getElementById('editPollCategory')?.value;
    
    // Get tags from tag input component
    const tags = tagInputs['editPollTags'] ? tagInputs['editPollTags'].getTags() : [];
    
    // Get poll options
    const optionInputs = document.querySelectorAll('#editPollOptions .poll-option');
    const options = Array.from(optionInputs).map(input => ({
        id: parseInt(input.dataset.optionId),
        text: input && input.value ? input.value.trim() : ''
    })).filter(opt => opt.text); // Filter out empty options
    
    // Get settings checkboxes
    const allowMultipleVotes = document.getElementById('editAllowMultipleVotes').checked;
    const allowAnonymousVotes = document.getElementById('editAllowAnonymousVotes').checked;
    const allowAnonymousComments = document.getElementById('editAllowAnonymousComments').checked;
    const allowAnonymousLikes = document.getElementById('editAllowAnonymousLikes').checked;
    
    console.log('💾 Saving poll with settings:', {
        allowMultipleVotes,
        allowAnonymousVotes,
        allowAnonymousComments,
        allowAnonymousLikes
    });
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        setButtonLoading(submitBtn, true);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ 
                title: title,
                description: description,
                is_active: isActive,
                category_id: categoryId ? parseInt(categoryId) : null,
                tags: tags,
                options: options,
                allow_multiple_votes: allowMultipleVotes,
                allow_anonymous_votes: allowAnonymousVotes,
                allow_anonymous_comments: allowAnonymousComments,
                allow_anonymous_likes: allowAnonymousLikes
            })
        });
        
        if (response.ok) {
            if (submitBtn) {
                setButtonSuccess(submitBtn);
            }
            showSuccessToast('Poll has been updated successfully!', 'Poll Updated');
            closeModal('editPollModal');
            loadPollDetail(pollId);
            showMessage('pollDetailMessage', 'Poll updated successfully! ✅', 'success');
        } else {
            const error = await response.json();
            if (submitBtn) {
                setButtonLoading(submitBtn, false);
            }
            showErrorToast(error.detail || 'Failed to update poll');
            showMessage('editPollMessage', error.detail || 'Failed to update poll', 'error');
        }
    } catch (error) {
        console.error('Error updating poll:', error);
        if (submitBtn) {
            setButtonLoading(submitBtn, false);
        }
        showErrorToast('Network error. Please try again.');
        showMessage('editPollMessage', 'Network error. Please try again.', 'error');
    }
}

// WebSocket Functions
function connectPollWebSocket(pollId) {
    // Close existing connection
    if (pollWebSocket) {
        pollWebSocket.close();
    }
    
    pollWebSocket = new WebSocket(`${WS_BASE_URL}/ws/polls/${pollId}/results`);
    
    pollWebSocket.onmessage = (event) => {
        const results = JSON.parse(event.data);
        updatePollResults(results);
    };
    
    pollWebSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    pollWebSocket.onclose = () => {
        console.log('WebSocket connection closed');
    };
}

function updatePollResults(results) {
    // Find the winning option
    const maxVotes = Math.max(...results.options.map(o => o.vote_count));
    
    // Update vote counts in UI
    results.options.forEach(option => {
        const optionElement = document.querySelector(`[data-option-id="${option.id}"]`);
        if (optionElement) {
            const voteCount = option.vote_count;
            const percentage = option.percentage;
            
            // Determine color category
            let percentageCategory = 'low';
            if (percentage >= 60) {
                percentageCategory = 'high';
            } else if (percentage >= 30) {
                percentageCategory = 'medium';
            }
            
            // Update winning status
            const isWinning = voteCount === maxVotes && voteCount > 0;
            optionElement.classList.toggle('winning', isWinning);
            
            // Update progress bar with animation
            const fillElement = optionElement.querySelector('.poll-option-fill');
            if (fillElement) {
                fillElement.setAttribute('data-percentage', percentageCategory);
                fillElement.style.width = `${percentage}%`;
            }
            
            // Update stats with CountUp
            const voteCountEl = optionElement.querySelector('.vote-count-number');
            const percentageEl = optionElement.querySelector('.percentage-number');
            
            if (voteCountEl && typeof CountUp !== 'undefined') {
                const currentVotes = parseInt(voteCountEl.textContent) || 0;
                if (currentVotes !== voteCount) {
                    const countUp = new CountUp(voteCountEl, voteCount, {
                        startVal: currentVotes,
                        duration: 0.8,
                        useEasing: true,
                        suffix: voteCount === 1 ? ' vote' : ' votes'
                    });
                    if (!countUp.error) {
                        countUp.start();
                    } else {
                        voteCountEl.textContent = `${voteCount} vote${voteCount !== 1 ? 's' : ''}`;
                    }
                }
            } else if (voteCountEl) {
                voteCountEl.textContent = `${voteCount} vote${voteCount !== 1 ? 's' : ''}`;
            }
            
            if (percentageEl && typeof CountUp !== 'undefined') {
                const currentPercentage = parseFloat(percentageEl.textContent) || 0;
                if (Math.abs(currentPercentage - percentage) > 0.1) {
                    const countUp = new CountUp(percentageEl, percentage, {
                        startVal: currentPercentage,
                        duration: 0.8,
                        useEasing: true,
                        decimalPlaces: 1,
                        suffix: '%'
                    });
                    if (!countUp.error) {
                        countUp.start();
                    } else {
                        percentageEl.textContent = `${percentage}%`;
                    }
                }
            } else if (percentageEl) {
                percentageEl.textContent = `${percentage}%`;
            }
        }
    });
    
    // Update chart
    if (pollChart) {
        pollChart.data.datasets[0].data = results.options.map(o => o.vote_count);
        pollChart.update('none'); // Update without animation for real-time feel
    }
    
    // Update total votes
    const metaElement = document.querySelector('.poll-detail-meta');
    if (metaElement) {
        const votesSpan = metaElement.querySelector('span:first-child');
        if (votesSpan) {
            votesSpan.textContent = `📊 ${results.total_votes} total votes`;
        }
    }
}

// Poll Templates Configuration
const pollTemplates = {
    'blank': {
        name: 'Blank Poll',
        options: []
    },
    'yes-no': {
        name: 'Yes/No',
        options: ['Yes', 'No']
    },
    'true-false': {
        name: 'True/False',
        options: ['True', 'False']
    },
    'agree-disagree': {
        name: 'Agreement Scale',
        options: ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree']
    },
    'rating': {
        name: '5-Star Rating',
        options: ['⭐ 1 Star', '⭐⭐ 2 Stars', '⭐⭐⭐ 3 Stars', '⭐⭐⭐⭐ 4 Stars', '⭐⭐⭐⭐⭐ 5 Stars']
    },
    'thumbs': {
        name: 'Thumbs Up/Down',
        options: ['👍 Thumbs Up', '👎 Thumbs Down']
    }
};

// Apply poll template
function applyPollTemplate(templateKey) {
    const template = pollTemplates[templateKey];
    if (!template) return;
    
    const optionsContainer = document.getElementById('createPollOptions');
    
    // Clear existing options
    optionsContainer.innerHTML = '';
    
    // If blank template, add 2 empty options
    if (template.options.length === 0) {
        for (let i = 0; i < 2; i++) {
            const optionInput = document.createElement('div');
            optionInput.className = 'option-input';
            optionInput.innerHTML = `
                <input type="text" class="poll-option" placeholder="Option ${i + 1}" required>
                ${i > 1 ? '<button type="button" class="btn-remove-option" onclick="this.parentElement.remove()">×</button>' : ''}
            `;
            optionsContainer.appendChild(optionInput);
        }
    } else {
        // Add template options
        template.options.forEach((optionText, index) => {
            const optionInput = document.createElement('div');
            optionInput.className = 'option-input';
            optionInput.innerHTML = `
                <input type="text" class="poll-option" placeholder="Option ${index + 1}" value="${escapeHtml(optionText)}" required>
                ${index > 1 ? '<button type="button" class="btn-remove-option" onclick="this.parentElement.remove()">×</button>' : ''}
            `;
            optionsContainer.appendChild(optionInput);
        });
    }
    
    // Show success message
    showToast(`✨ ${template.name} template applied!`, 'success');
}

// Create Poll Functions
function addPollOption() {
    const optionsContainer = document.getElementById('createPollOptions');
    const optionCount = optionsContainer.querySelectorAll('.option-input').length;
    
    if (optionCount >= 10) {
        showMessage('Maximum 10 options allowed', 'error');
        return;
    }
    
    const optionInput = document.createElement('div');
    optionInput.className = 'option-input';
    optionInput.innerHTML = `
        <input type="text" class="poll-option" placeholder="Option ${optionCount + 1}" required>
        <button type="button" class="btn-remove-option" onclick="this.parentElement.remove()">×</button>
    `;
    optionsContainer.appendChild(optionInput);
}

// Tag Input Management
class TagInput {
    constructor(inputId, displayId, hiddenId) {
        this.input = document.getElementById(inputId);
        this.display = document.getElementById(displayId);
        this.hidden = document.getElementById(hiddenId);
        this.tags = [];
        
        if (!this.input || !this.display || !this.hidden) {
            console.warn('Tag input elements not found:', inputId, displayId, hiddenId);
            return;
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Handle Enter, comma, and space keys
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                e.preventDefault();
                this.addTag();
            } else if (e.key === 'Backspace' && this.input.value === '' && this.tags.length > 0) {
                // Remove last tag when backspace on empty input
                this.removeTag(this.tags.length - 1);
            }
        });
        
        // Handle paste with comma-separated values
        this.input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const tags = pastedText.split(/[,;\s]+/).filter(t => t.trim());
            tags.forEach(tag => {
                this.input.value = tag.trim();
                this.addTag();
            });
        });
        
        // Click on container to focus input
        this.display.parentElement.addEventListener('click', () => {
            this.input.focus();
        });
    }
    
    addTag() {
        const value = this.input.value.trim().replace(/[,\s]/g, '');
        
        if (value && !this.tags.includes(value) && this.tags.length < 10) {
            this.tags.push(value);
            this.render();
            this.input.value = '';
            this.updateHidden();
        } else if (this.tags.length >= 10) {
            showToast('⚠️ Maximum 10 tags allowed', 'warning');
        }
    }
    
    removeTag(index) {
        this.tags.splice(index, 1);
        this.render();
        this.updateHidden();
        this.input.focus();
    }
    
    render() {
        this.display.innerHTML = this.tags.map((tag, index) => `
            <span class="tag-item">
                ${escapeHtml(tag)}
                <button type="button" class="tag-remove" onclick="tagInputs['${this.hidden.id}'].removeTag(${index})">×</button>
            </span>
        `).join('');
    }
    
    updateHidden() {
        this.hidden.value = this.tags.join(',');
    }
    
    setTags(tags) {
        this.tags = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []);
        this.render();
        this.updateHidden();
    }
    
    getTags() {
        return this.tags;
    }
    
    clear() {
        this.tags = [];
        this.render();
        this.updateHidden();
        this.input.value = '';
    }
}

// Global tag inputs storage
const tagInputs = {};

// Initialize tag inputs when modals are shown
function initializeTagInputs() {
    // Create poll tags
    if (document.getElementById('pollTagsInput')) {
        tagInputs['pollTags'] = new TagInput('pollTagsInput', 'pollTagsDisplay', 'pollTags');
    }
    
    // Edit poll tags
    if (document.getElementById('editPollTagsInput')) {
        tagInputs['editPollTags'] = new TagInput('editPollTagsInput', 'editPollTagsDisplay', 'editPollTags');
    }
}

async function handleCreatePoll(e) {
    e.preventDefault();
    
    // Get submit button and add loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Creating Poll...';
    
    const title = document.getElementById('pollTitle').value;
    const description = document.getElementById('pollDescription').value;
    const categoryId = document.getElementById('pollCategory').value;
    
    // Get tags from tag input component
    const tags = tagInputs['pollTags'] ? tagInputs['pollTags'].getTags() : [];
    
    const duration = document.getElementById('pollDuration').value;
    const allowMultipleVotes = document.getElementById('allowMultipleVotes').checked;
    const allowAnonymousVotes = document.getElementById('allowAnonymousVotes').checked;
    const allowAnonymousComments = document.getElementById('allowAnonymousComments').checked;
    const allowAnonymousLikes = document.getElementById('allowAnonymousLikes').checked;
    const optionInputs = document.querySelectorAll('.poll-option');
    
    const options = Array.from(optionInputs)
        .map((input, idx) => ({
            text: input && input.value ? input.value.trim() : '',
            order: idx
        }))
        .filter(opt => opt.text);
    
    if (options.length < 2) {
        showMessage('createPollMessage', 'Please provide at least 2 options', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        return;
    }
    
    // Calculate expiration date
    let expiresAt = null;
    if (duration === 'custom') {
        const customDate = document.getElementById('pollExpiresAt').value;
        if (customDate) {
            expiresAt = new Date(customDate).toISOString();
        }
    } else if (duration) {
        const days = parseInt(duration);
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + days);
        expiresAt = expDate.toISOString();
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/polls`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                title,
                description: description || null,
                category_id: categoryId ? parseInt(categoryId) : null,
                tags: tags,
                allow_multiple_votes: allowMultipleVotes,
                allow_anonymous_votes: allowAnonymousVotes,
                allow_anonymous_comments: allowAnonymousComments,
                allow_anonymous_likes: allowAnonymousLikes,
                expires_at: expiresAt,
                options
            })
        });
        
        if (response.ok) {
            const poll = await response.json();
            closeModal('createPollModal');
            document.getElementById('createPollForm').reset();
            // Reset to default 2 options
            document.getElementById('pollOptions').innerHTML = `
                <div class="option-input">
                    <input type="text" class="poll-option" placeholder="Option 1" required>
                </div>
                <div class="option-input">
                    <input type="text" class="poll-option" placeholder="Option 2" required>
                </div>
            `;
            // Hide custom date field
            document.getElementById('customDateGroup').classList.add('hidden');
            
            // 🎉 Celebrate poll creation with confetti!
            if (typeof confetti !== 'undefined') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
            
            showSuccessNotification('🎉 Poll created successfully!');
            showSuccessToast(`Your poll "${poll.title}" has been created!`, 'Poll Created');
            
            // Clear tag input for next poll
            if (tagInputs['pollTags']) {
                tagInputs['pollTags'].clear();
            }
            
            loadPollDetail(poll.id);
            
            // Check for new badges
            checkForNewBadges();
        } else {
            const error = await response.json();
            showMessage('createPollMessage', error.detail || 'Failed to create poll', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Error creating poll:', error);
        showMessage('createPollMessage', 'Network error. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// UI Utility Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Message element not found: ${elementId}`);
        return;
    }
    element.textContent = message;
    element.className = `form-message ${type}`;
    element.style.display = 'block';
}

// Toast Notification System
function showToast(message, type = 'info', title = '', duration = 4000) {
    const container = document.getElementById('toastContainer');
    
    // Icons for different types
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    // Default titles
    const titles = {
        success: title || 'Success',
        error: title || 'Error',
        warning: title || 'Warning',
        info: title || 'Info'
    };
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close" onclick="removeToast(this.parentElement)">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }
    
    return toast;
}

function removeToast(toast) {
    if (!toast) return;
    
    toast.classList.add('toast-exit');
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 300); // Match animation duration
}

// Convenience functions
function showSuccessToast(message, title = '') {
    return showToast(message, 'success', title);
}

function showErrorToast(message, title = '') {
    return showToast(message, 'error', title);
}

function showWarningToast(message, title = '') {
    return showToast(message, 'warning', title);
}

function showInfoToast(message, title = '') {
    return showToast(message, 'info', title);
}

// Notification aliases (for backward compatibility)
function showSuccessNotification(message, title = '') {
    return showSuccessToast(message, title);
}

function showErrorNotification(message, title = '') {
    return showErrorToast(message, title);
}

function showWarningNotification(message, title = '') {
    return showWarningToast(message, title);
}

function showInfoNotification(message, title = '') {
    return showInfoToast(message, title);
}

// Button Loading State
function setButtonLoading(button, loading = true) {
    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.classList.add('btn-loading');
    } else {
        button.disabled = false;
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }
        button.classList.remove('btn-loading');
    }
}

function setButtonSuccess(button, duration = 2000) {
    button.classList.remove('btn-loading');
    button.classList.add('btn-success');
    button.disabled = true;
    
    setTimeout(() => {
        button.classList.remove('btn-success');
        button.disabled = false;
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }
    }, duration);
}

// Social Sharing Functions
function openShareModal(pollId, pollTitle) {
    // Generate shareable URL - using query parameter since it's an SPA
    const pollUrl = `${window.location.origin}${window.location.pathname}?poll=${pollId}`;
    const urlInput = document.getElementById('sharePollUrl');
    urlInput.value = pollUrl;
    
    // Store poll data for social sharing
    window.currentShareData = { pollId, pollTitle, pollUrl };
    
    // Show modal first
    showModal('sharePollModal');
    
    // Generate QR code (with built-in error handling)
    generateQRCode(pollUrl);
}

function copyShareUrl() {
    const urlInput = document.getElementById('sharePollUrl');
    const copyBtn = document.getElementById('copyShareUrlBtn');
    const successMsg = document.getElementById('copyUrlSuccess');
    
    // Copy to clipboard
    navigator.clipboard.writeText(urlInput.value).then(() => {
        // Show success message
        if (successMsg) {
            successMsg.style.display = 'block';
            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 2000);
        }
        
        // Update button text temporarily
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ Copied!';
        copyBtn.style.backgroundColor = '#22c55e';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.backgroundColor = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showErrorToast('Failed to copy URL. Please copy manually.');
    });
}

function generateQRCode(url) {
    const canvas = document.getElementById('qrCodeCanvas');
    const qrContainer = document.querySelector('.qr-code-container');
    
    if (!canvas || !qrContainer) {
        console.error('QR Code elements not found');
        return;
    }
    
    // Clear canvas
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Try to use QRCode library if available
    if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
        try {
            QRCode.toCanvas(canvas, url, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            }, (error) => {
                if (error) {
                    console.error('QR Code generation failed:', error);
                    // Fallback to API-based QR code
                    useQRCodeAPI(url, canvas);
                }
            });
        } catch (error) {
            console.error('QRCode library error:', error);
            // Fallback to API-based QR code
            useQRCodeAPI(url, canvas);
        }
    } else {
        // QRCode library not available, use API fallback
        useQRCodeAPI(url, canvas);
    }
}

function useQRCodeAPI(url, canvas) {
    // Use QR Server API as fallback (works on any platform)
    // This API is free and doesn't require authentication
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        const context = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 200;
        context.drawImage(img, 0, 0, 200, 200);
    };
    img.onerror = function() {
        console.error('QR Code API failed, trying alternative...');
        // Try alternative API
        const altQrApiUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(url)}`;
        const altImg = new Image();
        altImg.crossOrigin = 'anonymous';
        altImg.onload = function() {
            const context = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 200;
            context.drawImage(altImg, 0, 0, 200, 200);
        };
        altImg.onerror = function() {
            console.error('All QR Code APIs failed');
            // Show error message in canvas
            showQRCodeError(canvas, url);
        };
        altImg.src = altQrApiUrl;
    };
    img.src = qrApiUrl;
}

function showQRCodeError(canvas, url) {
    const context = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 200;
    context.fillStyle = '#f0f0f0';
    context.fillRect(0, 0, 200, 200);
    
    // Draw border
    context.strokeStyle = '#ddd';
    context.lineWidth = 2;
    context.strokeRect(0, 0, 200, 200);
    
    // Draw text
    context.fillStyle = '#666';
    context.font = 'bold 16px Arial';
    context.textAlign = 'center';
    context.fillText('QR Code', 100, 80);
    
    context.font = '12px Arial';
    context.fillText('Generation', 100, 100);
    context.fillText('Failed', 100, 115);
    
    // Add copy link suggestion
    context.font = '10px Arial';
    context.fillStyle = '#999';
    context.fillText('Use copy link instead', 100, 140);
}

function shareToTwitter() {
    if (!window.currentShareData) return;
    
    const { pollUrl, pollTitle } = window.currentShareData;
    const text = `Check out this poll: ${pollTitle}`;
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pollUrl)}&text=${encodeURIComponent(text)}`;
    
    window.open(twitterUrl, '_blank', 'width=550,height=420');
}

function shareToFacebook() {
    if (!window.currentShareData) return;
    
    const { pollUrl } = window.currentShareData;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pollUrl)}`;
    
    window.open(facebookUrl, '_blank', 'width=550,height=420');
}

function shareToWhatsApp() {
    if (!window.currentShareData) return;
    
    const { pollUrl, pollTitle } = window.currentShareData;
    const text = `Check out this poll: ${pollTitle} - ${pollUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    
    window.open(whatsappUrl, '_blank');
}

function shareToEmail() {
    if (!window.currentShareData) return;
    
    const { pollUrl, pollTitle } = window.currentShareData;
    const subject = `Vote on this poll: ${pollTitle}`;
    const body = `Hi,\n\nI thought you might be interested in this poll:\n\n${pollTitle}\n\n${pollUrl}\n\nCast your vote and see what others think!`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function downloadQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `poll-qr-code-${window.currentShareData?.pollId || 'unknown'}.png`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
    });
}

// Custom Confirmation Modal
function customConfirm(title, message, confirmText = 'Yes, Delete', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYesBtn');
        const noBtn = document.getElementById('confirmNoBtn');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        yesBtn.textContent = confirmText;
        noBtn.textContent = cancelText;
        
        // Remove old listeners
        const newYesBtn = yesBtn.cloneNode(true);
        const newNoBtn = noBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
        noBtn.parentNode.replaceChild(newNoBtn, noBtn);
        
        // Add new listeners
        newYesBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            resolve(true);
        });
        
        newNoBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            resolve(false);
        });
        
        // Show modal
        modal.style.display = 'block';
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve(false);
            }
        });
    });
}

function showPollsList() {
    if (pollWebSocket) {
        pollWebSocket.close();
    }
    if (pollChart) {
        pollChart.destroy();
    }
    document.getElementById('pollsSection').style.display = 'block';
    document.getElementById('pollDetailSection').style.display = 'none';
    loadPolls();
    loadStatistics(); // Refresh statistics when showing polls list
}

// View user profile (for public profiles or own profile)
async function viewUserProfile(userId) {
    if (!userId) {
        showErrorToast('User profile not available');
        return;
    }
    
    try {
        const headers = {};
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        // Fetch user profile
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/profile`, { headers });
        
        if (response.ok) {
            const profile = await response.json();
            
            // Check if profile is public or if it's the current user's profile
            if (!profile.is_public_profile && (!currentUser || currentUser.id !== userId)) {
                showWarningToast('This profile is private', 'Private Profile');
                return;
            }
            
            // Show user profile modal with their information
            showUserProfileModal(profile);
        } else {
            const error = await response.json().catch(() => ({ detail: 'Failed to load profile' }));
            showErrorToast(error.detail || 'Failed to load user profile');
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        showErrorToast('Network error while loading profile');
    }
}

// Show user profile in a modal
function showUserProfileModal(profile) {
    const modalContent = `
        <div class="profile-view-card">
            ${profile.cover_image_url ? `
                <div class="profile-view-cover" style="background-image: url('${escapeHtml(profile.cover_image_url)}');"></div>
            ` : `
                <div class="profile-view-cover" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
            `}
            <div class="profile-view-content">
                <div class="profile-view-avatar">
                    ${profile.avatar_url ? `
                        <img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(profile.username)}">
                    ` : `
                        <span class="avatar-placeholder">👤</span>
                    `}
                </div>
                <h2>${escapeHtml(profile.username)}</h2>
                ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
                
                ${profile.location || profile.website || profile.twitter_handle ? `
                    <div class="profile-social-links">
                        ${profile.location ? `<div class="profile-info-item">📍 ${escapeHtml(profile.location)}</div>` : ''}
                        ${profile.website ? `<div class="profile-info-item">🔗 <a href="${escapeHtml(profile.website)}" target="_blank" rel="noopener">${escapeHtml(profile.website)}</a></div>` : ''}
                        ${profile.twitter_handle ? `<div class="profile-info-item">🐦 <a href="https://twitter.com/${escapeHtml(profile.twitter_handle)}" target="_blank" rel="noopener">@${escapeHtml(profile.twitter_handle)}</a></div>` : ''}
                    </div>
                ` : ''}
                
                <div class="profile-stats">
                    <div class="stat-item">
                        <strong>${profile.polls_created_count || 0}</strong>
                        <span>Polls Created</span>
                    </div>
                    <div class="stat-item">
                        <strong>${profile.votes_cast_count || 0}</strong>
                        <span>Votes Cast</span>
                    </div>
                    <div class="stat-item">
                        <strong>${profile.badges_earned_count || 0}</strong>
                        <span>Badges Earned</span>
                    </div>
                </div>
                
                ${currentUser && currentUser.id === profile.id ? `
                    <button class="btn btn-primary" onclick="closeModal('userProfileViewModal'); showModal('profileModal');">
                        ✏️ Edit Profile
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Create or update modal
    let modal = document.getElementById('userProfileViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'userProfileViewModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <span class="close" onclick="closeModal('userProfileViewModal')">&times;</span>
                <div id="userProfileViewContent"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('userProfileViewContent').innerHTML = modalContent;
    showModal('userProfileViewModal');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Statistics Functions
async function loadStatistics() {
    console.log('Loading statistics...');
    try {
        // Load visitor statistics
        const visitorResponse = await fetch(`${API_BASE_URL}/api/stats/visitors`);
        console.log('Visitor response status:', visitorResponse.status);
        if (visitorResponse.ok) {
            const visitorData = await visitorResponse.json();
            console.log('Visitor data:', visitorData);
            document.getElementById('totalVisitors').textContent = visitorData.total_visitors || 0;
        }
        
        // Load poll statistics
        const pollResponse = await fetch(`${API_BASE_URL}/api/stats/polls`);
        console.log('Poll response status:', pollResponse.status);
        if (pollResponse.ok) {
            const pollData = await pollResponse.json();
            console.log('Poll data:', pollData);
            document.getElementById('totalPolls').textContent = pollData.total_polls || 0;
            document.getElementById('activePolls').textContent = pollData.active_polls || 0;
            document.getElementById('closedPolls').textContent = pollData.closed_polls || 0;
        }
        
        // Load user statistics
        const userResponse = await fetch(`${API_BASE_URL}/api/users/stats/public`);
        console.log('User response status:', userResponse.status);
        if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('User data:', userData);
            document.getElementById('totalRegistered').textContent = userData.total_registered_users || 0;
            document.getElementById('activeUsers').textContent = userData.active_users_last_30_days || 0;
        }
        
        console.log('Statistics loaded successfully');
    } catch (error) {
        console.error('Error loading statistics:', error);
        // Set default values on error
        document.getElementById('totalVisitors').textContent = '0';
        document.getElementById('totalRegistered').textContent = '0';
        document.getElementById('totalPolls').textContent = '0';
        document.getElementById('activePolls').textContent = '0';
        document.getElementById('closedPolls').textContent = '0';
        document.getElementById('activeUsers').textContent = '0';
    }
}

// Notification Functions
async function loadNotifications() {
    console.log('[Notifications] loadNotifications called, currentToken:', !!currentToken);
    
    if (!currentToken) {
        console.log('[Notifications] No token, showing empty state');
        const notificationList = document.getElementById('notificationList');
        if (notificationList) {
            notificationList.innerHTML = '<div class="notification-empty">Please log in to view notifications</div>';
        }
        return;
    }
    
    // Use cache if available and recent (less than 10 seconds old)
    const now = Date.now();
    if (notificationCache.length > 0 && (now - lastNotificationCheck < 10000)) {
        console.log('[Notifications] Using cached notifications');
        displayNotifications(notificationCache);
        return;
    }
    
    try {
        console.log('[Notifications] Fetching from:', `${API_BASE_URL}/api/notifications/?limit=20`);
        const response = await fetch(`${API_BASE_URL}/api/notifications/?limit=20`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        console.log('[Notifications] Response status:', response.status);
        
        if (response.ok) {
            const notifications = await response.json();
            console.log('[Notifications] Received:', notifications.length, 'notifications');
            notificationCache = notifications;  // Update cache
            lastNotificationCheck = now;
            displayNotifications(notifications);
        } else {
            console.error('[Notifications] Response not OK:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('[Notifications] Error response:', errorText);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        // Fallback to cache if available
        if (notificationCache.length > 0) {
            displayNotifications(notificationCache);
        } else {
            // Show empty state instead of loading text
            const notificationList = document.getElementById('notificationList');
            if (notificationList) {
                notificationList.innerHTML = '<div class="notification-empty">Failed to load notifications</div>';
            }
        }
    }
}

function displayNotifications(notifications) {
    console.log('[Notifications] displayNotifications called with', notifications.length, 'notifications');
    const notificationList = document.getElementById('notificationList');
    console.log('[Notifications] notificationList element:', !!notificationList);
    
    if (!notificationList) {
        console.error('[Notifications] notificationList element not found!');
        return;
    }
    
    if (notifications.length === 0) {
        console.log('[Notifications] No notifications, showing empty state');
        notificationList.innerHTML = '<div class="notification-empty">No notifications yet</div>';
        return;
    }
    
    console.log('[Notifications] Rendering', notifications.length, 'notifications');
    notificationList.innerHTML = notifications.map(notif => {
        const icon = getNotificationIcon(notif.notification_type);
        const detailsHtml = getNotificationDetails(notif);
        const timeAgo = getTimeAgo(notif.created_at);
        
        return `
            <div class="notification-item ${notif.is_read ? '' : 'unread'}" 
                 data-id="${notif.id}" 
                 data-poll-id="${notif.poll_id}"
                 onclick="handleNotificationClick(${notif.id}, ${notif.poll_id}, ${notif.is_read})">
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">
                    <p class="notification-message">${escapeHtml(notif.message)}</p>
                    ${detailsHtml}
                    <p class="notification-time">${timeAgo}</p>
                </div>
            </div>
        `;
    }).join('');
}

function getNotificationIcon(type) {
    const icons = {
        'vote': '🗳️',
        'like': '❤️',
        'comment': '💬',
        'reply': '↩️',
        'comment_vote': '👍',
    };
    return icons[type] || '🔔';
}

function getNotificationDetails(notif) {
    let details = [];
    
    // Add action user
    if (notif.action_username) {
        details.push(`<span class="notif-detail"><strong>From:</strong> ${escapeHtml(notif.action_username)}</span>`);
    }
    
    // Add poll title
    if (notif.poll_title) {
        details.push(`<span class="notif-detail"><strong>Poll:</strong> ${escapeHtml(notif.poll_title)}</span>`);
    }
    
    // Add action-specific details
    if (notif.notification_type === 'vote' && notif.action_detail) {
        details.push(`<span class="notif-detail"><strong>Voted:</strong> ${escapeHtml(notif.action_detail)}</span>`);
    } else if (notif.notification_type === 'comment_vote' && notif.action_detail) {
        const voteText = notif.action_detail === 'upvote' ? '👍 Liked' : '👎 Disliked';
        details.push(`<span class="notif-detail"><strong>Action:</strong> ${voteText}</span>`);
    }
    
    if (details.length === 0) return '';
    
    return `<div class="notification-details">${details.join(' • ')}</div>`;
}

async function loadUnreadCount() {
    if (!currentToken) return;
    
    // Debounce: Don't check more than once every 5 seconds
    const now = Date.now();
    if (now - lastNotificationCheck < 5000) {
        return;
    }
    lastNotificationCheck = now;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const newCount = data.unread_count;
            
            // Check if there are NEW notifications
            if (newCount > lastUnreadCount && lastUnreadCount > 0) {
                const diff = newCount - lastUnreadCount;
                showInfoToast(`You have ${diff} new notification${diff > 1 ? 's' : ''}!`, '🔔 New Notification');
                
                // Optional: Play notification sound
                playNotificationSound();
            }
            
            lastUnreadCount = newCount;
            updateNotificationBadge(newCount);
        }
    } catch (error) {
        console.error('Error loading unread count:', error);
    }
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

async function handleNotificationClick(notifId, pollId, isRead) {
    // Mark as read
    if (!isRead) {
        await markNotificationRead([notifId]);
    }
    
    // Close dropdown
    document.getElementById('notificationDropdown').style.display = 'none';
    
    // Navigate to poll
    loadPollDetail(pollId);
}

async function markNotificationRead(notificationIds) {
    if (!currentToken) return;
    
    try {
        await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ notification_ids: notificationIds })
        });
        
        // Clear cache to force refresh
        notificationCache = [];
        
        // Reload notifications and count
        await Promise.all([loadNotifications(), loadUnreadCount()]);
    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
}

async function markAllNotificationsRead() {
    if (!currentToken) return;
    
    try {
        await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        // Clear cache to force refresh
        notificationCache = [];
        
        // Reload notifications and count
        await Promise.all([loadNotifications(), loadUnreadCount()]);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

function getTimeAgo(dateString) {
    // Parse the date string as UTC and convert to local time
    const date = new Date(dateString);
    const now = new Date();
    
    // Calculate the difference in seconds
    const seconds = Math.floor((now - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
        }
    }
    
    return 'Just now';
}

// ===== COMMENT FUNCTIONS =====

let currentPollIdForComments = null;
let replyingToCommentId = null;

async function loadComments(pollId) {
    currentPollIdForComments = pollId;
    const commentsList = document.getElementById('commentsList');
    
    if (!commentsList) return;
    
    try {
        const headers = {};
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/comments/polls/${pollId}/comments`, {
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error('Failed to load comments');
        }
        
        const comments = await response.json();
        
        if (comments.length === 0) {
            commentsList.innerHTML = '<p class="no-data">No comments yet. Be the first to share your thoughts!</p>';
            return;
        }
        
        commentsList.innerHTML = comments.map(comment => renderComment(comment)).join('');
        
        // Setup event listeners for comment actions
        setupCommentListeners();
        
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = '<p class="error-message">Failed to load comments</p>';
    }
}

function renderComment(comment) {
    const sentimentEmoji = {
        'positive': '😊',
        'negative': '😟',
        'neutral': '😐'
    };
    
    const sentimentClass = comment.sentiment ? comment.sentiment.toLowerCase() : 'neutral';
    const emoji = sentimentEmoji[sentimentClass] || '💬';
    
    // Display username or "Anonymous" if no user_id
    const displayName = comment.username || 'Anonymous User';
    const ipInfo = comment.ip_address && !comment.user_id ? ` (IP: ${comment.ip_address})` : '';
    
    return `
        <div class="comment" data-comment-id="${comment.id}">
            <div class="comment-header">
                <div class="comment-author">
                    <strong>${escapeHtml(displayName)}${ipInfo}</strong>
                    ${comment.sentiment ? `
                        <span class="sentiment-badge ${sentimentClass}" title="AI Sentiment Analysis">
                            ${emoji} ${comment.sentiment}
                            ${comment.sentiment_confidence ? 
                                `<span class="confidence">${(comment.sentiment_confidence * 100).toFixed(0)}%</span>` 
                                : ''}
                        </span>
                    ` : ''}
                </div>
                <span class="comment-time">${getTimeAgo(comment.created_at)}</span>
            </div>
            
            <div class="comment-content">${escapeHtml(comment.content)}</div>
            
            <div class="comment-actions">
                ${currentUser ? `
                    <button class="btn-link upvote-btn" data-comment-id="${comment.id}" data-vote-type="upvote">
                        👍 ${comment.upvotes}
                    </button>
                    <button class="btn-link downvote-btn" data-comment-id="${comment.id}" data-vote-type="downvote">
                        👎 ${comment.downvotes}
                    </button>
                    <button class="btn-link reply-btn" data-comment-id="${comment.id}">
                        💬 Reply
                    </button>
                ` : `
                    <span class="vote-count">👍 ${comment.upvotes} 👎 ${comment.downvotes}</span>
                `}
                
                ${comment.reply_count > 0 ? `
                    <button class="btn-link view-replies-btn" data-comment-id="${comment.id}">
                        📝 View ${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}
                    </button>
                ` : ''}
                
                ${currentUser && comment.user_id && currentUser.id === comment.user_id ? `
                    <button class="btn-link edit-comment-btn" data-comment-id="${comment.id}">
                        ✏️ Edit
                    </button>
                    <button class="btn-link delete-comment-btn" data-comment-id="${comment.id}">
                        🗑️ Delete
                    </button>
                ` : ''}
            </div>
            
            <div class="replies-container" id="replies-${comment.id}"></div>
        </div>
    `;
}

// Use event delegation for comment listeners - set up once on page load
let commentListenersInitialized = false;

function setupCommentListeners() {
    if (commentListenersInitialized) return;
    commentListenersInitialized = true;
    
    // Use event delegation on the comments list container
    document.addEventListener('click', async (e) => {
        let target = e.target;
        
        // If clicked on emoji/text inside button, get the button element
        if (!target.classList.contains('btn-link') && target.closest('.btn-link')) {
            target = target.closest('.btn-link');
        }
        
        // Upvote/downvote buttons
        if (target.classList.contains('upvote-btn') || target.classList.contains('downvote-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const commentId = target.dataset.commentId;
            const voteType = target.dataset.voteType;
            console.log('Vote button clicked:', voteType, 'for comment:', commentId);
            await voteOnComment(commentId, voteType);
            return;
        }
        
        // Reply buttons
        if (target.classList.contains('reply-btn')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Reply button clicked! Comment ID:', target.dataset.commentId);
            const commentId = target.dataset.commentId;
            showReplyForm(commentId);
            return;
        }
        
        // View replies buttons
        if (target.classList.contains('view-replies-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const commentId = target.dataset.commentId;
            await loadReplies(commentId);
            return;
        }
        
        // Delete buttons
        if (target.classList.contains('delete-comment-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const commentId = target.dataset.commentId;
            const confirmed = await customConfirm(
                '🗑️ Delete Comment',
                'Are you sure you want to delete this comment? This action cannot be undone.',
                'Yes, Delete',
                'Cancel'
            );
            if (confirmed) {
                await deleteComment(commentId);
            }
            return;
        }
        
        // Edit buttons
        if (target.classList.contains('edit-comment-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const commentId = target.dataset.commentId;
            showEditCommentForm(commentId);
            return;
        }
    });
}

async function submitComment(pollId, parentId = null, allowAnonymous = false) {
    console.log('💬 Submit Comment:', { pollId, parentId, allowAnonymous, hasToken: !!currentToken });
    
    if (!currentToken && !allowAnonymous) {
        showWarningToast('Please sign in to comment');
        return;
    }
    
    const textareaId = parentId ? `replyText-${parentId}` : 'newCommentText';
    const textarea = document.getElementById(textareaId);
    
    if (!textarea) {
        console.error('❌ Textarea not found:', textareaId);
        showErrorToast('Could not find comment input field');
        return;
    }
    
    const content = textarea.value.trim();
    
    if (!content) {
        showWarningToast('Please enter a comment');
        return;
    }
    
    if (content.length > 2000) {
        showWarningToast('Comment is too long (max 2000 characters)');
        return;
    }
    
    // Find submit button and show loading state IMMEDIATELY
    const submitBtn = parentId 
        ? document.querySelector(`#reply-form-${parentId} .btn-primary`)
        : document.getElementById('submitCommentBtn');
    
    if (submitBtn) {
        setButtonLoading(submitBtn, true);
    }
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Only add auth header if user is logged in
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/comments/polls/${pollId}/comments`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                content: content,
                parent_id: parentId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to post comment');
        }
        
        // Clear textarea
        textarea.value = '';
        if (document.getElementById('commentCharCount')) {
            document.getElementById('commentCharCount').textContent = '0';
        }
        
        // Reload comments
        if (parentId) {
            await loadReplies(parentId);
            // Remove reply form
            const replyForm = document.getElementById(`reply-form-${parentId}`);
            if (replyForm) replyForm.remove();
        } else {
            await loadComments(pollId);
        }
        
        if (submitBtn) {
            setButtonSuccess(submitBtn);
        }
        showSuccessToast('Your comment has been posted!', 'Comment Added');
        
        // Check for new badges
        checkForNewBadges();
        
    } catch (error) {
        console.error('Error posting comment:', error);
        showErrorToast(error.message || 'Failed to post comment');
        // Re-enable button on error
        if (submitBtn) {
            setButtonLoading(submitBtn, false);
        }
    }
}

async function voteOnComment(commentId, voteType) {
    if (!currentToken) {
        showWarningToast('Please sign in to vote on comments');
        return;
    }
    
    try {
        // Find the button elements
        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) return;
        
        const upvoteBtn = commentElement.querySelector('.upvote-btn');
        const downvoteBtn = commentElement.querySelector('.downvote-btn');
        
        // Get current counts
        const currentUpvotes = parseInt(upvoteBtn?.textContent.match(/\d+/)?.[0] || 0);
        const currentDownvotes = parseInt(downvoteBtn?.textContent.match(/\d+/)?.[0] || 0);
        const wasUpvoted = upvoteBtn?.classList.contains('active-vote');
        const wasDownvoted = downvoteBtn?.classList.contains('active-vote');
        
        // Optimistic UI update (instant feedback)
        let newUpvotes = currentUpvotes;
        let newDownvotes = currentDownvotes;
        
        if (voteType === 'upvote') {
            if (wasUpvoted) {
                // Removing upvote
                newUpvotes--;
                upvoteBtn?.classList.remove('active-vote');
            } else {
                // Adding upvote
                newUpvotes++;
                upvoteBtn?.classList.add('active-vote');
                // Remove downvote if it was there
                if (wasDownvoted) {
                    newDownvotes--;
                    downvoteBtn?.classList.remove('active-vote');
                }
            }
        } else if (voteType === 'downvote') {
            if (wasDownvoted) {
                // Removing downvote
                newDownvotes--;
                downvoteBtn?.classList.remove('active-vote');
            } else {
                // Adding downvote
                newDownvotes++;
                downvoteBtn?.classList.add('active-vote');
                // Remove upvote if it was there
                if (wasUpvoted) {
                    newUpvotes--;
                    upvoteBtn?.classList.remove('active-vote');
                }
            }
        }
        
        // Update UI immediately
        if (upvoteBtn) upvoteBtn.innerHTML = `👍 ${newUpvotes}`;
        if (downvoteBtn) downvoteBtn.innerHTML = `👎 ${newDownvotes}`;
        
        // Disable buttons during request to prevent double-clicking
        if (upvoteBtn) upvoteBtn.disabled = true;
        if (downvoteBtn) downvoteBtn.disabled = true;
        
        const response = await fetch(`${API_BASE_URL}/api/comments/comments/${commentId}/vote`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ vote_type: voteType })
        });
        
        if (!response.ok) {
            // Revert on error
            if (upvoteBtn) {
                upvoteBtn.innerHTML = `👍 ${currentUpvotes}`;
                upvoteBtn.classList.toggle('active-vote', wasUpvoted);
            }
            if (downvoteBtn) {
                downvoteBtn.innerHTML = `👎 ${currentDownvotes}`;
                downvoteBtn.classList.toggle('active-vote', wasDownvoted);
            }
            throw new Error('Failed to vote');
        }
        
        // Get actual state from server and update to ensure accuracy
        const data = await response.json();
        
        // Update buttons with real values and active state from server
        if (upvoteBtn) {
            upvoteBtn.innerHTML = `👍 ${data.upvotes}`;
            upvoteBtn.disabled = false;
            upvoteBtn.classList.toggle('active-vote', data.user_vote === 'upvote');
        }
        
        if (downvoteBtn) {
            downvoteBtn.innerHTML = `👎 ${data.downvotes}`;
            downvoteBtn.disabled = false;
            downvoteBtn.classList.toggle('active-vote', data.user_vote === 'downvote');
        }
        
    } catch (error) {
        console.error('Error voting on comment:', error);
        showMessage('Failed to vote on comment', 'error');
        
        // Re-enable buttons on error
        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (commentElement) {
            const upvoteBtn = commentElement.querySelector('.upvote-btn');
            const downvoteBtn = commentElement.querySelector('.downvote-btn');
            if (upvoteBtn) upvoteBtn.disabled = false;
            if (downvoteBtn) downvoteBtn.disabled = false;
        }
    }
}

async function loadReplies(commentId) {
    const repliesContainer = document.getElementById(`replies-${commentId}`);
    
    if (!repliesContainer) return;
    
    // Don't toggle visibility - always load and show replies
    repliesContainer.style.display = 'block';
    repliesContainer.innerHTML = '<p class="loading">Loading replies...</p>';
    
    try {
        const headers = {};
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/comments/comments/${commentId}/replies`, {
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error('Failed to load replies');
        }
        
        const replies = await response.json();
        
        if (replies.length === 0) {
            repliesContainer.innerHTML = '<p class="no-data">No replies yet</p>';
            return;
        }
        
        repliesContainer.innerHTML = replies.map(reply => renderReply(reply)).join('');
        
        // Setup listeners for replies
        setupCommentListeners();
        
    } catch (error) {
        console.error('Error loading replies:', error);
        repliesContainer.innerHTML = '<p class="error-message">Failed to load replies</p>';
    }
}

function renderReply(reply) {
    const sentimentEmoji = {
        'positive': '😊',
        'negative': '😟',
        'neutral': '😐'
    };
    
    const sentimentClass = reply.sentiment ? reply.sentiment.toLowerCase() : 'neutral';
    const emoji = sentimentEmoji[sentimentClass] || '💬';
    
    // Display username or "Anonymous" if no user_id
    const displayName = reply.username || 'Anonymous User';
    const ipInfo = reply.ip_address && !reply.user_id ? ` (IP: ${reply.ip_address})` : '';
    
    return `
        <div class="comment reply" data-comment-id="${reply.id}">
            <div class="comment-header">
                <div class="comment-author">
                    <strong>${escapeHtml(displayName)}${ipInfo}</strong>
                    ${reply.sentiment ? `
                        <span class="sentiment-badge ${sentimentClass}" title="AI Sentiment Analysis">
                            ${emoji} ${reply.sentiment}
                            ${reply.sentiment_confidence ? 
                                `<span class="confidence">${(reply.sentiment_confidence * 100).toFixed(0)}%</span>` 
                                : ''}
                        </span>
                    ` : ''}
                </div>
                <span class="comment-time">${getTimeAgo(reply.created_at)}</span>
            </div>
            
            <div class="comment-content">${escapeHtml(reply.content)}</div>
            
            <div class="comment-actions">
                ${currentUser ? `
                    <button class="btn-link upvote-btn" data-comment-id="${reply.id}" data-vote-type="upvote">
                        👍 ${reply.upvotes}
                    </button>
                    <button class="btn-link downvote-btn" data-comment-id="${reply.id}" data-vote-type="downvote">
                        👎 ${reply.downvotes}
                    </button>
                    <button class="btn-link reply-btn" data-comment-id="${reply.id}">
                        💬 Reply
                    </button>
                ` : `
                    <span class="vote-count">👍 ${reply.upvotes} 👎 ${reply.downvotes}</span>
                `}
                
                ${currentUser && reply.user_id && currentUser.id === reply.user_id ? `
                    <button class="btn-link edit-comment-btn" data-comment-id="${reply.id}">
                        ✏️ Edit
                    </button>
                    <button class="btn-link delete-comment-btn" data-comment-id="${reply.id}">
                        🗑️ Delete
                    </button>
                ` : ''}
            </div>
            
            <div class="replies-container" id="replies-${reply.id}"></div>
        </div>
    `;
}

function showEditCommentForm(commentId) {
    // Remove any existing edit forms
    document.querySelectorAll('.edit-comment-form').forEach(form => form.remove());
    
    const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (!commentElement) return;
    
    const contentElement = commentElement.querySelector('.comment-content');
    const originalContent = contentElement.textContent;
    
    contentElement.innerHTML = `
        <div class="edit-comment-form">
            <textarea id="editText-${commentId}" maxlength="2000" rows="3">${originalContent}</textarea>
            <div class="comment-form-footer">
                <span class="char-count"><span id="editCharCount-${commentId}">${originalContent.length}</span>/2000</span>
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="cancelEditComment(${commentId}, \`${originalContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">Cancel</button>
                    <button class="btn btn-primary" onclick="updateComment(${commentId})">Save</button>
                </div>
            </div>
        </div>
    `;
    
    // Setup character counter
    const textarea = document.getElementById(`editText-${commentId}`);
    const charCount = document.getElementById(`editCharCount-${commentId}`);
    
    textarea.addEventListener('input', () => {
        charCount.textContent = textarea.value.length;
    });
    
    textarea.focus();
}

async function updateComment(commentId) {
    const textarea = document.getElementById(`editText-${commentId}`);
    const newContent = textarea.value.trim();
    
    if (!newContent) {
        showNotification('Comment cannot be empty', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/comments/${commentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ content: newContent })
        });
        
        if (response.ok) {
            showNotification('Comment updated successfully');
            // Reload comments for the poll
            const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
            const pollId = commentElement.closest('[data-poll-id]')?.dataset.pollId;
            if (pollId) {
                await loadComments(pollId);
            }
        } else {
            const error = await response.json();
            showNotification(error.detail || 'Failed to update comment', 'error');
        }
    } catch (error) {
        console.error('Error updating comment:', error);
        showNotification('Failed to update comment', 'error');
    }
}

function cancelEditComment(commentId, originalContent) {
    const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (!commentElement) return;
    
    const contentElement = commentElement.querySelector('.comment-content');
    contentElement.textContent = originalContent;
}

function showReplyForm(commentId) {
    console.log('showReplyForm called with commentId:', commentId);
    
    // Remove any existing reply forms
    document.querySelectorAll('.reply-form').forEach(form => form.remove());
    
    const comment = document.querySelector(`[data-comment-id="${commentId}"]`);
    const repliesContainer = document.getElementById(`replies-${commentId}`);
    
    console.log('Found comment element:', comment);
    console.log('Found replies container:', repliesContainer);
    
    if (!repliesContainer) {
        console.error('No replies container found for comment', commentId);
        return;
    }
    
    // IMPORTANT: Make the container visible!
    repliesContainer.style.display = 'block';
    
    const replyFormHtml = `
        <div class="reply-form" id="reply-form-${commentId}">
            <textarea id="replyText-${commentId}" placeholder="Write your reply..." maxlength="2000" rows="2"></textarea>
            <div class="comment-form-footer">
                <span class="char-count"><span id="replyCharCount-${commentId}">0</span>/2000</span>
                <button class="btn btn-sm btn-primary" onclick="submitComment(${currentPollIdForComments}, ${commentId})">Post Reply</button>
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('reply-form-${commentId}').remove()">Cancel</button>
            </div>
        </div>
    `;
    
    repliesContainer.insertAdjacentHTML('afterbegin', replyFormHtml);
    console.log('Reply form inserted');
    
    // Focus on textarea
    const textarea = document.getElementById(`replyText-${commentId}`);
    const charCount = document.getElementById(`replyCharCount-${commentId}`);
    
    if (textarea) {
        textarea.focus();
        textarea.addEventListener('input', () => {
            charCount.textContent = textarea.value.length;
        });
        console.log('Textarea focused and listener added');
    } else {
        console.error('Textarea not found after insertion');
    }
}

async function deleteComment(commentId) {
    if (!currentToken) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/comments/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete comment');
        }
        
        showMessage('Comment deleted successfully', 'success');
        await loadComments(currentPollIdForComments);
        
    } catch (error) {
        console.error('Error deleting comment:', error);
        showMessage('Failed to delete comment', 'error');
    }
}

// ===== AI FEATURES =====

async function getAIPollSuggestions() {
    if (!currentToken) {
        showMessage('Please sign in to use AI features', 'error');
        return;
    }
    
    const title = document.getElementById('pollTitle').value.trim();
    const description = document.getElementById('pollDescription').value.trim();
    
    if (!title) {
        showMessage('Please enter a poll title first', 'error');
        return;
    }
    
    const aiSuggestBtn = document.getElementById('aiSuggestBtn');
    const originalText = aiSuggestBtn.textContent;
    
    try {
        aiSuggestBtn.disabled = true;
        aiSuggestBtn.textContent = '⏳ Generating...';
        
        const params = new URLSearchParams({
            title: title,
            description: description || '',
            num_options: 4
        });
        
        const response = await fetch(`${API_BASE_URL}/api/polls/ai/suggest-options?${params}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to get AI suggestions');
        }
        
        const data = await response.json();
        
        // Clear existing options
        const pollOptions = document.getElementById('createPollOptions');
        pollOptions.innerHTML = '';
        
        // Add AI-suggested options
        data.suggested_options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option-input';
            optionDiv.innerHTML = `
                <input type="text" class="poll-option" placeholder="Option ${index + 1}" value="${escapeHtml(option)}" required>
                ${index > 1 ? '<button type="button" class="btn-remove-option" onclick="this.parentElement.remove()">×</button>' : ''}
            `;
            pollOptions.appendChild(optionDiv);
        });
        
        showMessage(`✨ AI generated ${data.count} poll options! Feel free to edit them.`, 'success');
        
    } catch (error) {
        console.error('Error getting AI suggestions:', error);
        showMessage(error.message, 'error');
    } finally {
        aiSuggestBtn.disabled = false;
        aiSuggestBtn.textContent = originalText;
    }
}

function startNotificationPolling() {
    if (!currentToken) return;
    
    // Load initially
    loadUnreadCount();
    checkForNewBadges();  // Also check badges
    
    // Poll every 15 seconds (faster updates)
    notificationInterval = setInterval(() => {
        loadUnreadCount();
        checkForNewBadges();  // Check for new badges
    }, 15000);  // Changed from 30000 to 15000
}

function stopNotificationPolling() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
}

// Play notification sound (subtle)
function playNotificationSound() {
    try {
        // Create a short, pleasant notification beep using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        // Silently fail if audio not supported
        console.log('Audio notification not available');
    }
}

// Check for new badges
async function checkForNewBadges() {
    if (!currentToken || !currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/badges/my-badges`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        if (response.ok) {
            const badges = await response.json();
            const newCount = badges.length;
            
            // Check if user earned new badges
            if (newCount > lastBadgeCount && lastBadgeCount > 0) {
                const newBadges = badges.slice(0, newCount - lastBadgeCount);
                
                // Show notification for each new badge
                newBadges.forEach((badge, index) => {
                    setTimeout(() => {
                        showBadgeEarnedNotification(badge);
                    }, index * 500);  // Stagger notifications
                });
            }
            
            lastBadgeCount = newCount;
            updateBadgeCount(newCount);
        }
    } catch (error) {
        console.error('Error checking badges:', error);
    }
}

// Initialize badge count on login to prevent false notifications
async function initializeBadgeCount() {
    if (!currentToken || !currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/badges/my-badges`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        if (response.ok) {
            const badges = await response.json();
            lastBadgeCount = badges.length;
            updateBadgeCount(badges.length);
        }
    } catch (error) {
        console.error('Error initializing badge count:', error);
    }
}

// Show badge earned notification
function showBadgeEarnedNotification(badge) {
    // Play sound
    playNotificationSound();
    
    // Show animated toast with badge info
    const badgeEmoji = badge.icon || '🏆';
    const rarityEmoji = {
        'common': '⚪',
        'rare': '🔵',
        'epic': '🟣',
        'legendary': '🟡'
    }[badge.rarity.toLowerCase()] || '⚪';
    
    showSuccessToast(
        `${badgeEmoji} ${badge.name}\n${rarityEmoji} ${badge.rarity} Badge (+${badge.points} pts)`,
        '🎉 New Badge Unlocked!'
    );
    
    // Trigger confetti for rare+ badges
    if (badge.rarity.toLowerCase() !== 'common') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

// Google OAuth Login
function googleLogin() {
    // Redirect to Google OAuth endpoint
    window.location.href = `${API_BASE_URL}/api/users/auth/google/login`;
}

// ==================== API Keys Management ====================

// Load user's API keys
async function loadAPIKeys() {
    const apiKeysList = document.getElementById('apiKeysList');
    apiKeysList.innerHTML = '<p class="loading">Loading API keys...</p>';
    
    try {
        const token = getToken();
        if (!token) {
            apiKeysList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔐</div>
                    <div class="empty-state-text">Please log in to manage API keys</div>
                    <div class="empty-state-subtext">You need to be logged in to create and view API keys</div>
                </div>
            `;
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/api-keys/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in again.');
            }
            throw new Error(`Failed to load API keys: ${response.status}`);
        }
        
        const keys = await response.json();
        
        if (keys.length === 0) {
            apiKeysList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔑</div>
                    <div class="empty-state-text">No API keys yet</div>
                    <div class="empty-state-subtext">Create your first API key to get started with programmatic access</div>
                </div>
            `;
            return;
        }
        
        apiKeysList.innerHTML = keys.map(key => createAPIKeyItem(key)).join('');
    } catch (error) {
        console.error('Error loading API keys:', error);
        apiKeysList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-text">Failed to load API keys</div>
                <div class="empty-state-subtext">${escapeHtml(error.message)}</div>
                <button class="btn btn-primary" onclick="loadAPIKeys()" style="margin-top: 1rem;">🔄 Retry</button>
            </div>
        `;
    }
}

// Create API key item HTML
function createAPIKeyItem(key) {
    const createdDate = new Date(key.created_at).toLocaleDateString();
    const lastUsed = key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never';
    const expires = key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never';
    const isExpired = key.expires_at && new Date(key.expires_at) < new Date();
    const status = isExpired ? 'expired' : (key.is_active ? 'active' : 'inactive');
    const statusText = isExpired ? 'Expired' : (key.is_active ? 'Active' : 'Revoked');
    
    return `
        <div class="api-key-item">
            <div class="api-key-info">
                <div class="api-key-name">${escapeHtml(key.key_name)}</div>
                <div>
                    <code class="api-key-prefix">${escapeHtml(key.key_prefix)}...</code>
                    <span class="api-key-status ${status}">${statusText}</span>
                </div>
                <div class="api-key-meta">
                    <span>📅 Created: ${createdDate}</span>
                    <span>🕒 Last used: ${lastUsed}</span>
                    <span>⏰ Expires: ${expires}</span>
                </div>
            </div>
            <div class="api-key-actions">
                ${key.is_active && !isExpired ? `
                    <button class="btn btn-danger btn-revoke" onclick="revokeAPIKey(${key.id}, '${escapeHtml(key.key_name)}')">
                        🗑️ Revoke
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Handle create API key form submission
async function handleCreateAPIKey(e) {
    e.preventDefault();
    
    const keyName = document.getElementById('apiKeyName').value.trim();
    const expirationDays = document.getElementById('apiKeyExpiration').value;
    const messageDiv = document.getElementById('createApiKeyMessage');
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    if (!keyName) {
        showMessage(messageDiv, 'Please enter a key name', 'error');
        return;
    }
    
    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = '⏳ Generating...';
    
    try {
        const payload = {
            key_name: keyName
        };
        
        if (expirationDays) {
            payload.expires_in_days = parseInt(expirationDays);
        }
        
        const response = await fetch(`${API_BASE_URL}/api/api-keys/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create API key');
        }
        
        const newKey = await response.json();
        
        // Close create modal and show the key
        closeModal('createApiKeyModal');
        showNewAPIKey(newKey);
        
        // Reset form
        document.getElementById('createApiKeyForm').reset();
        
        // Reload keys list
        loadAPIKeys();
        
        showSuccessNotification('API key created successfully!');
        
    } catch (error) {
        console.error('Error creating API key:', error);
        showMessage(messageDiv, error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '🔑 Generate API Key';
    }
}

// Show newly created API key (one-time display)
function showNewAPIKey(keyData) {
    document.getElementById('apiKeyValue').textContent = keyData.api_key;
    document.getElementById('newApiKeyName').textContent = keyData.key_name;
    document.getElementById('newApiKeyPrefix').textContent = keyData.key_prefix;
    document.getElementById('newApiKeyCreated').textContent = new Date(keyData.created_at).toLocaleString();
    document.getElementById('newApiKeyExpires').textContent = keyData.expires_at 
        ? new Date(keyData.expires_at).toLocaleString() 
        : 'Never';
    
    showModal('showApiKeyModal');
}

// Copy API key to clipboard
async function copyAPIKeyToClipboard() {
    const apiKeyValue = document.getElementById('apiKeyValue').textContent;
    const button = document.getElementById('copyApiKeyBtn');
    
    try {
        await navigator.clipboard.writeText(apiKeyValue);
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '';
        }, 2000);
        
        showSuccessNotification('API key copied to clipboard!');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showErrorNotification('Failed to copy to clipboard');
    }
}

// Revoke an API key
async function revokeAPIKey(keyId, keyName) {
    const confirmed = await customConfirm(
        '🗑️ Revoke API Key',
        `Are you sure you want to revoke "${keyName}"?\n\nThis action cannot be undone and the key will stop working immediately.`,
        'Yes, Revoke',
        'Cancel'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to revoke API key');
        }
        
        showSuccessNotification('API key revoked successfully');
        loadAPIKeys(); // Reload the list
        
    } catch (error) {
        console.error('Error revoking API key:', error);
        showErrorNotification('Failed to revoke API key');
    }
}

// Test an API key
async function handleTestAPIKey(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('testApiKeyValue').value.trim();
    const endpoint = document.getElementById('testEndpoint').value;
    const messageDiv = document.getElementById('testApiKeyMessage');
    const resultDiv = document.getElementById('testApiKeyResult');
    const resultContent = document.getElementById('testApiKeyResultContent');
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    if (!apiKey) {
        showMessage(messageDiv, 'Please enter an API key', 'error');
        return;
    }
    
    if (!apiKey.startsWith('qp_live_')) {
        showMessage(messageDiv, 'Invalid API key format. Key should start with "qp_live_"', 'error');
        return;
    }
    
    // Hide previous results
    resultDiv.style.display = 'none';
    messageDiv.textContent = '';
    
    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = '⏳ Testing...';
    
    try {
        let url, method = 'GET';
        
        switch (endpoint) {
            case 'verify':
                url = `${API_BASE_URL}/api/api-keys/verify`;
                break;
            case 'polls':
                url = `${API_BASE_URL}/api/polls/`;
                break;
            case 'stats':
                url = `${API_BASE_URL}/api/stats/polls`;
                break;
            case 'user':
                url = `${API_BASE_URL}/api/users/me`;
                break;
            case 'notifications':
                url = `${API_BASE_URL}/api/notifications/`;
                break;
            case 'api-keys':
                url = `${API_BASE_URL}/api/api-keys/`;
                break;
            default:
                throw new Error('Invalid endpoint selected');
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'X-API-Key': apiKey
            }
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.detail || `Request failed with status ${response.status}`);
        }
        
        // Success!
        resultContent.innerHTML = `
            <div class="test-result-success">
                ✅ <strong>Success!</strong> Your API key is working correctly.
            </div>
            <p><strong>Endpoint:</strong> <code>${method} ${url}</code></p>
            <p><strong>Status:</strong> <span style="color: #10B981; font-weight: 600;">${response.status} ${response.statusText}</span></p>
            <p><strong>Response:</strong></p>
            <pre><code>${JSON.stringify(responseData, null, 2)}</code></pre>
        `;
        resultDiv.style.display = 'block';
        showSuccessNotification('API key test successful!');
        
    } catch (error) {
        console.error('Error testing API key:', error);
        
        // Check if it's an authentication error
        const isAuthError = error.message.includes('Not authenticated') || 
                           error.message.includes('Could not validate credentials') ||
                           error.message.includes('401');
        
        // All endpoints now support API keys!
        const apiKeySupportedEndpoints = ['verify', 'polls', 'stats', 'api-keys', 'user', 'notifications'];
        const supportsApiKey = apiKeySupportedEndpoints.includes(endpoint);
        
        let errorHtml = `
            <div class="test-result-error">
                ❌ <strong>Error:</strong> ${escapeHtml(error.message)}
            </div>`;
        
        if (isAuthError && !supportsApiKey) {
            // This should never happen now, but keeping as fallback
            errorHtml += `
                <div class="api-warning-box">
                    <strong>⚠️ Important Note:</strong> This endpoint currently does not support API key authentication.
                    It requires a JWT token obtained through regular login.
                </div>`;
        } else {
            errorHtml += `
                <div class="api-error-reasons">
                    <p><strong>Common reasons for failure:</strong></p>
                    <ul>
                        <li>🔑 The API key is invalid or has been revoked</li>
                        <li>⏰ The API key has expired</li>
                        <li>📋 The API key was copied incorrectly</li>
                        <li>🚫 Insufficient permissions</li>
                    </ul>
                </div>
                <div class="api-error-solutions">
                    <p><strong>What to try:</strong></p>
                    <ul>
                        <li>✓ Double-check you copied the entire API key</li>
                        <li>✓ Make sure the key starts with <code>qp_live_</code></li>
                        <li>✓ Check if the key is still active in your list</li>
                        <li>✓ Try "Verify Key" endpoint first</li>
                        <li>✓ Create a new API key if needed</li>
                    </ul>
                </div>`;
        }
        
        resultContent.innerHTML = errorHtml;
        resultDiv.style.display = 'block';
        showErrorNotification('API key test failed');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '🚀 Test API Key';
    }
}

// Helper function to get auth headers
function getAuthHeaders() {
    if (currentToken) {
        return { 'Authorization': `Bearer ${currentToken}` };
    }
    return {};
}

// ==================== LIVE ACTIVITY FEED ====================

let currentActivityFilter = 'all';
let activityOffset = 0;
const ACTIVITY_LIMIT = 20;
let activityWs = null;
let activityCheckInterval = null;

// Load activity feed
async function loadActivityFeed(reset = false) {
    if (reset) {
        activityOffset = 0;
        document.getElementById('activityFeed').innerHTML = '<p class="loading">Loading activity feed...</p>';
    }

    try {
        const params = new URLSearchParams({
            activity_filter: currentActivityFilter,
            limit: ACTIVITY_LIMIT,
            offset: activityOffset
        });

        const response = await fetch(`${API_BASE_URL}/api/activity/feed?${params}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to load activity feed');

        const activities = await response.json();

        const feedEl = document.getElementById('activityFeed');
        
        if (activities.length === 0) {
            if (activityOffset === 0) {
                feedEl.innerHTML = '<p class="empty-state">No recent activity found</p>';
            }
            document.getElementById('loadMoreActivity').style.display = 'none';
            return;
        }

        if (activityOffset === 0) {
            feedEl.innerHTML = '';
        }

        activities.forEach(activity => {
            feedEl.innerHTML += renderActivityItem(activity);
        });

        // Show/hide load more button
        document.getElementById('loadMoreActivity').style.display = 
            activities.length === ACTIVITY_LIMIT ? 'block' : 'none';

        activityOffset += activities.length;

    } catch (error) {
        console.error('Error loading activity feed:', error);
        document.getElementById('activityFeed').innerHTML = 
            '<p class="error">Failed to load activity feed. Please try again.</p>';
    }
}

// Render a single activity item
function renderActivityItem(activity) {
    const timeAgo = getTimeAgo(new Date(activity.timestamp));
    const username = activity.user ? activity.user.username : 'Anonymous';
    
    let icon, text, action;
    
    switch (activity.activity_type) {
        case 'poll_created':
            icon = '📊';
            action = 'created a new poll';
            text = activity.poll.title;
            break;
        case 'vote_cast':
            icon = '🗳️';
            action = 'voted on';
            text = activity.poll.title;
            break;
        case 'comment_posted':
            icon = '💬';
            action = 'commented on';
            text = activity.poll.title;
            break;
        case 'poll_trending':
            icon = '🔥';
            action = 'is trending';
            text = `${activity.poll.title} (${activity.metadata.vote_count} votes in last hour)`;
            break;
        default:
            icon = '⚡';
            action = 'activity on';
            text = activity.poll.title;
    }
    
    return `
        <div class="activity-item" data-activity-id="${activity.id}" onclick="viewPollFromActivity(${activity.poll.id})">
            <div class="activity-icon">${icon}</div>
            <div class="activity-content">
                <div class="activity-text">
                    <strong>${username}</strong> ${action}
                    <span class="activity-poll-title">${text}</span>
                </div>
                <div class="activity-time">${timeAgo}</div>
            </div>
        </div>
    `;
}

// View poll from activity
function viewPollFromActivity(pollId) {
    viewPollDetail(pollId);
}

// Activity filter buttons - TEMPORARILY DISABLED
function setupActivityFilters() {
    // Activity feed feature temporarily disabled
    console.log('Activity feed feature is temporarily disabled');
    return;
    
    /* DISABLED CODE:
    document.querySelectorAll('.activity-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.activity-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentActivityFilter = btn.dataset.filter;
            loadActivityFeed(true);
        });
    });

    // Load more button
    document.getElementById('loadMoreActivity')?.addEventListener('click', () => {
        loadActivityFeed(false);
    });
    */
}

// Auto-refresh activity feed every 30 seconds
function startActivityAutoRefresh() {
    if (activityCheckInterval) {
        clearInterval(activityCheckInterval);
    }
    
    activityCheckInterval = setInterval(() => {
        if (currentUser && currentActivityFilter) {
            loadActivityFeed(true);
        }
    }, 30000); // 30 seconds
}

// Helper: Get time ago string
function getTimeAgo(dateInput) {
    // Convert string to Date object if needed
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Validate date
    if (!(date instanceof Date) || isNaN(date)) {
        console.error('Invalid date:', dateInput);
        return 'Recently';
    }
    
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

// ==================== WELCOME TOUR / ONBOARDING ====================

// Custom skip confirmation dialog
function showTourSkipConfirmation(callback) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'tour-skip-dialog-overlay';
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'tour-skip-dialog';
    dialog.innerHTML = `
        <h3>⚠️ Skip Tour?</h3>
        <p>Are you sure you want to skip the tour? You can restart it anytime by clicking the <strong>❓ Help</strong> button in the top menu.</p>
        <div class="tour-skip-dialog-buttons">
            <button class="tour-skip-exit">Yes, Skip Tour</button>
            <button class="tour-skip-continue">No, Continue Tour</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    
    // Handle button clicks
    dialog.querySelector('.tour-skip-exit').addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
        callback(true); // Exit tour
    });
    
    dialog.querySelector('.tour-skip-continue').addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
        callback(false); // Continue tour
    });
    
    // Close on overlay click
    overlay.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.removeChild(dialog);
        callback(false); // Continue tour
    });
}

// Tour tracking system
const TOUR_TYPES = {
    MAIN_DASHBOARD: 'mainDashboard',
    POLL_DETAIL: 'pollDetail',
    CREATE_POLL: 'createPoll',
    API_KEYS: 'apiKeys'
};

function getTourKey(userId, tourType) {
    return `tour_${userId}_${tourType}`;
}

function hasSeenTour(userId, tourType) {
    if (!userId) return false;
    return localStorage.getItem(getTourKey(userId, tourType)) === 'true';
}

function markTourComplete(userId, tourType) {
    if (!userId) return;
    localStorage.setItem(getTourKey(userId, tourType), 'true');
}

function resetAllTours(userId) {
    if (!userId) return;
    Object.values(TOUR_TYPES).forEach(tourType => {
        localStorage.removeItem(getTourKey(userId, tourType));
    });
}

// Check if user should see a tour
function checkAndStartTourForUser() {
    if (!currentUser || !currentUser.id) return;
    
    // Wait for UI to settle
    setTimeout(() => {
        const currentPath = window.location.hash;
        
        // Main dashboard tour (after first login)
        if (!currentPath || currentPath === '#' || currentPath === '') {
            if (!hasSeenTour(currentUser.id, TOUR_TYPES.MAIN_DASHBOARD)) {
                startMainDashboardTour();
            }
        }
    }, 800);
}

// Main Dashboard Tour (for logged-in users)
function startMainDashboardTour() {
    if (typeof introJs === 'undefined') {
        console.warn('Intro.js not loaded');
        return;
    }

    const intro = introJs();
    
    const steps = [
        {
            title: '👋 Welcome to QuickPoll!',
            intro: `Hi ${currentUser.username}! Let's take a quick tour of the main features. This will only take a minute!`
        }
    ];
    
    // Theme toggle
    const themeToggle = document.querySelector('#themeToggle');
    if (themeToggle) {
        steps.push({
            element: themeToggle,
            title: '🌓 Dark Mode',
            intro: 'Switch between light and dark themes anytime for comfortable viewing.',
            position: 'bottom'
        });
    }
    
    // Create Poll button
    const createPollBtn = document.querySelector('#createPollBtn');
    if (createPollBtn) {
        steps.push({
            element: createPollBtn,
            title: '📊 Create Polls',
            intro: 'Click here to create a new poll! You can use templates like Yes/No, Ratings, or create custom polls.',
            position: 'bottom'
        });
    }
    
    // Notifications
    const notificationBtn = document.querySelector('#notificationBtn');
    if (notificationBtn) {
        steps.push({
            element: notificationBtn,
            title: '🔔 Notifications',
            intro: 'Get real-time notifications when people vote, comment, or react to your polls!',
            position: 'bottom'
        });
    }
    
    // Badges
    const badgesBtn = document.querySelector('#badgesBtn');
    if (badgesBtn) {
        steps.push({
            element: badgesBtn,
            title: '🏆 Badges & Achievements',
            intro: 'Earn badges as you create polls, get votes, and engage with the community!',
            position: 'bottom'
        });
    }
    
    // API Keys
    const apiKeysBtn = document.querySelector('#apiKeysBtn');
    if (apiKeysBtn) {
        steps.push({
            element: apiKeysBtn,
            title: '🔑 API Keys',
            intro: 'Generate API keys to access QuickPoll programmatically. Perfect for developers!',
            position: 'bottom'
        });
    }
    
    // Search bar
    const searchInput = document.querySelector('#searchInput');
    if (searchInput) {
        steps.push({
            element: searchInput,
            title: '🔍 Search & Filter',
            intro: 'Search for polls by keywords and use filters to sort by newest, most voted, or most liked.',
            position: 'bottom'
        });
    }
    
    // Filter buttons
    const filterButtons = document.querySelector('.filter-buttons');
    if (filterButtons) {
        steps.push({
            element: filterButtons,
            title: '🎯 Poll Filters',
            intro: 'View All polls, just Your polls, or polls you\'ve Voted on. Quick access to what matters!',
            position: 'bottom'
        });
    }
    
    // Poll card (if any exists)
    const firstPollCard = document.querySelector('.poll-card');
    if (firstPollCard) {
        steps.push({
            element: firstPollCard,
            title: '🎴 Poll Cards',
            intro: 'Each poll shows the question, creator, and quick stats. Click to vote, comment, react, and share!',
            position: 'top'
        });
        
        // Share button on poll card
        const shareBtn = firstPollCard.querySelector('.share-btn');
        if (shareBtn) {
            steps.push({
                element: shareBtn,
                title: '📤 Share',
                intro: 'Share polls on social media, copy links, or generate QR codes for easy sharing!',
                position: 'left'
            });
        }
        
        // Like button on poll card
        const likeBtn = firstPollCard.querySelector('.like-btn');
        if (likeBtn) {
            steps.push({
                element: likeBtn,
                title: '❤️ Like Polls',
                intro: 'Show appreciation by liking polls you find interesting!',
                position: 'left'
            });
        }
    }
    
    // Help button
    const helpBtn = document.querySelector('#helpBtn');
    if (helpBtn) {
        steps.push({
            element: helpBtn,
            title: '❓ Need Help?',
            intro: 'Click here anytime to restart this tour or get help with QuickPoll features!',
            position: 'bottom'
        });
    }
    
    steps.push({
        title: '🎉 You\'re All Set!',
        intro: 'That\'s everything! Now start creating polls and engaging with the community. Happy polling! 🚀'
    });
    
    intro.setOptions({
        steps: steps,
        showProgress: true,
        showBullets: true,
        exitOnOverlayClick: false,
        doneLabel: 'Let\'s Go! 🚀',
        nextLabel: 'Next →',
        prevLabel: '← Back',
        skipLabel: '×',
        scrollToElement: true,
        scrollPadding: 30,
        disableInteraction: false,
        helperElementPadding: 10,
        tooltipClass: 'customTooltip',
        highlightClass: 'customHighlight',
        showStepNumbers: false,
        keyboardNavigation: true,
        overlayOpacity: 0.75,
        autoPosition: true,
        positionPrecedence: ['bottom', 'top', 'right', 'left']
    });

    intro.oncomplete(function() {
        markTourComplete(currentUser.id, TOUR_TYPES.MAIN_DASHBOARD);
        showSuccessToast('Welcome aboard! Start creating polls now! 🎉', 'Tour Complete');
    });

    intro.onexit(function() {
        markTourComplete(currentUser.id, TOUR_TYPES.MAIN_DASHBOARD);
    });

    intro.start();
    
    // Override skip button after tour starts
    setTimeout(() => {
        const skipBtn = document.querySelector('.introjs-skipbutton');
        if (skipBtn) {
            skipBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                showTourSkipConfirmation((shouldExit) => {
                    if (shouldExit) {
                        intro.exit(true);
                    }
                });
                return false;
            };
        }
    }, 100);
}

// Poll Detail Tour (when viewing a specific poll)
function startPollDetailTour() {
    if (typeof introJs === 'undefined') return;
    if (!currentUser || !currentUser.id) return;
    if (hasSeenTour(currentUser.id, TOUR_TYPES.POLL_DETAIL)) return;

    const intro = introJs();
    
    const steps = [
        {
            title: '📊 Poll Details',
            intro: 'Here\'s how to interact with a poll in detail!'
        }
    ];
    
    // Poll options/voting
    const pollOptions = document.querySelector('.poll-options');
    if (pollOptions) {
        steps.push({
            element: pollOptions,
            title: '🗳️ Cast Your Vote',
            intro: 'Select an option and click "Vote" to submit. Results update instantly!',
            position: 'top'
        });
    }
    
    // Emoji reactions
    const reactionsSection = document.querySelector('[id^="pollReactions-"]');
    if (reactionsSection) {
        steps.push({
            element: reactionsSection,
            title: '😊 Emoji Reactions',
            intro: 'React with emojis! Click to add, click again to remove. See what others feel!',
            position: 'top'
        });
    }
    
    // Comments
    const commentsSection = document.querySelector('.comments-section');
    if (commentsSection) {
        steps.push({
            element: commentsSection,
            title: '💬 Comments',
            intro: 'Join the discussion! Add comments, upvote others, and engage with the community.',
            position: 'top'
        });
    }
    
    // Share button
    const shareBtn = document.querySelector('.poll-actions .share-btn');
    if (shareBtn) {
        steps.push({
            element: shareBtn,
            title: '📤 Share This Poll',
            intro: 'Share on Twitter, Facebook, WhatsApp, or generate a QR code!',
            position: 'left'
        });
    }
    
    steps.push({
        title: '✅ Great!',
        intro: 'Now you know how to fully interact with polls. Go ahead and participate!'
    });
    
    intro.setOptions({
        steps: steps,
        showProgress: true,
        showBullets: true,
        exitOnOverlayClick: false,
        doneLabel: 'Got it!',
        nextLabel: 'Next →',
        prevLabel: '← Back',
        skipLabel: '×',
        scrollToElement: true,
        scrollPadding: 30,
        disableInteraction: false,
        helperElementPadding: 10,
        showStepNumbers: false,
        autoPosition: true,
        positionPrecedence: ['bottom', 'top', 'right', 'left']
    });

    intro.oncomplete(() => markTourComplete(currentUser.id, TOUR_TYPES.POLL_DETAIL));
    intro.onexit(() => markTourComplete(currentUser.id, TOUR_TYPES.POLL_DETAIL));
    intro.start();
    
    // Override skip button
    setTimeout(() => {
        const skipBtn = document.querySelector('.introjs-skipbutton');
        if (skipBtn) {
            skipBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                showTourSkipConfirmation((shouldExit) => {
                    if (shouldExit) {
                        intro.exit(true);
                    }
                });
                return false;
            };
        }
    }, 100);
}

// Create Poll Tour (when opening create poll modal)
function startCreatePollTour() {
    if (typeof introJs === 'undefined') return;
    if (!currentUser || !currentUser.id) return;
    if (hasSeenTour(currentUser.id, TOUR_TYPES.CREATE_POLL)) return;

    const intro = introJs();
    
    const steps = [
        {
            title: '📝 Create a Poll',
            intro: 'Let me show you how to create an awesome poll!'
        }
    ];
    
    // Poll templates
    const templatesSection = document.querySelector('.poll-templates');
    if (templatesSection) {
        steps.push({
            element: templatesSection,
            title: '📋 Quick Templates',
            intro: 'Use templates for common poll types: Yes/No, Ratings, Agree/Disagree, or create custom!',
            position: 'top'
        });
    }
    
    // Question input
    const questionInput = document.querySelector('#pollQuestion');
    if (questionInput) {
        steps.push({
            element: questionInput,
            title: '❓ Poll Question',
            intro: 'Enter your poll question here. Make it clear and engaging!',
            position: 'bottom'
        });
    }
    
    // Options
    const optionsContainer = document.querySelector('#pollOptionsContainer');
    if (optionsContainer) {
        steps.push({
            element: optionsContainer,
            title: '✏️ Poll Options',
            intro: 'Add your poll options. You can add, remove, or reorder them as needed!',
            position: 'top'
        });
    }
    
    // Settings
    const settingsSection = document.querySelector('.poll-settings');
    if (settingsSection) {
        steps.push({
            element: settingsSection,
            title: '⚙️ Poll Settings',
            intro: 'Configure anonymous voting, multiple votes, and other advanced options!',
            position: 'top'
        });
    }
    
    steps.push({
        title: '🎉 Ready to Create!',
        intro: 'Fill in the details and click "Create Poll" to share with the world!'
    });
    
    intro.setOptions({
        steps: steps,
        showProgress: true,
        exitOnOverlayClick: false,
        doneLabel: 'Start Creating!',
        nextLabel: 'Next →',
        prevLabel: '← Back',
        skipLabel: '×',
        scrollToElement: true,
        scrollPadding: 30,
        disableInteraction: false,
        helperElementPadding: 10,
        showStepNumbers: false,
        autoPosition: true,
        positionPrecedence: ['bottom', 'top', 'right', 'left']
    });

    intro.oncomplete(() => markTourComplete(currentUser.id, TOUR_TYPES.CREATE_POLL));
    intro.onexit(() => markTourComplete(currentUser.id, TOUR_TYPES.CREATE_POLL));
    intro.start();
    
    // Override skip button
    setTimeout(() => {
        const skipBtn = document.querySelector('.introjs-skipbutton');
        if (skipBtn) {
            skipBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                showTourSkipConfirmation((shouldExit) => {
                    if (shouldExit) {
                        intro.exit(true);
                    }
                });
                return false;
            };
        }
    }, 100);
}

// API Keys Tour
function startAPIKeysTour() {
    if (typeof introJs === 'undefined') return;
    if (!currentUser || !currentUser.id) return;
    if (hasSeenTour(currentUser.id, TOUR_TYPES.API_KEYS)) return;

    const intro = introJs();
    
    const steps = [
        {
            title: '🔑 API Keys',
            intro: 'API keys let you access QuickPoll programmatically. Here\'s how!'
        },
        {
            element: document.querySelector('#createApiKeyBtn'),
            title: '➕ Create Key',
            intro: 'Click here to generate a new API key with a custom name and description.',
            position: 'bottom'
        },
        {
            element: document.querySelector('#testApiKeyBtn'),
            title: '🧪 Test Keys',
            intro: 'Test your API keys to make sure they work correctly!',
            position: 'bottom'
        },
        {
            title: '📚 Documentation',
            intro: 'Check the API documentation to learn how to use your keys in your applications!'
        }
    ];
    
    intro.setOptions({
        steps: steps,
        showProgress: true,
        exitOnOverlayClick: false,
        doneLabel: 'Got it!',
        nextLabel: 'Next →',
        skipLabel: '×',
        scrollToElement: true,
        scrollPadding: 30,
        disableInteraction: false,
        helperElementPadding: 10,
        showStepNumbers: false,
        autoPosition: true,
        positionPrecedence: ['bottom', 'top', 'right', 'left']
    });

    intro.oncomplete(() => markTourComplete(currentUser.id, TOUR_TYPES.API_KEYS));
    intro.onexit(() => markTourComplete(currentUser.id, TOUR_TYPES.API_KEYS));
    intro.start();
    
    // Override skip button
    setTimeout(() => {
        const skipBtn = document.querySelector('.introjs-skipbutton');
        if (skipBtn) {
            skipBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                showTourSkipConfirmation((shouldExit) => {
                    if (shouldExit) {
                        intro.exit(true);
                    }
                });
                return false;
            };
        }
    }, 100);
}

// Legacy function for backward compatibility
function startWelcomeTour() {
    if (typeof introJs === 'undefined') {
        console.warn('Intro.js not loaded');
        return;
    }

    const intro = introJs();
    
    // Helper function to check if element is visible and in viewport
    function isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }
    
    // Build steps dynamically based on which elements exist AND are visible
    const steps = [
        {
            title: '� Welcome to QuickPoll!',
            intro: 'Let me show you around! This quick tour will help you get started with creating and managing polls.'
        }
    ];
    
    // Theme toggle - usually always visible
    const themeToggle = document.querySelector('#themeToggle');
    if (themeToggle && isElementVisible(themeToggle)) {
        steps.push({
            element: themeToggle,
            title: '🌓 Dark Mode',
            intro: 'Toggle between light and dark themes for comfortable viewing anytime.',
            position: 'bottom'
        });
    }
    
    // Search input - visible on main page
    const searchInput = document.querySelector('#searchInput') || document.querySelector('.search-filter-bar');
    if (searchInput && isElementVisible(searchInput)) {
        steps.push({
            element: searchInput,
            title: '🔍 Search & Filter',
            intro: 'Search for polls and use filters to sort by newest, most voted, or most liked.',
            position: 'bottom'
        });
    }
    
    // Notification button - only visible when logged in
    const notificationBtn = document.querySelector('#notificationBtn');
    if (notificationBtn && isElementVisible(notificationBtn)) {
        steps.push({
            element: notificationBtn,
            title: '🔔 Notifications',
            intro: 'Get notified when someone votes on your polls, comments, or likes them.',
            position: 'bottom'
        });
    }
    
    // Create poll button - only visible when logged in
    const createPollBtn = document.querySelector('#createPollBtn');
    if (createPollBtn && isElementVisible(createPollBtn)) {
        steps.push({
            element: createPollBtn,
            title: '📊 Create Polls',
            intro: 'Click here to create a new poll. You can use templates for common poll types like Yes/No, ratings, and more!',
            position: 'bottom'
        });
    }
    
    // API Keys button - only visible when logged in
    const apiKeysBtn = document.querySelector('#apiKeysBtn');
    if (apiKeysBtn && isElementVisible(apiKeysBtn)) {
        steps.push({
            element: apiKeysBtn,
            title: '🔑 API Keys',
            intro: 'Generate API keys for programmatic access to create polls, fetch results, and more!',
            position: 'bottom'
        });
    }
    
    // Polls section - visible on main page
    const pollsSection = document.querySelector('.polls-section') || document.querySelector('#pollsContainer');
    if (pollsSection && isElementVisible(pollsSection)) {
        // Check if there are any poll cards
        const firstPollCard = pollsSection.querySelector('.poll-card');
        if (firstPollCard && isElementVisible(firstPollCard)) {
            steps.push({
                element: firstPollCard,
                title: '🎯 Poll Cards',
                intro: 'Each poll shows the question, options, and current results. Click to see details, vote, and engage!',
                position: 'top'
            });
        } else {
            steps.push({
                element: pollsSection,
                title: '🎯 Polls Area',
                intro: 'Polls will appear here. Click any poll to vote, comment, like, and share with others!',
                position: 'top'
            });
        }
    }
    
    // If on poll detail page, add poll-specific steps
    const pollDetail = document.querySelector('.poll-detail');
    if (pollDetail && isElementVisible(pollDetail)) {
        const optionsContainer = document.querySelector('.poll-options');
        if (optionsContainer && isElementVisible(optionsContainer)) {
            steps.push({
                element: optionsContainer,
                title: '🗳️ Cast Your Vote',
                intro: 'Select an option and click "Vote" to submit your choice. Results update instantly!',
                position: 'top'
            });
        }
        
        const reactionsSection = document.querySelector('[id^="pollReactions-"]');
        if (reactionsSection && isElementVisible(reactionsSection)) {
            steps.push({
                element: reactionsSection,
                title: '😊 React with Emojis',
                intro: 'Express your feelings! Click any emoji to react. Click again to remove your reaction.',
                position: 'top'
            });
        }
        
        const shareBtn = document.querySelector('.share-btn');
        if (shareBtn && isElementVisible(shareBtn)) {
            steps.push({
                element: shareBtn,
                title: '📤 Share Poll',
                intro: 'Share this poll via social media, copy the link, or download a QR code!',
                position: 'left'
            });
        }
        
        const commentsSection = document.querySelector('.comments-section');
        if (commentsSection && isElementVisible(commentsSection)) {
            steps.push({
                element: commentsSection,
                title: '💬 Join the Discussion',
                intro: 'Read comments and add your own thoughts. Upvote comments you agree with!',
                position: 'top'
            });
        }
    }
    
    steps.push({
        title: '✅ You\'re All Set!',
        intro: 'That\'s it! Start creating polls, voting, and engaging with the community. You can restart this tour anytime from the help menu. Happy polling! 🎉'
    });
    
    intro.setOptions({
        steps: steps,
        showProgress: true,
        showBullets: true,
        exitOnOverlayClick: false,
        doneLabel: 'Get Started!',
        nextLabel: 'Next →',
        prevLabel: '← Back',
        skipLabel: '×',
        // Enhanced scrolling and visibility options
        scrollToElement: true,
        scrollPadding: 120,
        disableInteraction: true,
        helperElementPadding: 20,
        tooltipClass: 'customTooltip',
        highlightClass: 'customHighlight'
    });

    intro.oncomplete(function() {
        localStorage.setItem('hasSeenTour', 'true');
        showSuccessToast('Welcome aboard! Enjoy creating polls! 🎉', 'Tour Complete');
    });

    intro.onexit(function() {
        localStorage.setItem('hasSeenTour', 'true');
    });

    intro.start();
}

function checkFirstTimeUser() {
    // Check if user has seen the tour
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    
    // Only show tour if user is logged in and hasn't seen it
    if (!hasSeenTour && currentToken) {
        // Delay to ensure all UI elements are loaded
        setTimeout(() => {
            startWelcomeTour();
        }, 1000);
    }
}

// Add restart tour button function
// Restart tour function (called from help button)
function restartTour() {
    if (!currentUser || !currentUser.id) {
        showWarningToast('Please log in to use the tour feature!', 'Login Required');
        return;
    }
    
    // Reset the main dashboard tour
    localStorage.removeItem(getTourKey(currentUser.id, TOUR_TYPES.MAIN_DASHBOARD));
    
    // Start the tour
    startMainDashboardTour();
}

// Reset all tours for current user (for testing/debugging)
function resetAllToursForCurrentUser() {
    if (currentUser && currentUser.id) {
        resetAllTours(currentUser.id);
        showInfoToast('All tours have been reset. They will show again on next visit!', 'Tours Reset');
    }
}

// ===== Emoji Reactions System =====

// Get or create session ID for anonymous users
function getOrCreateSessionId() {
    if (!sessionId) {
        sessionId = localStorage.getItem('quickpoll_session_id');
        if (!sessionId) {
            sessionId = generateUUID();
            localStorage.setItem('quickpoll_session_id', sessionId);
        }
    }
    return sessionId;
}

// Generate UUID v4
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Create reaction picker HTML
function createReactionPicker(targetType, targetId, reactions = []) {
    const reactionMap = {};
    reactions.forEach(r => {
        reactionMap[r.emoji] = { count: r.count, user_reacted: r.user_reacted };
    });
    
    const buttons = ALLOWED_EMOJIS.map(emoji => {
        const data = reactionMap[emoji] || { count: 0, user_reacted: false };
        const reactedClass = data.user_reacted ? 'reacted' : '';
        const label = EMOJI_LABELS[emoji];
        
        return `
            <button 
                class="reaction-btn ${reactedClass}" 
                data-emoji="${emoji}"
                data-target-type="${targetType}"
                data-target-id="${targetId}"
                onclick="toggleReaction('${targetType}', ${targetId}, '${emoji}')"
                title="${label}"
                aria-label="${label}, ${data.count} reactions">
                <span class="emoji">${emoji}</span>
                <span class="count">${data.count}</span>
            </button>
        `;
    }).join('');
    
    return `<div class="reaction-picker" id="${targetType}Reactions-${targetId}">${buttons}</div>`;
}

// Load reactions for a poll
async function loadPollReactions(pollId) {
    try {
        const sid = getOrCreateSessionId();
        const headers = {};
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        const response = await fetch(
            `${API_BASE_URL}/api/reactions/polls/${pollId}?session_id=${sid}`,
            { headers }
        );
        
        if (response.ok) {
            const reactions = await response.json();
            updateReactionDisplay('poll', pollId, reactions);
        }
    } catch (error) {
        console.error('Error loading poll reactions:', error);
    }
}

// Load reactions for a comment
async function loadCommentReactions(commentId) {
    try {
        const sid = getOrCreateSessionId();
        const headers = {};
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        const response = await fetch(
            `${API_BASE_URL}/api/reactions/comments/${commentId}?session_id=${sid}`,
            { headers }
        );
        
        if (response.ok) {
            const reactions = await response.json();
            updateReactionDisplay('comment', commentId, reactions);
        }
    } catch (error) {
        console.error('Error loading comment reactions:', error);
    }
}

// Update reaction display
function updateReactionDisplay(targetType, targetId, reactions) {
    const container = document.getElementById(`${targetType}Reactions-${targetId}`);
    if (!container) return;
    
    reactions.forEach(reaction => {
        const btn = container.querySelector(`button[data-emoji="${reaction.emoji}"]`);
        if (btn) {
            const countSpan = btn.querySelector('.count');
            if (countSpan) {
                countSpan.textContent = reaction.count;
            }
            
            if (reaction.user_reacted) {
                btn.classList.add('reacted');
            } else {
                btn.classList.remove('reacted');
            }
            
            // Update aria-label
            btn.setAttribute('aria-label', `${EMOJI_LABELS[reaction.emoji]}, ${reaction.count} reactions`);
        }
    });
}

// Toggle reaction (add or remove)
async function toggleReaction(targetType, targetId, emoji) {
    const btn = document.querySelector(
        `#${targetType}Reactions-${targetId} button[data-emoji="${emoji}"]`
    );
    
    if (!btn) {
        console.error('Reaction button not found:', { targetType, targetId, emoji });
        return;
    }
    
    // Prevent spam clicking
    if (btn.classList.contains('animating')) return;
    
    try {
        // Add animation
        btn.classList.add('animating');
        setTimeout(() => btn.classList.remove('animating'), 400);
        
        const sid = getOrCreateSessionId();
        const headers = { 'Content-Type': 'application/json' };
        
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        const endpoint = targetType === 'poll' 
            ? `${API_BASE_URL}/api/reactions/polls/${targetId}`
            : `${API_BASE_URL}/api/reactions/comments/${targetId}`;
        
        console.log('Emoji Reaction Request:', {
            endpoint,
            emoji,
            session_id: sid,
            hasToken: !!currentToken
        });
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ emoji, session_id: sid })
        });
        
        console.log('Emoji Reaction Response:', {
            status: response.status,
            ok: response.ok,
            url: response.url
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Reaction result:', result);
            
            // Update count
            const countSpan = btn.querySelector('.count');
            if (countSpan) {
                countSpan.textContent = result.count;
            }
            
            // Toggle reacted state
            if (result.user_reacted) {
                btn.classList.add('reacted');
            } else {
                btn.classList.remove('reacted');
            }
            
            // Update aria-label
            btn.setAttribute('aria-label', `${EMOJI_LABELS[emoji]}, ${result.count} reactions`);
        } else {
            const errorText = await response.text();
            console.error('Emoji reaction error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            
            let errorMsg = 'Failed to update reaction';
            try {
                const errorJson = JSON.parse(errorText);
                errorMsg = errorJson.detail || errorMsg;
            } catch (e) {
                errorMsg = errorText || errorMsg;
            }
            
            showErrorToast(errorMsg);
        }
    } catch (error) {
        console.error('Error toggling reaction:', error);
        showErrorToast('Network error. Please try again.');
    }
}

// ===== Gamification - Badges & Achievements =====

let allBadges = [];
let userBadges = [];

async function loadBadges() {
    const badgesGrid = document.getElementById('badgesGrid');
    
    try {
        // Show loading skeleton with better UX
        badgesGrid.innerHTML = `
            <div class="badges-loading">
                <div class="spinner" style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #4a90e2; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto;"></div>
                <p style="text-align: center; color: #666; margin-top: 10px;">Loading badges and achievements...</p>
            </div>
        `;
        
        // Load all badges
        const badgesResponse = await fetch(`${API_BASE_URL}/api/badges/`, {
            headers: currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}
        });
        
        if (badgesResponse.ok) {
            allBadges = await badgesResponse.json();
        }
        
        // Load user's badges
        if (currentUser) {
            const userBadgesResponse = await fetch(`${API_BASE_URL}/api/badges/my-badges`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            
            if (userBadgesResponse.ok) {
                userBadges = await userBadgesResponse.json();
                updateBadgeCount(userBadges.length);
            }
            
            // Load progress stats
            const progressResponse = await fetch(`${API_BASE_URL}/api/badges/progress`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            
            if (progressResponse.ok) {
                const progress = await progressResponse.json();
                updateProgressStats(progress);
            }
        }
        
        // Display badges with a slight delay for smooth transition
        setTimeout(() => {
            displayBadges(allBadges);
        }, 300);
    } catch (error) {
        console.error('Error loading badges:', error);
        badgesGrid.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 40px; color: #ef4444;">
                <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
                <h3>Failed to load badges</h3>
                <p style="color: #666; margin: 10px 0;">Please check your connection and try again</p>
                <button class="btn btn-primary" onclick="loadBadges()" style="margin-top: 15px;">🔄 Retry</button>
            </div>
        `;
    }
}

function updateBadgeCount(count) {
    const badgeCount = document.getElementById('badgeCount');
    if (count > 0) {
        badgeCount.textContent = count > 99 ? '99+' : count;
        badgeCount.style.display = 'inline-block';
    } else {
        badgeCount.style.display = 'none';
    }
}

function updateProgressStats(progress) {
    // Add loading animation initially, then update with actual values
    const stats = [
        { id: 'progressPollsCreated', value: progress.polls_created, label: 'polls created' },
        { id: 'progressVotesCast', value: progress.votes_cast, label: 'votes cast' },
        { id: 'progressComments', value: progress.comments_written, label: 'comments' },
        { id: 'progressLikes', value: progress.likes_given, label: 'likes given' },
        { id: 'progressBadgesEarned', value: progress.badges_earned, label: 'badges' },
        { id: 'progressTotalPoints', value: progress.total_points, label: 'points' }
    ];
    
    stats.forEach((stat, index) => {
        const element = document.getElementById(stat.id);
        if (element) {
            // Animate count up from 0 to actual value
            setTimeout(() => {
                animateCounter(element, 0, stat.value, 800);
            }, index * 100); // Stagger animations
        }
    });
}

// Animate counter from start to end value
function animateCounter(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16); // 60 FPS
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

function displayBadges(badges) {
    const grid = document.getElementById('badgesGrid');
    
    if (badges.length === 0) {
        grid.innerHTML = '<p>No badges available yet!</p>';
        return;
    }
    
    grid.innerHTML = badges.map(badge => createBadgeCard(badge)).join('');
}

function createBadgeCard(badge) {
    const earnedClass = badge.earned ? 'earned' : 'locked';
    const rarityClass = badge.rarity.toLowerCase();
    
    // Find earned date if badge is earned
    let earnedAt = '';
    if (badge.earned && userBadges.length > 0) {
        const userBadge = userBadges.find(ub => ub.badge_id === badge.id);
        if (userBadge) {
            const date = new Date(userBadge.earned_at);
            earnedAt = `<div class="badge-earned-at">Earned on ${date.toLocaleDateString()}</div>`;
        }
    }
    
    return `
        <div class="badge-card ${earnedClass} ${rarityClass}" data-category="${badge.category}">
            <div class="badge-icon">${badge.icon}</div>
            <div class="badge-name">${badge.name}</div>
            <div class="badge-description">${badge.description}</div>
            <div class="badge-meta">
                <span class="badge-rarity ${rarityClass}">${badge.rarity.toUpperCase()}</span>
                <span class="badge-points">⭐ ${badge.points}</span>
            </div>
            ${earnedAt}
        </div>
    `;
}

function filterBadges(category) {
    const grid = document.getElementById('badgesGrid');
    const badgeCards = grid.querySelectorAll('.badge-card');
    
    badgeCards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

async function checkForNewBadges() {
    if (!currentUser || !currentToken) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/badges/check`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        if (response.ok) {
            const newBadges = await response.json();
            
            if (newBadges.length > 0) {
                // Show badge notification for each newly earned badge
                newBadges.forEach(badge => {
                    showBadgeEarnedToast(badge);
                });
                
                // Update badge count
                const currentCount = parseInt(document.getElementById('badgeCount').textContent) || 0;
                updateBadgeCount(currentCount + newBadges.length);
            }
        }
    } catch (error) {
        console.error('Error checking for new badges:', error);
    }
}

function showBadgeEarnedToast(badge) {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-success badge-earned';
    toast.innerHTML = `
        <div class="badge-toast-content">
            <div class="badge-toast-icon">${badge.icon}</div>
            <div class="badge-toast-text">
                <div class="badge-toast-title">🎉 Badge Earned!</div>
                <div class="badge-toast-desc">${badge.name} - ${badge.description}</div>
            </div>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    // Add confetti for badge earn
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

function showSpinner(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<p class="loading">Loading...</p>';
    }
}

// ===================================
// User Profile Management
// ===================================

// Upload tab switching
function setupUploadTabs() {
    document.querySelectorAll('.upload-tab').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            const container = e.target.closest('.upload-methods');
            
            // Update active states
            container.querySelectorAll('.upload-tab').forEach(btn => btn.classList.remove('active'));
            container.querySelectorAll('.upload-tab-content').forEach(content => content.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });
}

// Image upload handlers
function setupImageUploads() {
    // Avatar upload
    const avatarFile = document.getElementById('avatarFile');
    const avatarUploadArea = document.getElementById('avatarUploadArea');
    
    if (avatarFile) {
        avatarFile.addEventListener('change', (e) => handleImageUpload(e, 'avatar'));
        
        // Drag and drop
        avatarUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            avatarUploadArea.classList.add('drag-over');
        });
        
        avatarUploadArea.addEventListener('dragleave', () => {
            avatarUploadArea.classList.remove('drag-over');
        });
        
        avatarUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            avatarUploadArea.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                avatarFile.files = e.dataTransfer.files;
                handleImageUpload({ target: avatarFile }, 'avatar');
            }
        });
    }
    
    // Cover upload
    const coverFile = document.getElementById('coverFile');
    const coverUploadArea = document.getElementById('coverUploadArea');
    
    if (coverFile) {
        coverFile.addEventListener('change', (e) => handleImageUpload(e, 'cover'));
        
        // Drag and drop
        coverUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            coverUploadArea.classList.add('drag-over');
        });
        
        coverUploadArea.addEventListener('dragleave', () => {
            coverUploadArea.classList.remove('drag-over');
        });
        
        coverUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            coverUploadArea.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                coverFile.files = e.dataTransfer.files;
                handleImageUpload({ target: coverFile }, 'cover');
            }
        });
    }
}

async function handleImageUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Please select a valid image file (JPG, PNG, GIF, or WebP)', 'error');
        return;
    }
    
    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('Image size must be less than 5MB', 'error');
        return;
    }
    
    // Show loading state
    const previewElement = document.getElementById(`${type}Preview`);
    previewElement.style.display = 'block';
    previewElement.innerHTML = '<div class="upload-loading">⏳ Uploading...</div>';
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload to server
        const response = await fetch(`${API_BASE_URL}/api/users/upload-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Show preview
            const imageUrl = `${window.location.origin}${data.url}`;
            previewElement.innerHTML = `
                <div class="uploaded-image-preview">
                    <img src="${imageUrl}" alt="Preview">
                    <button type="button" class="remove-image-btn" onclick="removeUploadedImage('${type}')">
                        ✕ Remove
                    </button>
                </div>
            `;
            
            // Store the URL for form submission
            if (type === 'avatar') {
                document.getElementById('avatarUrl').value = data.url;
            } else {
                document.getElementById('coverImageUrl').value = data.url;
            }
            
            showToast('Image uploaded successfully!', 'success');
            updateLivePreview();
        } else {
            const error = await response.json();
            showToast(error.detail || 'Failed to upload image', 'error');
            previewElement.style.display = 'none';
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Failed to upload image', 'error');
        previewElement.style.display = 'none';
    }
}

function removeUploadedImage(type) {
    const previewElement = document.getElementById(`${type}Preview`);
    const fileInput = document.getElementById(`${type}File`);
    const urlInput = document.getElementById(type === 'avatar' ? 'avatarUrl' : 'coverImageUrl');
    
    previewElement.style.display = 'none';
    previewElement.innerHTML = '';
    fileInput.value = '';
    urlInput.value = '';
    
    updateLivePreview();
}

function updateLivePreview() {
    const avatarUrl = document.getElementById('avatarUrl').value;
    const coverUrl = document.getElementById('coverImageUrl').value;
    const bio = document.getElementById('bio').value;
    const location = document.getElementById('location').value;
    const website = document.getElementById('website').value;
    const twitter = document.getElementById('twitterHandle').value;
    
    if (avatarUrl || coverUrl || bio) {
        const preview = {
            avatar_url: avatarUrl,
            cover_image_url: coverUrl,
            bio: bio,
            location: location,
            website: website,
            twitter_handle: twitter
        };
        updateProfilePreview(preview);
    }
}

async function loadUserProfile() {
    if (!currentToken) {
        showToast('Please log in to view your profile', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
            headers: { 
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const user = await response.json();
            
            // Populate form fields
            document.getElementById('avatarUrl').value = user.avatar_url || '';
            document.getElementById('coverImageUrl').value = user.cover_image_url || '';
            document.getElementById('bio').value = user.bio || '';
            document.getElementById('location').value = user.location || '';
            document.getElementById('website').value = user.website || '';
            document.getElementById('twitterHandle').value = user.twitter_handle || '';
            document.getElementById('isPublicProfile').checked = user.is_public_profile !== false;
            
            // Update bio counter
            const bioLength = (user.bio || '').length;
            document.getElementById('bioCount').textContent = bioLength;
            
            // Show existing images in preview
            if (user.avatar_url) {
                const avatarPreview = document.getElementById('avatarPreview');
                avatarPreview.style.display = 'block';
                avatarPreview.innerHTML = `
                    <div class="uploaded-image-preview">
                        <img src="${user.avatar_url.startsWith('http') ? user.avatar_url : window.location.origin + user.avatar_url}" alt="Avatar">
                        <button type="button" class="remove-image-btn" onclick="removeUploadedImage('avatar')">
                            ✕ Remove
                        </button>
                    </div>
                `;
            }
            
            if (user.cover_image_url) {
                const coverPreview = document.getElementById('coverPreview');
                coverPreview.style.display = 'block';
                coverPreview.innerHTML = `
                    <div class="uploaded-image-preview">
                        <img src="${user.cover_image_url.startsWith('http') ? user.cover_image_url : window.location.origin + user.cover_image_url}" alt="Cover">
                        <button type="button" class="remove-image-btn" onclick="removeUploadedImage('cover')">
                            ✕ Remove
                        </button>
                    </div>
                `;
            }
            
            // Show profile preview
            if (user.avatar_url || user.cover_image_url || user.bio) {
                updateProfilePreview(user);
            }
        } else {
            showToast('Failed to load profile', 'error');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Failed to load profile', 'error');
    }
}

async function updateProfile(event) {
    event.preventDefault();
    
    if (!currentToken) {
        showToast('Please log in to update your profile', 'error');
        return;
    }

    // Prevent double submission
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Saving...';

    const formData = {
        avatar_url: document.getElementById('avatarUrl').value.trim() || null,
        cover_image_url: document.getElementById('coverImageUrl').value.trim() || null,
        bio: document.getElementById('bio').value.trim() || null,
        location: document.getElementById('location').value.trim() || null,
        website: document.getElementById('website').value.trim() || null,
        twitter_handle: document.getElementById('twitterHandle').value.trim() || null,
        is_public_profile: document.getElementById('isPublicProfile').checked
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/profile`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            currentUser = updatedUser;
            showToast('Profile updated successfully!', 'success');
            closeModal('profileModal'); // Fixed: was hideModal, should be closeModal
            
            // Update username display if changed
            if (updatedUser.username) {
                const usernameElement = document.getElementById('username');
                if (usernameElement) {
                    usernameElement.textContent = updatedUser.username;
                }
            }
        } else {
            // Log the full error for debugging
            const errorText = await response.text();
            console.error('Profile update failed:', response.status, errorText);
            
            try {
                const error = JSON.parse(errorText);
                showToast(error.detail || 'Failed to update profile', 'error');
            } catch (e) {
                showToast(`Failed to update profile (${response.status})`, 'error');
            }
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Network error: Failed to update profile', 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-icon">💾</span> Save Profile';
    }
}

function updateProfilePreview(user) {
    const preview = document.getElementById('profilePreview');
    if (!preview) return;
    
    if (user.avatar_url || user.cover_image_url) {
        preview.style.display = 'block';
        preview.innerHTML = `
            <div class="profile-preview-card">
                ${user.cover_image_url ? `<div class="profile-cover" style="background-image: url('${user.cover_image_url}')"></div>` : ''}
                <div class="profile-preview-content">
                    ${user.avatar_url ? `<img src="${user.avatar_url}" alt="Avatar" class="profile-avatar">` : ''}
                    <h3>${currentUser?.username || 'Your Name'}</h3>
                    ${user.bio ? `<p class="profile-bio">${user.bio}</p>` : ''}
                    <div class="profile-meta">
                        ${user.location ? `<span>📍 ${user.location}</span>` : ''}
                        ${user.website ? `<span>🔗 ${user.website}</span>` : ''}
                        ${user.twitter_handle ? `<span>🐦 @${user.twitter_handle}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    } else {
        preview.style.display = 'none';
    }
}

// ===================================
// Welcome Tour / Onboarding System
// ===================================

const tourSteps = [
    {
        target: '#createPollBtn',
        title: '🎯 Create Your First Poll',
        description: 'Click here to create engaging polls! Use AI to generate options, choose from templates, or start from scratch. Share globally and get instant feedback.',
        position: 'bottom'
    },
    {
        target: '.search-wrapper',
        title: '🔍 Search & Discover',
        description: 'Find polls from around the world by searching keywords. Discover what topics people are discussing globally!',
        position: 'bottom'
    },
    {
        target: '.advanced-filters',
        title: '📊 Advanced Filters',
        description: 'Sort by newest, most voted, or most liked. Filter by date range to find trending topics or historical polls.',
        position: 'bottom'
    },
    {
        target: '#apiKeysBtn',
        title: '� API Access',
        description: 'Create API keys for programmatic access! Build apps, integrations, and automate poll creation and voting.',
        position: 'bottom'
    },
    {
        target: '#badgesBtn',
        title: '� Gamification',
        description: 'Earn badges and track achievements! Create polls, vote, comment, and unlock 18 different badges with points.',
        position: 'bottom'
    },
    {
        target: '#notificationsBtn',
        title: '🔔 Notifications',
        description: 'Stay updated with real-time notifications when people vote, comment, or react to your polls.',
        position: 'bottom'
    },
    {
        target: '#themeToggle',
        title: '� Customize Experience',
        description: 'Switch between light and dark themes. Your preference is saved and works across all devices!',
        position: 'bottom'
    }
];

let currentTourStep = 0;
let tourActive = false;

function startWelcomeTour() {
    // Check if user has seen the tour
    if (localStorage.getItem('tourCompleted') === 'true') {
        return;
    }
    
    tourActive = true;
    currentTourStep = 0;
    showTourStep(currentTourStep);
}

function showTourStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= tourSteps.length) {
        endTour();
        return;
    }
    
    const step = tourSteps[stepIndex];
    const targetElement = document.querySelector(step.target);
    
    if (!targetElement) {
        // Skip to next step if target doesn't exist
        showTourStep(stepIndex + 1);
        return;
    }
    
    // Show overlay
    const overlay = document.getElementById('tourOverlay');
    const tooltip = document.getElementById('tourTooltip');
    
    overlay.style.display = 'block';
    tooltip.style.display = 'block';
    
    // Update tooltip content
    document.querySelector('.tour-title').textContent = step.title;
    document.querySelector('.tour-description').textContent = step.description;
    document.querySelector('.tour-step-count').textContent = `Step ${stepIndex + 1} of ${tourSteps.length}`;
    
    // Update buttons
    const prevBtn = document.getElementById('tourPrev');
    const nextBtn = document.getElementById('tourNext');
    
    prevBtn.style.display = stepIndex > 0 ? 'inline-block' : 'none';
    nextBtn.textContent = stepIndex === tourSteps.length - 1 ? 'Finish ✓' : 'Next →';
    
    // Highlight target element
    document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
    });
    targetElement.classList.add('tour-highlight');
    
    // Position tooltip
    positionTooltip(targetElement, tooltip, step.position);
}

function positionTooltip(target, tooltip, preferredPosition = 'bottom') {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 20;
    
    let top, left;
    
    // Calculate position based on preference
    if (preferredPosition === 'bottom') {
        top = targetRect.bottom + padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        
        // Check if tooltip goes off bottom of screen
        if (top + tooltipRect.height > window.innerHeight) {
            top = targetRect.top - tooltipRect.height - padding;
        }
    } else if (preferredPosition === 'top') {
        top = targetRect.top - tooltipRect.height - padding;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        
        // Check if tooltip goes off top of screen
        if (top < 0) {
            top = targetRect.bottom + padding;
        }
    } else if (preferredPosition === 'left') {
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left - tooltipRect.width - padding;
        
        // Check if tooltip goes off left of screen
        if (left < 0) {
            left = targetRect.right + padding;
        }
    } else if (preferredPosition === 'right') {
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + padding;
        
        // Check if tooltip goes off right of screen
        if (left + tooltipRect.width > window.innerWidth) {
            left = targetRect.left - tooltipRect.width - padding;
        }
    }
    
    // Keep tooltip within viewport horizontally
    if (left < padding) {
        left = padding;
    }
    if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
    }
    
    // Keep tooltip within viewport vertically
    if (top < padding) {
        top = padding;
    }
    if (top + tooltipRect.height > window.innerHeight - padding) {
        top = window.innerHeight - tooltipRect.height - padding;
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function nextTourStep() {
    currentTourStep++;
    if (currentTourStep >= tourSteps.length) {
        endTour(true);
    } else {
        showTourStep(currentTourStep);
    }
}

function previousTourStep() {
    currentTourStep--;
    showTourStep(currentTourStep);
}

function skipTour() {
    const dontShowAgain = document.getElementById('tourDontShow').checked;
    
    if (dontShowAgain) {
        endTour(true);
    } else {
        // Use custom confirm dialog instead of browser confirm
        customConfirm(
            '⏭️ Skip Tour',
            'Are you sure you want to skip the tour? You can restart it anytime by clicking the ❓ Help button.',
            'Skip Tour',
            'Continue Tour'
        ).then(confirmed => {
            if (confirmed) {
                endTour(false);
            }
        });
    }
}

function endTour(completed = false) {
    tourActive = false;
    
    // Hide overlay and tooltip
    document.getElementById('tourOverlay').style.display = 'none';
    document.getElementById('tourTooltip').style.display = 'none';
    
    // Remove highlights
    document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
    });
    
    // Reset checkbox
    document.getElementById('tourDontShow').checked = false;
    
    if (completed) {
        localStorage.setItem('tourCompleted', 'true');
        showSuccessToast('Tour completed! You\'re all set to start creating amazing polls! 🎉', 'Welcome Aboard!');
    }
}

function restartTour() {
    localStorage.removeItem('tourCompleted');
    currentTourStep = 0;
    startWelcomeTour();
}

// Tour event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tourNext')?.addEventListener('click', nextTourStep);
    document.getElementById('tourPrev')?.addEventListener('click', previousTourStep);
    document.getElementById('tourSkip')?.addEventListener('click', skipTour);
    document.getElementById('tourClose')?.addEventListener('click', () => skipTour());
    
    // Close tour when clicking overlay
    document.getElementById('tourOverlay')?.addEventListener('click', () => skipTour());
});

