// =============================================
// Medijus Authentication Module (Supabase Auth)
// =============================================

(function () {
    'use strict';

    // Wait for supabase to be available
    if (typeof supabase === 'undefined') {
        console.warn('auth.js: supabase client not found. Load supabase-config.js first.');
        return;
    }

    // --- Helpers ---

    function qs(sel, root) {
        return (root || document).querySelector(sel);
    }

    function qsa(sel, root) {
        return (root || document).querySelectorAll(sel);
    }

    // --- Nav update for logged-in / logged-out state ---

    const ADMIN_EMAILS = ['kkleivaarnas@gmail.com'];

    function updateNavForUser(user) {
        const navRight = qs('.auth-nav-buttons');
        if (!navRight) return;

        if (user) {
            const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Vartotojas';
            const initial = name.charAt(0).toUpperCase();
            const avatarUrl = user.user_metadata?.avatar_url;
            const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());

            const adminLink = isAdmin ? `
                <a href="admin.html" class="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold uppercase tracking-wide" style="border-radius:4px;" title="Admin panelė">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Admin
                </a>
            ` : '';

            navRight.innerHTML = `
                <div class="flex items-center gap-3">
                    ${adminLink}
                    <a href="zinutes.html" class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 relative" style="border-radius:4px;" title="Žinutės">
                        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-primary" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                        </svg>
                    </a>
                    <a href="profilis.html" class="flex items-center gap-2 hover:opacity-80">
                        <div class="relative flex-shrink-0">
                            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                                ${avatarUrl
                                    ? `<img src="${avatarUrl}" alt="${name}" class="w-full h-full object-cover">`
                                    : initial
                                }
                            </div>
                            <span id="nav-action-badge" class="hidden absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900" title="Užsakymų, laukiančių tavo veiksmo"></span>
                        </div>
                        <span class="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">${name}</span>
                    </a>
                    <button id="auth-signout-btn" class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium ml-1">
                        Atsijungti
                    </button>
                </div>
            `;

            const btn = qs('#auth-signout-btn');
            if (btn) {
                btn.addEventListener('click', async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                });
            }

            updateActionBadge(user);
        } else {
            navRight.innerHTML = `
                <a href="prisijungimas.html" class="hidden sm:block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium">
                    Prisijungti
                </a>
                <a href="prisijungimas.html?tab=register" class="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 text-sm sm:px-6 sm:py-2.5 sm:text-base font-medium" style="border-radius: 4px;">
                    Registruotis
                </a>
            `;
        }
    }

    // --- Profile notification badge: orders awaiting the user's action ---
    // Creator: paid orders awaiting delivery. Client: delivered orders awaiting confirmation.
    async function updateActionBadge(user) {
        const badge = document.getElementById('nav-action-badge');
        if (!badge || !user) return;
        try {
            let count = 0;
            const { data: cr } = await supabase
                .from('creators').select('id').eq('user_id', user.id).maybeSingle();
            if (cr?.id) {
                const { count: c } = await supabase.from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('creator_id', cr.id).eq('status', 'paid');
                count = c || 0;
            } else {
                const { count: c } = await supabase.from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id).eq('status', 'delivered');
                count = c || 0;
            }
            if (count > 0) {
                badge.textContent = count > 9 ? '9+' : String(count);
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        } catch (_) { /* orders table/column missing — keep badge hidden */ }
    }

    // --- Session check on every page load ---

    // Pages that don't enforce the onboarding gate (auth flows + onboarding itself + legal)
    const ONBOARDING_EXEMPT = new Set([
        '/onboarding.html', '/prisijungimas.html',
        '/naudojimo-salygos.html', '/privatumo-politika.html',
    ]);

    async function enforceOnboarding(user) {
        if (!user) return;
        const path = window.location.pathname;
        // Normalize path (Vercel sometimes serves without .html)
        const normalized = path.endsWith('.html') ? path : (path === '/' ? '/index.html' : path + '.html');
        if (ONBOARDING_EXEMPT.has(normalized) || ONBOARDING_EXEMPT.has(path)) return;

        try {
            const { data: profile } = await supabase.from('profiles').select('onboarded_at').eq('id', user.id).maybeSingle();
            if (!profile?.onboarded_at) {
                window.location.href = 'onboarding.html';
            }
        } catch (e) {
            console.warn('onboarding check failed', e);
        }
    }

    async function initAuth() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            updateNavForUser(session?.user || null);
            await enforceOnboarding(session?.user || null);
        } catch (e) {
            console.error('auth.js: session check failed', e);
            updateNavForUser(null);
        }

        // Listen for auth state changes (e.g. after OAuth redirect)
        supabase.auth.onAuthStateChange((event, session) => {
            updateNavForUser(session?.user || null);
            if (event === 'SIGNED_IN') {
                enforceOnboarding(session?.user || null);
            }
        });
    }

    // --- Sign Up with Email ---

    async function signUpWithEmail(email, password, name, role) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, role }
            }
        });

        if (error) throw error;

        // Upsert profile row
        if (data.user) {
            await supabase.from('profiles').upsert({
                id: data.user.id,
                name,
                role
            });
        }

        return data;
    }

    // --- Sign In with Email ---

    async function signInWithEmail(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    }

    // --- Google OAuth ---

    async function signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/prisijungimas.html'
            }
        });
        if (error) throw error;
        return data;
    }

    // --- Password Reset ---

    async function resetPassword(email) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/prisijungimas.html'
        });
        if (error) throw error;
        return data;
    }

    // --- Sign Out ---

    async function signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    // --- Get Session ---

    async function getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    }

    // --- Expose API globally ---

    window.medijusAuth = {
        initAuth,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        resetPassword,
        signOut,
        getSession,
        updateNavForUser
    };

    // Auto-init on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }
})();
