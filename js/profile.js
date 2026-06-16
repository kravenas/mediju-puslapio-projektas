// =============================================
// Medijus Profile Page Module
// =============================================

(function () {
    'use strict';

    if (typeof supabase === 'undefined') {
        console.warn('profile.js: supabase client not found.');
        return;
    }

    // --- State ---
    let currentUser = null;
    let currentProfile = null;
    let creatorData = null;
    let creatorServices = [];
    let editingServiceId = null;
    let creatorPackages = { bazinis: null, standartinis: null, premium: null };

    function isCreatorRole(role) {
        return role === 'kurejas' || role === 'kūrėjas' || role === 'creator';
    }

    // --- Helpers ---

    function qs(sel, root) {
        return (root || document).querySelector(sel);
    }

    function qsa(sel, root) {
        return (root || document).querySelectorAll(sel);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('lt-LT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    function daysSince(dateStr) {
        if (!dateStr) return 0;
        const diff = Date.now() - new Date(dateStr).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    function showMessage(containerId, text, type) {
        const el = qs(containerId);
        if (!el) return;
        el.className = `mt-3 p-3 text-sm font-medium ${
            type === 'success'
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`;
        el.style.borderRadius = '4px';
        el.innerHTML = text;
        el.classList.remove('hidden');
        if (type !== 'success') setTimeout(() => el.classList.add('hidden'), 5000);
    }

    // --- Auth Guard ---

    async function requireAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'prisijungimas.html';
            return null;
        }
        return session.user;
    }

    // --- Data Loading ---

    async function loadProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Failed to load profile:', error);
        }
        return data || {};
    }

    async function loadCreatorData(userId) {
        const { data, error } = await supabase
            .from('creators')
            .select('*, reviews(*)')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Failed to load creator data:', error);
        }
        return data || null;
    }

    // --- Rendering ---

    function renderProfileHeader() {
        const user = currentUser;
        const profile = currentProfile;
        const name = profile.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Vartotojas';
        const email = user.email || '';
        const role = profile.role || user.user_metadata?.role || 'klientas';
        const roleLt = isCreatorRole(role) ? 'Kūrėjas' : 'Klientas';
        const initial = name.charAt(0).toUpperCase();
        const memberSince = formatDate(user.created_at);
        const avatarUrl = profile.avatar_url;

        // Header avatar
        const avatarEl = qs('#profile-avatar');
        if (avatarEl) {
            if (avatarUrl) {
                avatarEl.innerHTML = `<img src="${safeUrl(avatarUrl)}" alt="${escapeAttr(name)}" class="w-full h-full object-cover rounded-full">`;
            } else {
                avatarEl.innerHTML = `<span class="text-2xl font-bold text-white">${escapeHtml(initial)}</span>`;
            }
        }

        // Header info
        const nameEl = qs('#profile-name');
        if (nameEl) nameEl.textContent = name;

        const roleEl = qs('#profile-role-badge');
        if (roleEl) {
            roleEl.textContent = roleLt;
            if (isCreatorRole(role)) {
                roleEl.className = 'inline-block px-3 py-1 text-xs font-semibold bg-primary/10 text-primary rounded-full';
            } else {
                roleEl.className = 'inline-block px-3 py-1 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full';
            }
        }

        const emailEl = qs('#profile-email');
        if (emailEl) emailEl.textContent = email;

        const sinceEl = qs('#profile-since');
        if (sinceEl) sinceEl.textContent = `Narys nuo ${memberSince}`;

        // CTA button
        const ctaEl = qs('#profile-cta');
        if (ctaEl) {
            if (isCreatorRole(role)) {
                ctaEl.textContent = 'Redaguoti viešą profilį';
                ctaEl.href = '#';
            } else {
                ctaEl.textContent = 'Ieškoti kūrėjų';
                ctaEl.href = 'kurejai.html';
            }
        }
    }

    function renderProfileForm() {
        const profile = currentProfile;
        const user = currentUser;

        const fields = {
            'profile-form-name': profile.name || user.user_metadata?.name || '',
            'profile-form-bio': profile.bio || '',
            'profile-form-location': profile.location || '',
        };

        for (const [id, val] of Object.entries(fields)) {
            const el = qs(`#${id}`);
            if (el) el.value = val;
        }

        renderProfilePreview();
    }

    function renderProfilePreview() {
        const name = qs('#profile-form-name')?.value || 'Vardas';
        const bio = qs('#profile-form-bio')?.value || '';
        const location = qs('#profile-form-location')?.value || '';
        const initial = name.charAt(0).toUpperCase();
        const role = currentProfile?.role || currentUser?.user_metadata?.role || 'klientas';
        const roleLt = isCreatorRole(role) ? 'Kūrėjas' : 'Klientas';
        const avatarUrl = currentProfile?.avatar_url;

        const previewEl = qs('#profile-preview');
        if (!previewEl) return;

        previewEl.innerHTML = `
            <div class="text-center">
                <div class="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto mb-3 overflow-hidden">
                    ${avatarUrl
                        ? `<img src="${safeUrl(avatarUrl)}" alt="${escapeAttr(name)}" class="w-full h-full object-cover">`
                        : `<span class="text-2xl font-bold text-white">${escapeHtml(initial)}</span>`
                    }
                </div>
                <h4 class="font-semibold text-gray-900 dark:text-white">${escapeHtml(name)}</h4>
                <span class="inline-block px-2 py-0.5 text-xs font-medium mt-1 ${
                    isCreatorRole(role)
                        ? 'bg-primary/10 text-primary'
                        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                } rounded-full">${escapeHtml(roleLt)}</span>
                ${bio ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-3 line-clamp-3">${escapeHtml(bio)}</p>` : ''}
                ${location ? `
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        ${escapeHtml(location)}
                    </p>
                ` : ''}
            </div>
        `;
    }

    // --- Tabs ---

    function setupTabs() {
        const role = currentProfile?.role || currentUser?.user_metadata?.role || 'klientas';
        const isCreator = isCreatorRole(role);
        const tabs = qsa('[data-tab]');
        const panels = qsa('[data-panel]');

        // Show creator-only tabs
        const servicesTabBtn = qs('#services-tab-btn');
        if (servicesTabBtn && isCreator) {
            servicesTabBtn.classList.remove('hidden');
        }
        const skelbimasTabBtn = qs('#skelbimas-tab-btn');
        if (skelbimasTabBtn && isCreator) {
            skelbimasTabBtn.classList.remove('hidden');
        }
        const portfolioTabBtn = qs('#portfolio-tab-btn');
        if (portfolioTabBtn && isCreator) {
            portfolioTabBtn.classList.remove('hidden');
        }

        let servicesInitialized = false;
        let portfolioInitialized = false;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;

                tabs.forEach(t => {
                    t.classList.remove('text-primary', 'border-primary');
                    t.classList.add('text-gray-500', 'dark:text-gray-400', 'border-transparent');
                });
                tab.classList.remove('text-gray-500', 'dark:text-gray-400', 'border-transparent');
                tab.classList.add('text-primary', 'border-primary');

                panels.forEach(p => {
                    p.classList.toggle('hidden', p.dataset.panel !== target);
                });

                if (target === 'statistika') {
                    loadStats(role);
                }
                if (target === 'paslaugos' && !servicesInitialized) {
                    servicesInitialized = true;
                    setupPackagesTab();
                }
                if (target === 'skelbimas' && !skelbimasInitialized) {
                    skelbimasInitialized = true;
                    initSkelbimas();
                }
                if (target === 'uzsakymai') {
                    loadOrders(isCreator);
                }
                if (target === 'portfolio' && !portfolioInitialized) {
                    portfolioInitialized = true;
                    initPortfolio();
                } else if (target === 'portfolio') {
                    loadPortfolio();
                }
            });
        });

        // Show/hide role-specific stats
        const creatorStats = qs('#stats-creator');
        const clientStats = qs('#stats-client');
        if (isCreator) {
            if (creatorStats) creatorStats.classList.remove('hidden');
            if (clientStats) clientStats.classList.add('hidden');
        } else {
            if (creatorStats) creatorStats.classList.add('hidden');
            if (clientStats) clientStats.classList.remove('hidden');
        }
    }

    // --- Orders (escrow flow) ---

    const STATUS_LABEL = {
        pending_payment: { label: 'Laukia mokėjimo', cls: 'bg-gray-100 text-gray-700' },
        pending_acceptance: { label: 'Laukia patvirtinimo', cls: 'bg-amber-100 text-amber-700' },
        declined: { label: 'Atmesta — grąžinta', cls: 'bg-purple-100 text-purple-700' },
        paid: { label: 'Vykdoma', cls: 'bg-blue-100 text-blue-700' },
        delivered: { label: 'Pristatyta', cls: 'bg-amber-100 text-amber-700' },
        approved: { label: 'Patvirtinta', cls: 'bg-green-100 text-green-700' },
        rejected: { label: 'Atmesta', cls: 'bg-orange-100 text-orange-700' },
        disputed: { label: 'Ginčas', cls: 'bg-red-100 text-red-700' },
        refunded: { label: 'Grąžinta klientui', cls: 'bg-purple-100 text-purple-700' },
        released: { label: 'Atiduota kūrėjui', cls: 'bg-green-100 text-green-700' },
    };

    function escHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
    }

    function daysLeft(deadlineIso) {
        if (!deadlineIso) return 0;
        const ms = new Date(deadlineIso).getTime() - Date.now();
        return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    // Set the "Užsakymai" tab badge on page load, without waiting for the user
    // to open the tab. Mirrors the nav avatar badge (auth.js) so the two agree:
    // creator → orders awaiting delivery (paid); client → delivered awaiting approval.
    async function updateOrdersTabBadge(isCreator) {
        const badge = qs('#orders-badge');
        if (!badge) return;
        try {
            let count = 0;
            if (isCreator) {
                const creatorId = creatorData?.id;
                if (!creatorId) return;
                const { count: c } = await supabase.from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('creator_id', creatorId).in('status', ['pending_acceptance', 'paid']);
                count = c || 0;
            } else {
                const { count: c } = await supabase.from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', currentUser.id).eq('status', 'delivered');
                count = c || 0;
            }
            badge.textContent = String(count);
            badge.classList.toggle('hidden', count === 0);
        } catch (_) { /* orders table/column missing — keep badge hidden */ }
    }

    async function loadOrders(isCreator) {
        const container = qs('#orders-panel-content');
        if (!container) return;
        container.innerHTML = '<p class="text-sm text-gray-400">Kraunama...</p>';

        let query;
        if (isCreator) {
            const creatorId = creatorData?.id;
            if (!creatorId) {
                container.innerHTML = '<p class="text-sm text-gray-400">Pirmiausia užpildykite kūrėjo profilį.</p>';
                return;
            }
            query = supabase.from('orders').select('*').eq('creator_id', creatorId);
        } else {
            query = supabase.from('orders').select('*, creators(id, name)').eq('user_id', currentUser.id);
        }

        const { data: orders, error } = await query.order('created_at', { ascending: false });
        if (error) {
            container.innerHTML = `<p class="text-sm text-red-500">Klaida: ${escHtml(error.message)}</p>`;
            return;
        }

        // For clients: fetch which orders already have a review (so we can hide the button)
        let reviewedOrderIds = new Set();
        if (!isCreator && orders?.length) {
            const orderIds = orders.map(o => o.id);
            const { data: existingReviews } = await supabase
                .from('reviews')
                .select('order_id')
                .in('order_id', orderIds);
            reviewedOrderIds = new Set((existingReviews || []).map(r => r.order_id));
        }
        // Stash on a variable accessible by renderOrderCard
        window.__medijusReviewedOrderIds = reviewedOrderIds;

        const visible = (orders || []).filter(o => o.status !== 'pending_payment');

        // Escrow summary (orders not yet settled — money is held by the platform)
        const ESCROW_STATUSES = ['pending_acceptance', 'paid', 'delivered', 'rejected', 'disputed'];
        const escrow = visible.filter(o => ESCROW_STATUSES.includes(o.status));

        // Orders awaiting the current user's action.
        // Creator: accept new orders (pending_acceptance) or deliver started ones (paid).
        // Client: approve delivered work.
        const needsAction = (o) => isCreator
            ? (o.status === 'pending_acceptance' || o.status === 'paid')
            : o.status === 'delivered';
        const actionCount = visible.filter(needsAction).length;
        const escrowCents = escrow.reduce((sum, o) => {
            if (isCreator) {
                return sum + ((o.amount_cents || 0) - (o.platform_fee_cents || 0));
            }
            return sum + (o.amount_cents || 0);
        }, 0);
        const escrowEur = (escrowCents / 100).toFixed(2);

        const summaryHtml = `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4" style="border-radius:8px;">
                    <p class="text-xs text-amber-700 dark:text-amber-300">${isCreator ? 'Užšaldyta (kol darbas patvirtintas)' : 'Tavo mokėjimai escrow\'e'}</p>
                    <p class="text-2xl font-bold text-amber-800 dark:text-amber-200 mt-1">€${escrowEur}</p>
                    <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">${escrow.length} užsakym${escrow.length === 1 ? 'as' : 'ai'}</p>
                </div>
                <div class="bg-gray-50 dark:bg-gray-900 border border-secondary dark:border-gray-700 p-4" style="border-radius:8px;">
                    <p class="text-xs text-gray-500 dark:text-gray-400">${isCreator ? 'Laukia tavo veiksmų' : 'Laukia tavo patvirtinimo'}</p>
                    <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">${actionCount}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">užsakym${actionCount === 1 ? 'as' : 'ai'}</p>
                </div>
                <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4" style="border-radius:8px;">
                    <p class="text-xs text-green-700 dark:text-green-300">${isCreator ? 'Sėkmingai gauta' : 'Užbaigti užsakymai'}</p>
                    <p class="text-2xl font-bold text-green-800 dark:text-green-200 mt-1">€${(
                        visible.filter(o => o.status === 'approved' || o.status === 'released')
                            .reduce((s, o) => s + (isCreator ? (o.amount_cents || 0) - (o.platform_fee_cents || 0) : (o.amount_cents || 0)), 0) / 100
                    ).toFixed(2)}</p>
                    <p class="text-xs text-green-600 dark:text-green-400 mt-1">${
                        visible.filter(o => o.status === 'approved' || o.status === 'released').length
                    } užsakym${visible.filter(o => o.status === 'approved' || o.status === 'released').length === 1 ? 'as' : 'ai'}</p>
                </div>
            </div>
        `;

        if (visible.length === 0) {
            container.innerHTML = `<div class="bg-gray-50 dark:bg-gray-900 border border-secondary dark:border-gray-700 p-8 text-center" style="border-radius:8px;">
                <p class="text-sm text-gray-500 dark:text-gray-400">${isCreator ? 'Užsakymų dar nėra.' : 'Neturite užsakymų.'}</p>
            </div>`;
            return;
        }

        // Badge — count orders needing action (computed above as actionCount)
        const badge = qs('#orders-badge');
        if (badge) {
            badge.textContent = String(actionCount);
            badge.classList.toggle('hidden', actionCount === 0);
        }

        container.innerHTML = summaryHtml + visible.map(o => renderOrderCard(o, isCreator)).join('');
        attachOrderActionListeners(isCreator);
    }

    function renderOrderCard(o, isCreator) {
        const meta = STATUS_LABEL[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-700' };
        const amount = (o.amount_cents != null) ? (o.amount_cents / 100).toFixed(2) : Number(o.amount || 0).toFixed(2);
        const partyLabel = isCreator ? 'Klientas' : 'Kūrėjas';
        const partyName = isCreator ? '(užsakovas)' : escHtml(o.creators?.name || '—');

        let action = '';
        if (isCreator && o.status === 'pending_acceptance') {
            action = `
                <div class="flex flex-col sm:flex-row gap-2">
                    <button data-action="accept" data-order-id="${escHtml(o.id)}" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">✓ Priimti užsakymą</button>
                    <button data-action="decline" data-order-id="${escHtml(o.id)}" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">Atmesti</button>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Priėmus — pradedamas skaičiuoti pristatymo terminas pagal tavo paketą. Atmetus — pinigai grąžinami klientui.</p>
            `;
        } else if (!isCreator && o.status === 'pending_acceptance') {
            action = `<p class="text-sm text-gray-500 dark:text-gray-400">⏳ Laukiama, kol kūrėjas patvirtins užsakymą. Jei nepatvirtins per 3 d., pinigai bus grąžinti automatiškai.</p>`;
        } else if (isCreator && o.status === 'paid') {
            action = `
                <button data-action="deliver-toggle" data-order-id="${escHtml(o.id)}" class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">Pristatyti darbą</button>
                <div data-deliver-form="${escHtml(o.id)}" class="hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800 border border-secondary dark:border-gray-700" style="border-radius:6px;">
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pristatymo nuoroda <span class="text-red-500">*</span></label>
                    <input data-deliver-url="${escHtml(o.id)}" type="url" placeholder="https://wetransfer.com/... arba Google Drive nuoroda" class="w-full h-10 px-3 bg-white dark:bg-gray-900 border border-secondary dark:border-gray-600 text-gray-900 dark:text-white text-sm" style="border-radius:4px;">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 Naudok nuorodą, galiojančią bent kol klientas patvirtins. Google Drive/Dropbox saugiausia (WeTransfer nemokama ~7 d.).</p>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mt-3 mb-1">Žinutė klientui (neprivaloma)</label>
                    <textarea data-deliver-note="${escHtml(o.id)}" rows="2" placeholder="Kas viduje, slaptažodis transferui, instrukcijos..." class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-secondary dark:border-gray-600 text-gray-900 dark:text-white text-sm" style="border-radius:4px;"></textarea>
                    <button data-action="deliver-submit" data-order-id="${escHtml(o.id)}" class="mt-3 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">Išsiųsti klientui →</button>
                </div>
            `;
        } else if (!isCreator && o.status === 'delivered') {
            const left = daysLeft(o.approval_deadline);
            action = `
                <div class="flex flex-col sm:flex-row gap-2">
                    <button data-action="approve" data-order-id="${escHtml(o.id)}" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">✓ Patvirtinu</button>
                    <button data-action="reject" data-order-id="${escHtml(o.id)}" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">Atmesti</button>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Liko ${left}d. auto-patvirtinimui</p>
            `;
        } else if (!isCreator && o.status === 'rejected') {
            const left = daysLeft(o.resolution_deadline);
            action = `
                <div class="flex flex-col sm:flex-row gap-2">
                    <button data-action="approve" data-order-id="${escHtml(o.id)}" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">✓ Vis dėlto patvirtinti</button>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Liko ${left}d. iki eskalavimo admin'ui</p>
            `;
        } else if (!isCreator && (o.status === 'approved' || o.status === 'released')) {
            const reviewed = window.__medijusReviewedOrderIds?.has(o.id);
            if (!reviewed) {
                action = `<button onclick="openReviewForOrder('${escHtml(o.id)}', '${escHtml(o.creator_id)}', '${escHtml(o.creators?.name || '')}')" class="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 text-sm font-semibold cursor-pointer flex items-center gap-1.5" style="border-radius:4px;">⭐ Palikti atsiliepimą</button>`;
            } else {
                action = '<p class="text-xs text-gray-400">✓ Atsiliepimas paliktas</p>';
            }
        }

        const rejectInfo = o.status === 'rejected' && o.rejection_reason ? `
            <div class="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-sm" style="border-radius:6px;">
                <strong class="text-orange-700 dark:text-orange-400">Atmetimo priežastis:</strong>
                <p class="text-gray-700 dark:text-gray-300 mt-1">${escHtml(o.rejection_reason)}</p>
            </div>` : '';

        const deliveryInfo = o.delivery_url ? `
            <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm" style="border-radius:6px;">
                <strong class="text-blue-700 dark:text-blue-400">${isCreator ? 'Tavo pristatytas darbas:' : 'Kūrėjo pristatytas darbas:'}</strong>
                ${o.delivery_note ? `<p class="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-line">${escHtml(o.delivery_note)}</p>` : ''}
                <a href="${escHtml(o.delivery_url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold" style="border-radius:4px;">⬇ Atsisiųsti darbą</a>
            </div>` : '';

        // Delivery deadline — shown while the work is in progress (status 'paid').
        // Creator can adjust it per order (hybrid model); client sees it read-only.
        let deadlineInfo = '';
        if (o.status === 'paid' && o.delivery_deadline) {
            const d = new Date(o.delivery_deadline);
            const dateStr = d.toLocaleDateString('lt-LT');
            const dLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
            const overdue = dLeft < 0;
            const statusTxt = overdue
                ? `<span class="text-red-600 dark:text-red-400 font-semibold">vėluojama ${Math.abs(dLeft)} d.</span>`
                : `liko <strong>${dLeft} d.</strong>`;
            const who = isCreator ? 'Pristatyti iki' : 'Kūrėjas pristatys iki';
            const adjust = isCreator ? `
                <div class="mt-2">
                    <button data-action="deadline-toggle" data-order-id="${escHtml(o.id)}" class="text-xs text-primary hover:underline cursor-pointer">Keisti terminą</button>
                    <div data-deadline-form="${escHtml(o.id)}" class="hidden mt-2 flex items-center gap-2 flex-wrap">
                        <input data-deadline-input="${escHtml(o.id)}" type="date" class="h-9 px-2 bg-white dark:bg-gray-900 border border-secondary dark:border-gray-600 text-sm text-gray-900 dark:text-white" style="border-radius:4px;">
                        <button data-action="deadline-save" data-order-id="${escHtml(o.id)}" class="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold cursor-pointer" style="border-radius:4px;">Išsaugoti</button>
                    </div>
                </div>` : '';
            deadlineInfo = `
                <div class="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm" style="border-radius:6px;">
                    <span class="text-amber-800 dark:text-amber-300">📅 ${who}: <strong>${dateStr}</strong> — ${statusTxt}</span>
                    ${adjust}
                </div>`;
        } else if (o.status === 'pending_acceptance' && o.acceptance_deadline) {
            const d = new Date(o.acceptance_deadline);
            const dateStr = d.toLocaleDateString('lt-LT');
            const dLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
            const txt = dLeft < 0 ? '<span class="text-red-600 dark:text-red-400 font-semibold">terminas baigėsi</span>' : `liko <strong>${dLeft} d.</strong>`;
            const who = isCreator ? '⏳ Priimti/atmesti iki' : '⏳ Kūrėjas turi patvirtinti iki';
            deadlineInfo = `
                <div class="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm" style="border-radius:6px;">
                    <span class="text-amber-800 dark:text-amber-300">${who}: <strong>${dateStr}</strong> — ${txt}</span>
                </div>`;
        }

        return `
            <div class="bg-white dark:bg-gray-900 border border-secondary dark:border-gray-700 p-4 mb-3" style="border-radius:8px;">
                <div class="flex items-start justify-between gap-3 mb-2">
                    <div>
                        <h4 class="font-bold text-gray-900 dark:text-white">${escHtml(o.service_name || 'Paslauga')}</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${partyLabel}: ${partyName} • €${amount} • ${formatDate(o.created_at)}</p>
                    </div>
                    <span class="px-2 py-1 text-[11px] font-semibold ${meta.cls} dark:bg-opacity-20" style="border-radius:4px;">${meta.label}</span>
                </div>
                ${rejectInfo}
                ${deadlineInfo}
                ${deliveryInfo}
                <div class="mt-3">${action}</div>
            </div>
        `;
    }

    function attachOrderActionListeners(isCreator) {
        qsa('[data-action="deliver-toggle"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const form = qs(`[data-deliver-form="${btn.dataset.orderId}"]`);
                if (form) form.classList.toggle('hidden');
            });
        });
        qsa('[data-action="deliver-submit"]').forEach(btn => {
            btn.addEventListener('click', () => handleOrderAction('deliver', btn.dataset.orderId, btn, isCreator));
        });
        qsa('[data-action="approve"]').forEach(btn => {
            btn.addEventListener('click', () => handleOrderAction('approve', btn.dataset.orderId, btn, isCreator));
        });
        qsa('[data-action="reject"]').forEach(btn => {
            btn.addEventListener('click', () => handleOrderAction('reject', btn.dataset.orderId, btn, isCreator));
        });
        qsa('[data-action="accept"]').forEach(btn => {
            btn.addEventListener('click', () => handleOrderAction('accept', btn.dataset.orderId, btn, isCreator));
        });
        qsa('[data-action="decline"]').forEach(btn => {
            btn.addEventListener('click', () => handleOrderAction('decline', btn.dataset.orderId, btn, isCreator));
        });
        // Hybrid deadline: creator adjusts the delivery date for a specific order.
        qsa('[data-action="deadline-toggle"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const form = qs(`[data-deadline-form="${btn.dataset.orderId}"]`);
                if (form) form.classList.toggle('hidden');
            });
        });
        qsa('[data-action="deadline-save"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.orderId;
                const val = qs(`[data-deadline-input="${id}"]`)?.value;
                if (!val) { alert('Pasirink datą.'); return; }
                const iso = new Date(val + 'T23:59:59').toISOString();
                btn.disabled = true;
                const { error } = await supabase.rpc('set_delivery_deadline', { p_order_id: id, p_deadline: iso });
                btn.disabled = false;
                if (error) { alert('Klaida: ' + error.message); return; }
                loadOrders(isCreator);
            });
        });
    }

    async function handleOrderAction(action, orderId, btn, isCreator) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('Sesija pasibaigė. Prisijunkite iš naujo.');
            return;
        }

        let endpoint, body;
        if (action === 'deliver') {
            const url = (qs(`[data-deliver-url="${orderId}"]`)?.value || '').trim();
            const note = (qs(`[data-deliver-note="${orderId}"]`)?.value || '').trim();
            if (!/^https?:\/\/.+/i.test(url)) {
                alert('Įvesk teisingą pristatymo nuorodą (turi prasidėti http:// arba https://).');
                return;
            }
            endpoint = 'order-mark-delivered';
            body = { order_id: orderId, delivery_url: url, delivery_note: note || null };
        } else if (action === 'approve') {
            if (!confirm('Patvirtinti darbą? Kūrėjui bus pervedami pinigai.')) return;
            endpoint = 'order-approve';
            body = { order_id: orderId };
        } else if (action === 'reject') {
            const reason = prompt('Kodėl atmetate darbą? (min 10 simbolių, bus matomas kūrėjui)');
            if (!reason || reason.trim().length < 10) {
                alert('Priežastis privaloma (min 10 simbolių).');
                return;
            }
            endpoint = 'order-reject';
            body = { order_id: orderId, reason };
        } else if (action === 'accept') {
            if (!confirm('Priimti užsakymą? Pradedamas skaičiuoti pristatymo terminas pagal tavo paketą.')) return;
            endpoint = 'order-accept';
            body = { order_id: orderId };
        } else if (action === 'decline') {
            const reason = prompt('Kodėl atmetate užsakymą? (neprivaloma, bus matoma klientui)\nKlientui bus grąžinti pinigai.');
            if (reason === null) return; // cancelled
            endpoint = 'order-decline';
            body = { order_id: orderId, reason: reason.trim() || null };
        } else {
            return;
        }

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Vykdoma...';

        try {
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            });
            const result = await resp.json();
            if (!resp.ok || result.error) throw new Error(result.error || 'Klaida');

            // After client approves: prompt for review (highest conversion moment)
            if (action === 'approve' && !isCreator) {
                const order = (await supabase.from('orders').select('creator_id, creators(id, name)').eq('id', orderId).single()).data;
                if (order?.creator_id) {
                    showReviewModal(orderId, order.creator_id, order.creators?.name || 'kūrėjas');
                }
            }
            await loadOrders(isCreator);
        } catch (err) {
            alert('Klaida: ' + err.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    // --- Reviews ---

    function firstNameOnly(fullName) {
        if (!fullName) return 'Vartotojas';
        // Take only first word — strip surname
        return String(fullName).trim().split(/\s+/)[0];
    }

    let reviewModalWired = false;
    function ensureReviewModal() {
        if (qs('#review-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'review-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/60 hidden items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-900 max-w-md w-full p-6" style="border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.2);">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1">Įvertink kūrėją</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Pasidalink patirtimi su <span id="review-creator-name" class="font-semibold text-gray-900 dark:text-white"></span></p>
                <div class="flex justify-center gap-1 mb-4" id="review-stars">
                    ${[1,2,3,4,5].map(n => `<button data-rating="${n}" class="review-star text-4xl text-gray-300 hover:text-primary transition-colors cursor-pointer">★</button>`).join('')}
                </div>
                <textarea id="review-content" placeholder="Trumpas atsiliepimas (neprivaloma, max 500 simb.)" maxlength="500" rows="4" class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-secondary dark:border-gray-700 text-gray-900 dark:text-white text-sm focus-ring mb-4 resize-none" style="border-radius:6px;"></textarea>
                <p id="review-msg" class="text-xs text-red-500 hidden mb-3"></p>
                <div class="flex gap-2 justify-end">
                    <button id="review-skip" class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Praleisti</button>
                    <button id="review-submit" class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold cursor-pointer" style="border-radius:6px;">Pateikti</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function showReviewModal(orderId, creatorId, creatorName) {
        ensureReviewModal();
        const modal = qs('#review-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        qs('#review-creator-name').textContent = creatorName;
        qs('#review-content').value = '';
        qs('#review-msg').classList.add('hidden');
        let rating = 0;
        qsa('.review-star').forEach(s => s.classList.remove('text-primary'));
        qsa('.review-star').forEach(s => s.classList.add('text-gray-300'));

        qsa('.review-star').forEach(star => {
            star.onclick = () => {
                rating = parseInt(star.dataset.rating);
                qsa('.review-star').forEach(s => {
                    const r = parseInt(s.dataset.rating);
                    s.classList.toggle('text-primary', r <= rating);
                    s.classList.toggle('text-gray-300', r > rating);
                });
            };
        });

        qs('#review-skip').onclick = async () => {
            // Client declined to rate → record an automatic 5★ review from "Medijus".
            modal.classList.add('hidden');
            await supabase.from('reviews').insert({
                creator_id: creatorId,
                order_id: orderId,
                reviewer_user_id: currentUser.id,
                author_name: 'Medijus',
                author_location: null,
                rating: 5,
                content: 'Automatinis įvertinimas — užsakymas sėkmingai įvykdytas.',
            });
        };

        qs('#review-submit').onclick = async () => {
            const msg = qs('#review-msg');
            msg.classList.add('hidden');
            if (rating < 1) {
                msg.textContent = 'Pasirink bent 1 žvaigždutę.';
                msg.classList.remove('hidden');
                return;
            }
            const content = qs('#review-content').value.trim().slice(0, 500);
            const authorName = firstNameOnly(currentProfile?.name || currentUser?.user_metadata?.name || currentUser?.email);

            const { error } = await supabase.from('reviews').insert({
                creator_id: creatorId,
                order_id: orderId,
                reviewer_user_id: currentUser.id,
                author_name: authorName,
                author_location: currentProfile?.location || null,
                rating,
                content: content || null,
            });
            if (error) {
                msg.textContent = 'Klaida: ' + error.message;
                msg.classList.remove('hidden');
                return;
            }
            modal.classList.add('hidden');
        };
    }

    async function openReviewForOrder(orderId, creatorId, creatorName) {
        showReviewModal(orderId, creatorId, creatorName);
    }
    window.openReviewForOrder = openReviewForOrder;

    // --- Portfolio ---

    const BLOCKED_PORTFOLIO_DOMAINS = [
        'instagram.com', 'instagr.am',
        'youtube.com', 'youtu.be',
        'tiktok.com',
        'facebook.com', 'fb.com', 'fb.me',
        'twitter.com', 'x.com', 't.co',
        'snapchat.com', 'pinterest.com',
        'wa.me', 'whatsapp.com',
        'mailto:', 'tel:',
        't.me', 'telegram.org',
    ];

    function validateExternalPortfolioUrl(raw) {
        if (!raw) return { ok: false, error: 'Įveskite URL' };
        let u;
        try {
            u = new URL(raw);
        } catch {
            return { ok: false, error: 'Neteisingas URL formatas (turi prasidėti https://)' };
        }
        if (!['http:', 'https:'].includes(u.protocol)) {
            return { ok: false, error: 'Tinka tik http/https nuorodos' };
        }
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        const blocked = BLOCKED_PORTFOLIO_DOMAINS.find(d => host === d || host.endsWith('.' + d));
        if (blocked) {
            return { ok: false, error: `Domain'as "${host}" neleidžiamas. Naudok Vimeo, Loom, Behance, Frame.io ar Google Drive.` };
        }
        return { ok: true, url: u.toString() };
    }

    function renderExtPortfolioStatus() {
        const badge = qs('#ext-portfolio-status');
        const input = qs('#ext-portfolio-url');
        if (!badge || !input || !creatorData) return;

        const url = creatorData.external_portfolio_url || '';
        const status = creatorData.external_portfolio_status || 'none';
        input.value = url;

        const cfg = {
            none: { label: 'Nepateikta', cls: 'bg-gray-100 text-gray-600' },
            pending: { label: 'Laukia admin patvirtinimo', cls: 'bg-yellow-100 text-yellow-700' },
            approved: { label: '✓ Patvirtinta — matoma viešai', cls: 'bg-green-100 text-green-700' },
            rejected: { label: '✗ Atmesta admin', cls: 'bg-red-100 text-red-700' },
        }[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };

        badge.textContent = cfg.label;
        badge.className = `ml-2 text-[10px] font-bold px-2 py-0.5 ${cfg.cls}`;
        badge.style.borderRadius = '4px';
        badge.classList.remove('hidden');

        if (status === 'rejected' && creatorData.external_portfolio_admin_note) {
            const msg = qs('#ext-portfolio-msg');
            if (msg) {
                msg.classList.remove('hidden');
                msg.className = 'text-xs mt-2 text-red-600';
                msg.textContent = 'Admin pastaba: ' + creatorData.external_portfolio_admin_note;
            }
        }
    }

    async function saveExternalPortfolioUrl() {
        const input = qs('#ext-portfolio-url');
        const msg = qs('#ext-portfolio-msg');
        const btn = qs('#ext-portfolio-save-btn');
        if (!input || !creatorData?.id) return;

        const raw = input.value.trim();

        if (!raw) {
            // Clear existing URL
            const { error } = await supabase.from('creators').update({
                external_portfolio_url: null,
                external_portfolio_status: 'none',
                external_portfolio_submitted_at: null,
                external_portfolio_reviewed_at: null,
                external_portfolio_admin_note: null,
            }).eq('id', creatorData.id);
            if (error) { if (msg) { msg.classList.remove('hidden'); msg.className = 'text-xs mt-2 text-red-600'; msg.textContent = 'Klaida: ' + error.message; } return; }
            creatorData.external_portfolio_url = null;
            creatorData.external_portfolio_status = 'none';
            renderExtPortfolioStatus();
            if (msg) { msg.classList.remove('hidden'); msg.className = 'text-xs mt-2 text-green-600'; msg.textContent = 'Nuoroda pašalinta.'; }
            return;
        }

        const v = validateExternalPortfolioUrl(raw);
        if (!v.ok) {
            if (msg) { msg.classList.remove('hidden'); msg.className = 'text-xs mt-2 text-red-600'; msg.textContent = v.error; }
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Saugoma...'; }
        const { error } = await supabase.from('creators').update({
            external_portfolio_url: v.url,
            external_portfolio_status: 'pending',
            external_portfolio_submitted_at: new Date().toISOString(),
            external_portfolio_reviewed_at: null,
            external_portfolio_admin_note: null,
        }).eq('id', creatorData.id);
        if (btn) { btn.disabled = false; btn.textContent = 'Išsaugoti'; }

        if (error) {
            if (msg) { msg.classList.remove('hidden'); msg.className = 'text-xs mt-2 text-red-600'; msg.textContent = 'Klaida: ' + error.message; }
            return;
        }
        creatorData.external_portfolio_url = v.url;
        creatorData.external_portfolio_status = 'pending';
        renderExtPortfolioStatus();
        if (msg) { msg.classList.remove('hidden'); msg.className = 'text-xs mt-2 text-green-600'; msg.textContent = 'Nuoroda išsaugota ir laukia admin patvirtinimo.'; }
    }

    function initPortfolio() {
        const dropzone = qs('#portfolio-dropzone');
        const fileInput = qs('#portfolio-file-input');
        if (!dropzone || !fileInput) return;

        // Guard: the file input sits inside the dropzone, so fileInput.click()
        // dispatches a click that bubbles back here — without this check it would
        // loop infinitely and spawn endless file dialogs (freezing the page).
        dropzone.addEventListener('click', (e) => { if (e.target !== fileInput) fileInput.click(); });
        fileInput.addEventListener('change', (e) => handlePortfolioFiles(e.target.files));

        // External portfolio link section
        const extSaveBtn = qs('#ext-portfolio-save-btn');
        if (extSaveBtn) extSaveBtn.addEventListener('click', saveExternalPortfolioUrl);
        renderExtPortfolioStatus();

        ['dragenter', 'dragover'].forEach(ev => {
            dropzone.addEventListener(ev, (e) => {
                e.preventDefault();
                dropzone.classList.add('border-primary', 'bg-primary/5');
            });
        });
        ['dragleave', 'drop'].forEach(ev => {
            dropzone.addEventListener(ev, (e) => {
                e.preventDefault();
                dropzone.classList.remove('border-primary', 'bg-primary/5');
            });
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer?.files?.length) handlePortfolioFiles(e.dataTransfer.files);
        });

        loadPortfolio();
    }

    async function loadPortfolio() {
        const grid = qs('#portfolio-grid');
        const countEl = qs('#portfolio-count');
        if (!grid || !creatorData?.id) return;

        grid.innerHTML = '<p class="text-sm text-gray-400 col-span-full text-center py-6">Kraunama...</p>';

        const { data: items, error } = await supabase
            .from('portfolio_items')
            .select('*')
            .eq('creator_id', creatorData.id)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) {
            grid.innerHTML = `<p class="text-sm text-red-500 col-span-full">Klaida: ${escHtml(error.message)}</p>`;
            return;
        }

        if (countEl) {
            countEl.textContent = `${items?.length || 0} darb${items?.length === 1 ? 'as' : 'ai'}`;
        }

        if (!items?.length) {
            grid.innerHTML = `<div class="col-span-full text-center py-10 text-sm text-gray-400">Dar nėra įkeltų darbų. Pradėk virš.</div>`;
            return;
        }

        grid.innerHTML = items.map(item => `
            <div class="relative group bg-gray-100 dark:bg-gray-800 overflow-hidden" style="border-radius:8px; aspect-ratio:1;">
                <img src="${escHtml(item.image_url)}" alt="${escHtml(item.title || '')}" class="w-full h-full object-cover" loading="lazy">
                <button data-delete-portfolio="${escHtml(item.id)}" data-storage-path="${escHtml(item.storage_path || '')}"
                    class="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    style="border-radius:50%;" title="Ištrinti">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                ${item.title ? `<div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-white text-xs">${escHtml(item.title)}</div>` : ''}
            </div>
        `).join('');

        grid.querySelectorAll('[data-delete-portfolio]').forEach(btn => {
            btn.addEventListener('click', () => deletePortfolioItem(btn.dataset.deletePortfolio, btn.dataset.storagePath));
        });
    }

    async function handlePortfolioFiles(fileList) {
        const msg = qs('#portfolio-msg');
        if (!creatorData?.id || !currentUser?.id) return;

        const files = Array.from(fileList);
        if (!files.length) return;

        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        const valid = files.filter(f => allowed.includes(f.type) && f.size <= 10 * 1024 * 1024);
        const skipped = files.length - valid.length;

        if (msg) {
            msg.classList.remove('hidden', 'text-red-500', 'text-green-600');
            msg.classList.add('text-gray-600');
            msg.textContent = `Įkeliama ${valid.length} failų${skipped ? ` (${skipped} praleisti — netinkamas formatas/dydis)` : ''}...`;
        }

        let uploaded = 0, failed = 0, lastError = null;
        const baseOrder = Date.now();

        for (let i = 0; i < valid.length; i++) {
            const file = valid[i];
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `${currentUser.id}/${baseOrder}_${i}.${ext}`;

            const { error: upErr } = await supabase.storage
                .from('portfolios')
                .upload(path, file, { cacheControl: '3600', upsert: false });

            if (upErr) { failed++; continue; }

            const { data: urlData } = supabase.storage.from('portfolios').getPublicUrl(path);
            const publicUrl = urlData?.publicUrl;
            if (!publicUrl) { failed++; continue; }

            const { error: insErr } = await supabase.from('portfolio_items').insert({
                creator_id: creatorData.id,
                image_url: publicUrl,
                storage_path: path,
                display_order: baseOrder + i,
            });

            if (insErr) {
                console.error('portfolio insert failed', insErr);
                lastError = insErr.message;
                await supabase.storage.from('portfolios').remove([path]).catch(() => { });
                failed++;
            } else {
                uploaded++;
            }
        }

        if (msg) {
            if (failed === 0) {
                msg.className = 'text-sm text-green-600 mb-4';
                msg.textContent = `Įkelta sėkmingai: ${uploaded} darb${uploaded === 1 ? 'as' : 'ai'}. ✓`;
            } else {
                msg.className = 'text-sm text-amber-600 mb-4';
                msg.textContent = `Įkelta ${uploaded}, nepavyko ${failed}${lastError ? ': ' + lastError : ''}.`;
            }
        }

        await loadPortfolio();
    }

    async function deletePortfolioItem(itemId, storagePath) {
        if (!confirm('Ištrinti šį darbą iš portfolio?')) return;
        const { error: delErr } = await supabase.from('portfolio_items').delete().eq('id', itemId);
        if (delErr) { alert('Klaida: ' + delErr.message); return; }
        if (storagePath) {
            await supabase.storage.from('portfolios').remove([storagePath]).catch(() => { });
        }
        await loadPortfolio();
    }

    // --- Avatar Upload ---

    function setupAvatarUpload() {
        const avatarBtn = qs('#profile-avatar');
        const fileInput = qs('#avatar-file-input');
        if (!avatarBtn || !fileInput) return;

        avatarBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
            const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (!allowedTypes.includes(file.type) || !allowedExts.includes(ext)) {
                showMessage('#profile-msg', 'Leidžiami formatai: PNG, JPG, WEBP, GIF.', 'error');
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                showMessage('#profile-msg', 'Failas per didelis. Maksimalus dydis: 2MB.', 'error');
                return;
            }

            avatarBtn.style.opacity = '0.5';
            try {
                const url = await uploadAvatar(file);
                if (url) {
                    currentProfile.avatar_url = url;
                    renderProfileHeader();
                    renderProfilePreview();
                    showMessage('#profile-msg', 'Nuotrauka atnaujinta!', 'success');
                }
            } catch (err) {
                showMessage('#profile-msg', 'Nepavyko įkelti nuotraukos: ' + err.message, 'error');
            } finally {
                avatarBtn.style.opacity = '1';
                fileInput.value = '';
            }
        });
    }

    async function uploadAvatar(file) {
        const userId = currentUser.id;
        const rawExt = (file.name.split('.').pop() || '').toLowerCase();
        const ext = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(rawExt) ? rawExt : 'png';
        const filePath = `${userId}/avatar.${ext}`;

        // Remove old avatar if exists
        await supabase.storage.from('avatars').remove([filePath]);

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Add cache-buster
        const url = publicUrl + '?t=' + Date.now();

        // Save to profile
        await supabase.from('profiles').upsert({
            id: userId,
            avatar_url: url
        });

        // Update auth metadata
        await supabase.auth.updateUser({
            data: { avatar_url: url }
        });

        return url;
    }

    // --- Save Profile ---

    async function saveProfile() {
        const btn = qs('#save-profile-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Saugoma...';
        }

        try {
            const name = qs('#profile-form-name')?.value?.trim();
            if (!name) {
                showMessage('#profile-msg', 'Vardas yra privalomas.', 'error');
                return;
            }

            const updates = {
                id: currentUser.id,
                name,
                bio: qs('#profile-form-bio')?.value?.trim() || null,
                location: qs('#profile-form-location')?.value?.trim() || null,
            };

            const { error } = await supabase.from('profiles').upsert(updates);
            if (error) throw error;

            // Update auth metadata name
            await supabase.auth.updateUser({ data: { name } });

            currentProfile = { ...currentProfile, ...updates };
            renderProfileHeader();
            showMessage('#profile-msg', 'Profilis sėkmingai atnaujintas!', 'success');
        } catch (err) {
            showMessage('#profile-msg', 'Klaida: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Išsaugoti pakeitimus';
            }
        }
    }

    // --- Password Change ---

    async function changePassword() {
        const newPw = qs('#new-password')?.value;
        const confirmPw = qs('#confirm-password')?.value;

        if (!newPw || newPw.length < 6) {
            showMessage('#settings-msg', 'Slaptažodis turi būti bent 6 simbolių.', 'error');
            return;
        }
        if (newPw !== confirmPw) {
            showMessage('#settings-msg', 'Slaptažodžiai nesutampa.', 'error');
            return;
        }

        const btn = qs('#change-password-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Keičiama...';
        }

        try {
            const { error } = await supabase.auth.updateUser({ password: newPw });
            if (error) throw error;

            qs('#new-password').value = '';
            qs('#confirm-password').value = '';
            showMessage('#settings-msg', 'Slaptažodis sėkmingai pakeistas!', 'success');
        } catch (err) {
            showMessage('#settings-msg', 'Klaida: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Pakeisti slaptažodį';
            }
        }
    }

    // --- Statistics ---

    async function loadStats(role) {
        if (isCreatorRole(role)) {
            await loadCreatorStats();
        } else {
            loadClientStats();
        }
    }

    async function loadCreatorStats() {
        if (!creatorData) {
            creatorData = await loadCreatorData(currentUser.id);
        }

        const ratingEl = qs('#stat-rating');
        const reviewsEl = qs('#stat-reviews');
        const ordersEl = qs('#stat-orders');

        if (creatorData) {
            // Compute live from the loaded reviews instead of trusting the
            // cached creators.rating / creators.review_count columns — nothing
            // keeps those in sync when a review is inserted, so they stay 0.
            const reviews = creatorData.reviews || [];
            const reviewCount = reviews.length;
            const avgRating = reviewCount
                ? (reviews.reduce((sum, r) => sum + (parseFloat(r.rating) || 0), 0) / reviewCount).toFixed(1)
                : '0.0';

            if (ratingEl) ratingEl.textContent = avgRating;
            if (reviewsEl) reviewsEl.textContent = String(reviewCount);
            if (ordersEl) ordersEl.textContent = '…';

            // Count real orders for this creator (exclude never-paid carts).
            supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('creator_id', creatorData.id)
                .neq('status', 'pending_payment')
                .then(({ count }) => {
                    if (ordersEl) ordersEl.textContent = String(count || 0);
                });

            renderReviews(reviews);
        } else {
            if (ratingEl) ratingEl.textContent = '—';
            if (reviewsEl) reviewsEl.textContent = '0';
            if (ordersEl) ordersEl.textContent = '—';

            const container = qs('#reviews-list');
            if (container) {
                container.innerHTML = `
                    <p class="text-gray-500 dark:text-gray-400 text-sm py-4">
                        Jūs dar neturite kūrėjo profilio. Sukurkite jį, kad gautumėte atsiliepimus.
                    </p>
                `;
            }
        }

        renderActivityTimeline();
    }

    function loadClientStats() {
        const daysEl = qs('#stat-membership-days');
        if (daysEl) daysEl.textContent = daysSince(currentUser.created_at);

        const hiredEl = qs('#stat-hired');
        if (hiredEl) hiredEl.textContent = '—';

        const leftReviewsEl = qs('#stat-left-reviews');
        if (leftReviewsEl) leftReviewsEl.textContent = '—';
    }

    function renderReviews(reviews) {
        const container = qs('#reviews-list');
        if (!container) return;

        if (!reviews.length) {
            container.innerHTML = `
                <p class="text-gray-500 dark:text-gray-400 text-sm py-4">Kol kas atsiliepimų nėra.</p>
            `;
            return;
        }

        const sorted = [...reviews].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

        container.innerHTML = sorted.map(r => {
            const hasResponse = !!(r.creator_response && r.creator_response.trim());
            const responseBlock = hasResponse ? `
                <div class="mt-2 ml-1 pl-3 border-l-2 border-primary/40">
                    <p class="text-xs font-semibold text-primary mb-0.5">Jūsų atsakymas:</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400" data-review-response>${escHtml(r.creator_response)}</p>
                </div>` : '';
            return `
            <div class="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0" data-review-id="${escHtml(r.id)}">
                <div class="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">${escHtml((r.author_name || '?').charAt(0))}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="font-medium text-sm text-gray-900 dark:text-white">${escHtml(r.author_name)}</span>
                        <span class="text-xs text-gray-400">${formatDate(r.created_at)}</span>
                    </div>
                    <div class="flex gap-0.5 mt-0.5">
                        ${Array.from({ length: 5 }, (_, i) =>
                            `<svg class="w-3.5 h-3.5 ${i < r.rating ? 'text-primary' : 'text-gray-300 dark:text-gray-600'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`
                        ).join('')}
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${escHtml(r.content || '')}</p>
                    ${responseBlock}
                    <button type="button" data-review-reply-toggle class="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer">${hasResponse ? 'Redaguoti atsakymą' : 'Atsakyti'}</button>
                    <div class="hidden mt-2" data-review-reply-form>
                        <textarea data-review-reply-input rows="2" maxlength="500" class="w-full text-sm px-3 py-2 border border-secondary dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" style="border-radius:6px;" placeholder="Parašyk viešą atsakymą...">${hasResponse ? escHtml(r.creator_response) : ''}</textarea>
                        <div class="flex gap-2 mt-1.5">
                            <button type="button" data-review-reply-submit class="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold cursor-pointer" style="border-radius:4px;">Išsaugoti</button>
                            <button type="button" data-review-reply-cancel class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold cursor-pointer" style="border-radius:4px;">Atšaukti</button>
                            ${hasResponse ? '<button type="button" data-review-reply-delete class="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold cursor-pointer" style="border-radius:4px;">Pašalinti</button>' : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        wireReviewReplies(container);
    }

    function wireReviewReplies(container) {
        container.querySelectorAll('[data-review-id]').forEach(card => {
            const reviewId = card.getAttribute('data-review-id');
            const toggle = card.querySelector('[data-review-reply-toggle]');
            const form = card.querySelector('[data-review-reply-form]');
            const input = card.querySelector('[data-review-reply-input]');
            const submit = card.querySelector('[data-review-reply-submit]');
            const cancel = card.querySelector('[data-review-reply-cancel]');
            const del = card.querySelector('[data-review-reply-delete]');
            if (!toggle || !form) return;

            toggle.addEventListener('click', () => {
                form.classList.toggle('hidden');
                if (!form.classList.contains('hidden')) input?.focus();
            });
            cancel?.addEventListener('click', () => form.classList.add('hidden'));

            async function save(text) {
                submit.disabled = true;
                const { error } = await supabase.rpc('set_review_response', { p_review_id: Number(reviewId), p_response: text });
                submit.disabled = false;
                if (error) { alert('Klaida: ' + error.message); return; }
                // Refresh from DB so the displayed list reflects the change.
                creatorData = await loadCreatorData(currentUser.id);
                renderReviews(creatorData?.reviews || []);
            }
            submit?.addEventListener('click', () => save(input.value));
            del?.addEventListener('click', () => { if (confirm('Pašalinti atsakymą?')) save(''); });
        });
    }

    function renderActivityTimeline() {
        const container = qs('#activity-timeline');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-start gap-3">
                    <div class="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <div>
                        <p class="text-sm text-gray-700 dark:text-gray-300">Profilis sukurtas</p>
                        <span class="text-xs text-gray-400">${formatDate(currentUser.created_at)}</span>
                    </div>
                </div>
                <p class="text-sm text-gray-400 dark:text-gray-500 italic pl-5">Daugiau veiklos bus rodoma ateityje.</p>
            </div>
        `;
    }

    // --- Sign Out All ---

    async function signOutAll() {
        try {
            await supabase.auth.signOut({ scope: 'global' });
            window.location.href = 'prisijungimas.html';
        } catch (err) {
            showMessage('#settings-msg', 'Klaida: ' + err.message, 'error');
        }
    }

    // --- GDPR: Data Export (Art. 15) ---

    async function exportMyData(btn) {
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Renku duomenis...';
        try {
            const uid = currentUser.id;
            const queries = await Promise.all([
                supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
                supabase.from('creators').select('*').eq('user_id', uid),
                supabase.from('creator_services').select('*, creators!inner(user_id)').eq('creators.user_id', uid),
                supabase.from('creator_categories').select('*, creators!inner(user_id)').eq('creators.user_id', uid),
                supabase.from('creator_badges').select('*, creators!inner(user_id)').eq('creators.user_id', uid),
                supabase.from('messages').select('*').eq('sender_id', uid),
                supabase.from('orders').select('*').or(`client_id.eq.${uid},creator_id.eq.${uid}`),
            ]);
            const bundle = {
                exportedAt: new Date().toISOString(),
                user: { id: uid, email: currentUser.email },
                profile: queries[0].data ?? null,
                creator: queries[1].data ?? [],
                creator_services: queries[2].data ?? [],
                creator_categories: queries[3].data ?? [],
                creator_badges: queries[4].data ?? [],
                messages: queries[5].data ?? [],
                orders: queries[6].data ?? [],
            };
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medijus-mano-duomenys-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showMessage('#settings-msg', 'Tavo duomenys atsisiųsti.', 'success');
        } catch (err) {
            showMessage('#settings-msg', 'Klaida eksportuojant: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    }

    // --- GDPR: Account Deletion (Art. 17) ---

    function openDeleteAccountModal() {
        const modal = qs('#delete-account-modal');
        const input = qs('#delete-confirm-input');
        const confirmBtn = qs('#delete-confirm-btn');
        const msg = qs('#delete-account-msg');
        if (input) input.value = '';
        if (confirmBtn) confirmBtn.disabled = true;
        if (msg) msg.classList.add('hidden');
        if (modal) modal.classList.remove('hidden');
    }

    function closeDeleteAccountModal() {
        const modal = qs('#delete-account-modal');
        if (modal) modal.classList.add('hidden');
    }

    async function confirmDeleteAccount() {
        const msg = qs('#delete-account-msg');
        const btn = qs('#delete-confirm-btn');
        if (msg) msg.classList.add('hidden');
        btn.disabled = true;
        btn.textContent = 'Trinama...';
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Nepavyko gauti sesijos.');
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const body = await resp.json();
            if (!resp.ok || !body.success) {
                throw new Error(body.error || 'Nežinoma klaida');
            }
            await supabase.auth.signOut().catch(() => {});
            window.location.href = 'index.html?deleted=1';
        } catch (err) {
            if (msg) {
                msg.textContent = 'Klaida: ' + err.message;
                msg.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = 'Patvirtinti ištrynimą';
        }
    }

    // --- Services Management ---

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function loadServices() {
        if (!creatorData) return;
        const { data, error } = await supabase
            .from('creator_services')
            .select('*')
            .eq('creator_id', creatorData.id)
            .order('price', { ascending: true });
        if (!error) creatorServices = data || [];
    }

    // --- Packages (Paketai) ---

    const TIERS = ['bazinis', 'standartinis', 'premium'];
    const TIER_LABELS = { bazinis: 'Bazinis', standartinis: 'Standartinis', premium: 'Premium' };

    async function loadPackages() {
        if (!creatorData) return;
        const { data, error } = await supabase
            .from('creator_services')
            .select('*')
            .eq('creator_id', creatorData.id)
            .not('tier', 'is', null);
        creatorPackages = { bazinis: null, standartinis: null, premium: null };
        if (!error && data) {
            data.forEach(p => { if (p.tier) creatorPackages[p.tier] = p; });
        }
    }

    function renderPackageEditor() {
        TIERS.forEach(tier => {
            const pkg = creatorPackages[tier];
            const toggle = qs(`#pkg-${tier}-on`);
            const fields = qs(`#pkg-${tier}-fields`);
            if (!toggle || !fields) return;

            toggle.checked = !!pkg;
            toggleTierFields(tier, !!pkg);

            qs(`#pkg-${tier}-name`).value = pkg?.name || '';
            qs(`#pkg-${tier}-desc`).value = pkg?.description || '';
            qs(`#pkg-${tier}-price`).value = pkg?.price ?? '';
            qs(`#pkg-${tier}-days`).value = pkg?.delivery_days ?? '';
            qs(`#pkg-${tier}-revs`).value = pkg?.revisions ?? '';
            qs(`#pkg-${tier}-features`).value = (pkg?.features || []).join('\n');
        });
        renderPackagePreview();
    }

    function toggleTierFields(tier, enabled) {
        const fields = qs(`#pkg-${tier}-fields`);
        if (!fields) return;
        if (enabled) {
            fields.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            fields.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    function getFormPackage(tier) {
        const toggle = qs(`#pkg-${tier}-on`);
        if (!toggle || !toggle.checked) return null;

        const name = qs(`#pkg-${tier}-name`)?.value?.trim();
        const description = qs(`#pkg-${tier}-desc`)?.value?.trim();
        const priceVal = qs(`#pkg-${tier}-price`)?.value;
        const daysVal = qs(`#pkg-${tier}-days`)?.value;
        const revsVal = qs(`#pkg-${tier}-revs`)?.value;
        const featuresRaw = qs(`#pkg-${tier}-features`)?.value || '';

        const price = parseInt(priceVal, 10);
        const delivery_days = daysVal ? parseInt(daysVal, 10) : null;
        const revisions = revsVal !== '' ? parseInt(revsVal, 10) : 0;
        const features = featuresRaw.split('\n').map(f => f.trim()).filter(Boolean);

        return { name, description: description || null, price, delivery_days, revisions, features, tier };
    }

    function renderPackagePreview() {
        const container = qs('#packages-preview');
        if (!container) return;

        const activePkgs = TIERS.map(tier => {
            const toggle = qs(`#pkg-${tier}-on`);
            if (!toggle?.checked) return null;
            const form = getFormPackage(tier);
            if (!form || !form.name) return null;
            return { ...form, tier };
        }).filter(Boolean);

        if (!activePkgs.length) {
            container.innerHTML = '<p class="text-sm text-gray-400 col-span-full text-center py-6">Įjunkite bent vieną paketą, kad pamatytumėte peržiūrą.</p>';
            return;
        }

        container.innerHTML = activePkgs.map(pkg => renderPackageCard(pkg, pkg.tier === 'standartinis')).join('');
    }

    function renderPackageCard(pkg, highlighted) {
        const revText = pkg.revisions === -1 ? 'Be limito' : pkg.revisions === 1 ? '1 korekcija' : `${pkg.revisions || 0} korekcijos`;
        const borderCls = highlighted ? 'border-2 border-primary' : 'border border-secondary dark:border-gray-700';
        const badgeHtml = highlighted ? '<span class="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">Populiariausias</span>' : '';

        return `
            <div class="relative ${borderCls} bg-white dark:bg-gray-900 p-4 flex flex-col" style="border-radius:8px;">
                ${badgeHtml}
                <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">${TIER_LABELS[pkg.tier]}</span>
                <span class="text-2xl font-bold text-gray-900 dark:text-white mt-1">€${pkg.price || 0}</span>
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200 mt-2">${escHtml(pkg.name || '')}</span>
                ${pkg.description ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">${escHtml(pkg.description)}</p>` : ''}
                <div class="flex gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    ${pkg.delivery_days ? `<span>&#128197; ${pkg.delivery_days} d.d.</span>` : ''}
                    <span>&#128260; ${revText}</span>
                </div>
                ${pkg.features?.length ? `
                    <ul class="mt-3 space-y-1 text-xs text-gray-700 dark:text-gray-300 flex-1">
                        ${pkg.features.map(f => `<li class="flex items-start gap-1.5"><span class="text-green-500 mt-0.5">&#10003;</span><span>${escHtml(f)}</span></li>`).join('')}
                    </ul>
                ` : ''}
                <div class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div class="w-full text-center text-sm font-semibold py-2 ${highlighted ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}" style="border-radius:4px;">Pasirinkti</div>
                </div>
            </div>
        `;
    }

    async function savePackages() {
        const btn = qs('#save-packages-btn');
        const enabledTiers = TIERS.filter(t => qs(`#pkg-${t}-on`)?.checked);

        if (!enabledTiers.length) {
            showMessage('#packages-msg', 'Įjunkite bent vieną paketą.', 'error');
            return;
        }

        // Validate enabled tiers
        for (const tier of enabledTiers) {
            const pkg = getFormPackage(tier);
            if (!pkg.name) {
                showMessage('#packages-msg', `${TIER_LABELS[tier]}: pavadinimas privalomas.`, 'error');
                return;
            }
            if (isNaN(pkg.price) || pkg.price < 0) {
                showMessage('#packages-msg', `${TIER_LABELS[tier]}: įveskite teisingą kainą.`, 'error');
                return;
            }
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Saugoma...'; }

        try {
            const ops = [];

            for (const tier of TIERS) {
                const toggle = qs(`#pkg-${tier}-on`);
                const isOn = toggle?.checked;
                const existing = creatorPackages[tier];

                if (isOn) {
                    const pkg = getFormPackage(tier);
                    const row = {
                        name: pkg.name,
                        description: pkg.description,
                        price: pkg.price,
                        tier,
                        delivery_days: pkg.delivery_days,
                        revisions: pkg.revisions,
                        features: pkg.features.length ? pkg.features : null,
                        duration: pkg.delivery_days ? `${pkg.delivery_days} d.d.` : null,
                    };

                    if (existing) {
                        ops.push(supabase.from('creator_services').update(row).eq('id', existing.id));
                    } else {
                        ops.push(supabase.from('creator_services').insert({ ...row, creator_id: creatorData.id }).select().single());
                    }
                } else if (existing) {
                    ops.push(supabase.from('creator_services').delete().eq('id', existing.id));
                }
            }

            const results = await Promise.all(ops);
            const firstError = results.find(r => r.error);
            if (firstError) throw firstError.error;

            // Also update creator's price_from to lowest package price
            const lowestPrice = enabledTiers
                .map(t => parseInt(qs(`#pkg-${t}-price`)?.value, 10))
                .filter(p => !isNaN(p))
                .sort((a, b) => a - b)[0];
            if (lowestPrice !== undefined && creatorData) {
                await supabase.from('creators').update({ price_from: lowestPrice }).eq('id', creatorData.id);
                creatorData.price_from = lowestPrice;
            }

            await loadPackages();
            renderPackageEditor();
            showMessage('#packages-msg', 'Paketai sėkmingai išsaugoti!', 'success');
        } catch (err) {
            showMessage('#packages-msg', 'Klaida: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Išsaugoti paketus'; }
        }
    }

    async function setupPackagesTab() {
        await loadPackages();
        renderPackageEditor();
        renderStripeConnectSection();
        wireStripeConnectButton();

        // Auto-sync Stripe state if user just returned from onboarding
        const params = new URLSearchParams(window.location.search);
        if (params.get('stripe') === 'return' || params.get('stripe') === 'refresh') {
            syncStripeStatus();
        }

        // Toggle listeners
        TIERS.forEach(tier => {
            const toggle = qs(`#pkg-${tier}-on`);
            if (toggle) {
                toggle.addEventListener('change', () => {
                    toggleTierFields(tier, toggle.checked);
                    renderPackagePreview();
                });
            }
            // Live preview on input
            [`#pkg-${tier}-name`, `#pkg-${tier}-desc`, `#pkg-${tier}-price`, `#pkg-${tier}-days`, `#pkg-${tier}-revs`, `#pkg-${tier}-features`].forEach(sel => {
                const el = qs(sel);
                if (el) el.addEventListener('input', renderPackagePreview);
            });
        });

        const saveBtn = qs('#save-packages-btn');
        if (saveBtn) saveBtn.addEventListener('click', savePackages);
    }

    function renderStripeConnectSection() {
        const section = qs('#stripe-connect-section');
        const title = qs('#stripe-connect-title');
        const desc = qs('#stripe-connect-desc');
        const status = qs('#stripe-connect-status');
        const btn = qs('#stripe-connect-btn');
        if (!section || !creatorData) return;

        section.classList.remove('hidden');

        const charges = creatorData.stripe_charges_enabled;
        const payouts = creatorData.stripe_payouts_enabled;
        const submitted = creatorData.stripe_details_submitted;

        if (charges && payouts) {
            title.textContent = 'Mokėjimai aktyvūs';
            desc.textContent = 'Klientai gali tau apmokėti kortele. 10% komisijos eina platformai, 90% pervedama tau.';
            status.textContent = 'Aktyvūs';
            status.className = 'inline-block px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
            status.classList.remove('hidden');
            btn.textContent = 'Atnaujinti duomenis';
        } else if (creatorData.stripe_account_id && submitted) {
            title.textContent = 'Stripe peržiūri tavo duomenis';
            desc.textContent = 'Mokėjimai įsijungs po patikrinimo (paprastai per kelias valandas).';
            status.textContent = 'Laukiama';
            status.className = 'inline-block px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
            status.classList.remove('hidden');
            btn.textContent = 'Patikrinti statusą';
        } else if (creatorData.stripe_account_id) {
            title.textContent = 'Užbaik Stripe registraciją';
            desc.textContent = 'Pradėjai, bet dar neužpildei visų laukų. Tęsk registraciją, kad galėtum gauti mokėjimus.';
            btn.textContent = 'Tęsti registraciją';
        } else {
            title.textContent = 'Prisijunk mokėjimų priėmimą';
            desc.textContent = 'Kad klientai galėtų tau apmokėti kortele, prisijunk Stripe paskyrą. Stripe tvarko KYC ir saugiai siunčia tau pinigus į IBAN.';
            btn.textContent = 'Prisijungti Stripe';
        }
    }

    async function syncStripeStatus() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        try {
            await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect-onboard`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });
            // Refresh local creator data after server sync
            const { data: refreshed } = await supabase.from('creators').select('*').eq('user_id', currentUser.id).single();
            if (refreshed) {
                creatorData = refreshed;
                renderStripeConnectSection();
            }
        } catch (_) { /* non-fatal */ }
    }

    function wireStripeConnectButton() {
        const btn = qs('#stripe-connect-btn');
        if (!btn || btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', startStripeConnect);
    }

    async function startStripeConnect() {
        const btn = qs('#stripe-connect-btn');
        const msg = qs('#stripe-connect-msg');
        if (msg) msg.classList.add('hidden');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Kraunama...';

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = 'prisijungimas.html';
                return;
            }
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect-onboard`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });
            const result = await resp.json();
            if (!resp.ok || result.error) throw new Error(result.error || 'Nepavyko gauti registracijos nuorodos');

            if (result.already_complete) {
                // Stripe says we're done — refresh creator data from DB (server already synced) and re-render.
                const { data: refreshed } = await supabase.from('creators').select('*').eq('user_id', currentUser.id).single();
                if (refreshed) {
                    creatorData = refreshed;
                    renderStripeConnectSection();
                }
                btn.disabled = false;
                btn.textContent = original;
                if (msg) {
                    msg.classList.remove('hidden', 'text-red-500');
                    msg.classList.add('text-green-600');
                    msg.textContent = 'Mokėjimai aktyvuoti. ✓';
                }
                return;
            }
            window.location.href = result.url;
        } catch (err) {
            btn.disabled = false;
            btn.textContent = original;
            if (msg) {
                msg.textContent = 'Klaida: ' + err.message;
                msg.className = 'mt-3 text-xs text-red-500';
                msg.classList.remove('hidden');
            }
        }
    }

    // --- Skelbimas (Creator Listing) ---

    let allCategories = [];
    let creatorCategoryIds = [];
    let skelbimasInitialized = false;

    async function initSkelbimas() {
        const ALLOWED_SLUGS = [
            'foto-asmenims','foto-vestuves','foto-verslui','foto-nekilnojamas','foto-automobiliai','foto-kurybiniai',
            'video-asmeniniai','video-vestuves','video-verslo','video-produktu','video-renginiai','video-nekilnojamas','video-muzika','video-socialine',
            'mont-asmeniniai','mont-vestuves','mont-verslo','mont-produktu','mont-renginiai','mont-muzika','mont-socialine','mont-kurybiniai',
            'diz-logotipai','diz-socialine','diz-spausdinta','diz-pakuotes','diz-web','diz-leidiniai','diz-renginiai','diz-iliustracijos'
        ];
        const { data: cats } = await supabase.from('categories').select('*').order('name');
        allCategories = (cats || []).filter(c => ALLOWED_SLUGS.includes(c.slug));

        if (creatorData) {
            const { data: cc } = await supabase
                .from('creator_categories')
                .select('category_id')
                .eq('creator_id', creatorData.id);
            creatorCategoryIds = (cc || []).map(r => r.category_id);
        }

        renderSkelbimasForm();
        setupSkelbimasListeners();
    }

    function renderSkelbimasForm() {
        const data = creatorData || {};

        // Select: set by matching option value
        const roleEl = qs('#skel-role');
        if (roleEl && data.role) {
            const opt = [...roleEl.options].find(o => o.value === data.role);
            if (opt) roleEl.value = data.role;
        }

        const map = {
            'skel-bio':      data.bio || '',
            'skel-location': data.location || '',
            'skel-price':    data.price_from != null ? data.price_from : '',
            'skel-image':    data.image_url || '',
            'skel-portfolio-target': data.portfolio_target || 10,
        };
        for (const [id, val] of Object.entries(map)) {
            const el = qs(`#${id}`);
            if (el) el.value = val;
        }

        // Rising star checkbox + conditional fields
        const risingCheckbox = qs('#skel-rising-star');
        const risingFields = qs('#skel-rising-fields');
        if (risingCheckbox) {
            risingCheckbox.checked = !!data.is_rising_star;
            if (risingFields) risingFields.classList.toggle('hidden', !data.is_rising_star);
            risingCheckbox.addEventListener('change', () => {
                if (risingFields) risingFields.classList.toggle('hidden', !risingCheckbox.checked);
            });
        }

        // Show existing image preview
        if (data.image_url) {
            const previewImg  = qs('#skel-image-preview-img');
            const previewWrap = qs('#skel-image-preview-wrap');
            if (previewImg)  previewImg.src = data.image_url;
            if (previewWrap) previewWrap.classList.remove('hidden');
            qs('#skel-image-placeholder')?.classList.add('hidden');
            qs('#skel-image-change-btn')?.classList.remove('hidden');
        }

        renderSkelbimasCategories(creatorCategoryIds);
        renderSkelbimasPreview();
        renderSkelbimasStatusBanner();
    }

    function renderSkelbimasStatusBanner() {
        const el = qs('#skelbimas-status-banner');
        if (!el) return;

        const status = creatorData?.status;
        if (!status || status === 'approved') {
            el.classList.add('hidden');
            el.innerHTML = '';
            return;
        }

        el.classList.remove('hidden');

        if (status === 'pending') {
            el.innerHTML = `
                <div class="flex items-start gap-3 p-4 border border-yellow-200 dark:border-yellow-900/40 bg-yellow-50 dark:bg-yellow-900/20" style="border-radius:8px;">
                    <svg class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16a2 2 0 001.73 3z"/></svg>
                    <div class="text-sm">
                        <p class="font-semibold text-yellow-800 dark:text-yellow-300">Laukia admin patvirtinimo</p>
                        <p class="text-yellow-700 dark:text-yellow-400 mt-0.5">Tavo skelbimas bus viešai matomas, kai administratorius jį patvirtins. Tuo tarpu gali redaguoti duomenis.</p>
                    </div>
                </div>
            `;
            return;
        }

        if (status === 'rejected') {
            const note = creatorData?.admin_note || '';
            el.innerHTML = `
                <div class="flex items-start gap-3 p-4 border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20" style="border-radius:8px;">
                    <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    <div class="text-sm">
                        <p class="font-semibold text-red-800 dark:text-red-300">Skelbimas atmestas</p>
                        ${note ? `<p class="text-red-700 dark:text-red-400 mt-0.5"><span class="font-medium">Priežastis:</span> ${escapeHtml(note)}</p>` : ''}
                        <p class="text-red-700 dark:text-red-400 mt-1">Pataisyk skelbimą ir išsaugok — jis bus pateiktas pakartotiniam patvirtinimui.</p>
                    </div>
                </div>
            `;
        }
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    const ROLE_TO_GROUP = {
        'Fotografas':        'Fotografai',
        'Dronų Pilotas':     'Fotografai',
        'Videografas':       'Videografai',
        'Režisierius':       'Videografai',
        'Video Montuotojas': 'Montažuotojai',
        'Color Grader':      'Montažuotojai',
        'VFX/Motion Graphics': 'Montažuotojai',
        'Animatorius':       'Montažuotojai',
        'Grafikos Dizaineris': 'Dizaineriai',
        'Motion Designer':   'Dizaineriai',
        'UI/UX Dizaineris':  'Dizaineriai',
    };

    const CATEGORY_GROUPS = [
        { group: 'Fotografai', slugs: ['foto-asmenims','foto-vestuves','foto-verslui','foto-nekilnojamas','foto-automobiliai','foto-kurybiniai'] },
        { group: 'Videografai', slugs: ['video-asmeniniai','video-vestuves','video-verslo','video-produktu','video-renginiai','video-nekilnojamas','video-muzika','video-socialine'] },
        { group: 'Montažuotojai', slugs: ['mont-asmeniniai','mont-vestuves','mont-verslo','mont-produktu','mont-renginiai','mont-muzika','mont-socialine','mont-kurybiniai'] },
        { group: 'Dizaineriai', slugs: ['diz-logotipai','diz-socialine','diz-spausdinta','diz-pakuotes','diz-web','diz-leidiniai','diz-renginiai','diz-iliustracijos'] },
    ];

    function renderSkelbimasCategories(selectedIds) {
        const container = qs('#skel-categories');
        if (!container) return;

        if (!allCategories.length) {
            container.innerHTML = '<p class="text-sm text-gray-400 col-span-full">Kategorijų nerasta.</p>';
            return;
        }

        const catBySlug = Object.fromEntries(allCategories.map(c => [c.slug, c]));
        const activeRole = qs('#skel-role')?.value || '';
        const activeGroup = ROLE_TO_GROUP[activeRole] || null;
        const visibleGroups = activeGroup
            ? CATEGORY_GROUPS.filter(g => g.group === activeGroup)
            : CATEGORY_GROUPS;

        container.className = 'space-y-4';
        container.innerHTML = visibleGroups.map(({ group, slugs }) => {
            const cats = slugs.map(s => catBySlug[s]).filter(Boolean);
            if (!cats.length) return '';
            return `
                <div>
                    <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">${group}</p>
                    <div class="grid grid-cols-2 gap-1.5">
                        ${cats.map(cat => `
                            <label class="flex items-center gap-2 px-2 py-1.5 border cursor-pointer hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors
                                ${selectedIds.includes(cat.id) ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-secondary dark:border-gray-700'}"
                                style="border-radius: 5px;">
                                <input type="checkbox" class="skel-cat-checkbox accent-yellow-400 flex-shrink-0"
                                    data-cat-id="${cat.id}"
                                    ${selectedIds.includes(cat.id) ? 'checked' : ''}>
                                <span class="text-xs text-gray-700 dark:text-gray-300">${cat.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.skel-cat-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const label = e.target.closest('label');
                if (e.target.checked) {
                    label.classList.add('border-primary', 'bg-primary/5', 'dark:bg-primary/10');
                    label.classList.remove('border-secondary', 'dark:border-gray-700');
                } else {
                    label.classList.remove('border-primary', 'bg-primary/5', 'dark:bg-primary/10');
                    label.classList.add('border-secondary', 'dark:border-gray-700');
                }
                renderSkelbimasPreview();
            });
        });
    }

    function renderSkelbimasPreview() {
        const preview = qs('#skel-card-preview');
        if (!preview) return;

        const role     = qs('#skel-role')?.value || 'Profesija';
        const name     = currentProfile?.name || currentUser?.user_metadata?.name || 'Vardas';
        const location = qs('#skel-location')?.value || '';
        const price    = qs('#skel-price')?.value ?? '0';
        const imageUrl = qs('#skel-image')?.value || '';
        const rating   = creatorData?.rating || 0;
        const reviews  = creatorData?.review_count || 0;

        preview.innerHTML = `
            <div class="relative h-36 bg-gradient-to-br from-purple-500 to-violet-600 overflow-hidden">
                ${imageUrl ? `<img src="${imageUrl}" alt="" class="w-full h-full object-cover opacity-80" onerror="this.style.display='none'">` : ''}
            </div>
            <div class="p-4">
                <div class="flex items-start justify-between mb-1">
                    <div>
                        <p class="font-bold text-gray-900 dark:text-white text-sm">${name}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${role}</p>
                    </div>
                    <div class="flex items-center text-xs">
                        <svg class="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        <span class="ml-0.5 font-bold text-gray-900 dark:text-white">${rating || '—'}</span>
                        <span class="ml-0.5 text-gray-400">(${reviews})</span>
                    </div>
                </div>
                ${location ? `<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">${location}</p>` : '<div class="mb-2"></div>'}
                <div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span class="text-xs text-gray-500 dark:text-gray-400">Nuo <strong class="text-gray-900 dark:text-white">€${price || 0}</strong></span>
                    <a href="kurejas.html#id=${creatorData?.id || ''}" target="_blank" class="px-2 py-0.5 bg-primary text-white text-xs font-medium hover:bg-primary-hover" style="border-radius: 3px; text-decoration:none;">Peržiūrėti</a>
                </div>
            </div>
        `;
    }

    function setupSkelbimasListeners() {
        ['skel-role', 'skel-location', 'skel-price'].forEach(id => {
            const el = qs(`#${id}`);
            if (el) el.addEventListener('input', renderSkelbimasPreview);
            if (el) el.addEventListener('change', renderSkelbimasPreview);
        });

        const roleEl = qs('#skel-role');
        if (roleEl) roleEl.addEventListener('change', () => {
            renderSkelbimasCategories(creatorCategoryIds);
        });

        // Image upload area
        const uploadArea = qs('#skel-image-upload-area');
        const fileInput  = qs('#skel-image-input');

        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', (e) => {
                if (e.target.id !== 'skel-image-change-btn') fileInput.click();
            });
            qs('#skel-image-change-btn')?.addEventListener('click', () => fileInput.click());

            // Drag & drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('border-primary', 'bg-primary/5');
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('border-primary', 'bg-primary/5');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('border-primary', 'bg-primary/5');
                const file = e.dataTransfer.files[0];
                if (file) handleSkelbimasImageUpload(file);
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) handleSkelbimasImageUpload(file);
                fileInput.value = '';
            });
        }

        const saveBtn = qs('#save-skelbimas-btn');
        if (saveBtn) saveBtn.addEventListener('click', saveSkelbimas);
    }

    async function handleSkelbimasImageUpload(file) {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
        const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        const rawExt = (file.name.split('.').pop() || '').toLowerCase();
        if (!allowedTypes.includes(file.type) || !allowedExts.includes(rawExt)) {
            showMessage('#skelbimas-msg', 'Leidžiami formatai: PNG, JPG, WEBP, GIF.', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showMessage('#skelbimas-msg', 'Failas per didelis. Maksimalus dydis: 5MB.', 'error');
            return;
        }

        qs('#skel-image-placeholder')?.classList.add('hidden');
        qs('#skel-image-preview-wrap')?.classList.add('hidden');
        qs('#skel-image-change-btn')?.classList.add('hidden');
        qs('#skel-image-uploading')?.classList.remove('hidden');

        try {
            const rawExt2 = (file.name.split('.').pop() || '').toLowerCase();
            const ext = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(rawExt2) ? rawExt2 : 'png';
            const filePath = `${currentUser.id}/creator-cover.${ext}`;

            await supabase.storage.from('avatars').remove([filePath]);

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const url = publicUrl + '?t=' + Date.now();
            const hiddenInput = qs('#skel-image');
            if (hiddenInput) hiddenInput.value = url;

            const previewImg  = qs('#skel-image-preview-img');
            const previewWrap = qs('#skel-image-preview-wrap');
            if (previewImg)  previewImg.src = url;
            if (previewWrap) previewWrap.classList.remove('hidden');
            qs('#skel-image-change-btn')?.classList.remove('hidden');

            renderSkelbimasPreview();
        } catch (err) {
            showMessage('#skelbimas-msg', 'Nepavyko įkelti nuotraukos: ' + err.message, 'error');
            qs('#skel-image-placeholder')?.classList.remove('hidden');
        } finally {
            qs('#skel-image-uploading')?.classList.add('hidden');
        }
    }

    async function saveSkelbimas() {
        const role = qs('#skel-role')?.value?.trim();
        if (!role) {
            showMessage('#skelbimas-msg', 'Profesija yra privaloma.', 'error');
            return;
        }

        const priceRaw = parseInt(qs('#skel-price')?.value || '0', 10);
        const price = isNaN(priceRaw) ? 0 : priceRaw;

        const creatorName = currentProfile?.name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || '';

        const isRisingStar = !!qs('#skel-rising-star')?.checked;
        const portfolioTargetRaw = parseInt(qs('#skel-portfolio-target')?.value || '10', 10);
        const portfolioTarget = isNaN(portfolioTargetRaw) || portfolioTargetRaw < 1 ? 10 : Math.min(portfolioTargetRaw, 100);

        const payload = {
            name:        creatorName,
            role,
            bio:         qs('#skel-bio')?.value?.trim()      || null,
            location:    qs('#skel-location')?.value?.trim() || null,
            price_from:  price,
            price_label: isRisingStar && price === 0 ? 'Nemokama' : `Nuo €${price}`,
            image_url:   qs('#skel-image')?.value?.trim()    || null,
            is_rising_star: isRisingStar,
            portfolio_target: isRisingStar ? portfolioTarget : null,
        };

        const btn = qs('#save-skelbimas-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Saugoma...'; }

        try {
            if (creatorData) {
                const updatePayload = {
                    ...payload,
                    status: 'pending',
                    admin_note: null,
                    reviewed_at: null,
                };
                const { error } = await supabase
                    .from('creators')
                    .update(updatePayload)
                    .eq('user_id', currentUser.id);
                if (error) throw error;
                creatorData = { ...creatorData, ...updatePayload };
            } else {
                const { data, error } = await supabase
                    .from('creators')
                    .insert({ ...payload, user_id: currentUser.id, rating: 0, review_count: 0, portfolio_current: 0, status: 'pending' })
                    .select()
                    .single();
                if (error) throw error;
                creatorData = data;
            }

            // Sync categories
            const selectedIds = [...(qs('#skel-categories')?.querySelectorAll('.skel-cat-checkbox:checked') || [])]
                .map(cb => parseInt(cb.dataset.catId));

            if (creatorData?.id) {
                await supabase.from('creator_categories').delete().eq('creator_id', creatorData.id);
                if (selectedIds.length > 0) {
                    await supabase.from('creator_categories').insert(
                        selectedIds.map(catId => ({ creator_id: creatorData.id, category_id: catId }))
                    );
                }
                creatorCategoryIds = selectedIds;
            }

            renderSkelbimasStatusBanner();

            const isPending = creatorData?.status === 'pending';
            if (isPending) {
                showMessage('#skelbimas-msg',
                    'Skelbimas išsaugotas ir pateiktas administratoriui patvirtinti. Jis taps viešai matomas, kai bus patvirtintas.',
                    'success');
            } else {
                showMessage('#skelbimas-msg',
                    `Skelbimas sėkmingai išsaugotas! <a href="kurejas.html#id=${creatorData.id}" target="_blank" class="underline font-semibold">Peržiūrėti skelbimą &rarr;</a>`,
                    'success');
            }
        } catch (err) {
            showMessage('#skelbimas-msg', 'Klaida: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Išsaugoti skelbimą'; }
        }
    }

    // --- Initialize ---

    async function initProfile() {
        const loadingEl = qs('#profile-loading');
        const contentEl = qs('#profile-content');

        // Auth guard
        currentUser = await requireAuth();
        if (!currentUser) return;

        // Load profile data
        currentProfile = await loadProfile(currentUser.id);

        // Check if user is a creator
        const role = currentProfile?.role || currentUser.user_metadata?.role || 'klientas';
        if (isCreatorRole(role)) {
            creatorData = await loadCreatorData(currentUser.id);
        }

        // Hide loading, show content
        if (loadingEl) loadingEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');

        // Render everything
        renderProfileHeader();
        renderProfileForm();
        setupTabs();
        setupAvatarUpload();

        // Eagerly populate the "Užsakymai" tab badge so it matches the nav badge
        // immediately, instead of only after the user opens the orders tab.
        updateOrdersTabBadge(isCreatorRole(role));

        // Live preview on form input
        const formFields = qsa('#tab-informacija input, #tab-informacija textarea');
        formFields.forEach(field => {
            field.addEventListener('input', renderProfilePreview);
        });

        // Save profile button
        const saveBtn = qs('#save-profile-btn');
        if (saveBtn) saveBtn.addEventListener('click', saveProfile);

        // Change password button
        const pwBtn = qs('#change-password-btn');
        if (pwBtn) pwBtn.addEventListener('click', changePassword);

        // Sign out all button
        const signOutAllBtn = qs('#signout-all-btn');
        if (signOutAllBtn) signOutAllBtn.addEventListener('click', signOutAll);

        // GDPR: Data export
        const exportBtn = qs('#data-export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => exportMyData(exportBtn));

        // GDPR: Account deletion
        const deleteBtn = qs('#delete-account-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', openDeleteAccountModal);
        const deleteCancelBtn = qs('#delete-cancel-btn');
        if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteAccountModal);
        const deleteConfirmBtn = qs('#delete-confirm-btn');
        if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', confirmDeleteAccount);
        const deleteConfirmInput = qs('#delete-confirm-input');
        if (deleteConfirmInput && deleteConfirmBtn) {
            deleteConfirmInput.addEventListener('input', () => {
                deleteConfirmBtn.disabled = deleteConfirmInput.value.trim() !== 'IŠTRINTI';
            });
        }

        // Settings: detect Google OAuth user
        const provider = currentUser.app_metadata?.provider;
        const pwSection = qs('#password-section');
        const oauthNotice = qs('#oauth-notice');
        if (provider === 'google') {
            if (pwSection) pwSection.classList.add('hidden');
            if (oauthNotice) oauthNotice.classList.remove('hidden');
        } else {
            if (pwSection) pwSection.classList.remove('hidden');
            if (oauthNotice) oauthNotice.classList.add('hidden');
        }

        // Settings: email display
        const emailDisplay = qs('#settings-email');
        if (emailDisplay) emailDisplay.textContent = currentUser.email || '';
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProfile);
    } else {
        initProfile();
    }
})();
