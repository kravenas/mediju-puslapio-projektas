// =============================================
// Medijus Admin Panel
// =============================================

console.log('[admin] script loaded', new Date().toISOString());
window.addEventListener('error', e => console.error('[admin] window error:', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', e => console.error('[admin] unhandled rejection:', e.reason));

const ADMIN_EMAILS = ['kkleivaarnas@gmail.com'];

let currentFilter = 'pending';
let rejectingAppId = null;
let currentListingsFilter = 'pending';
let rejectingListingId = null;
let currentMessagesFilter = 'unhandled';

function hideLoading() {
    const el = document.getElementById('admin-loading');
    if (el) el.classList.add('hidden');
}

function isAdmin(email) {
    if (!email) return false;
    return ADMIN_EMAILS.some(a => a.toLowerCase() === email.toLowerCase());
}

// ---- Init ----
let adminInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[admin] DOMContentLoaded fired, supabase defined:', typeof supabase !== 'undefined');
    if (typeof supabase === 'undefined') {
        hideLoading();
        document.getElementById('access-denied').classList.remove('hidden');
        document.getElementById('access-denied').innerHTML = '<p class="text-red-500">Klaida: supabase client neužkrautas. Patikrinkite konsolę.</p>';
        return;
    }

    // Hard timeout: if auth callback never fires in 5s, show error instead of hanging forever
    const authTimeout = setTimeout(() => {
        if (!adminInitialized) {
            console.error('[admin] auth callback never fired within 5s');
            hideLoading();
            const el = document.getElementById('access-denied');
            if (el) {
                el.classList.remove('hidden');
                el.innerHTML = '<div class="text-center"><h2 class="text-xl font-bold text-red-600 mb-2">Sesijos patikra užtruko per ilgai</h2><p class="text-sm text-gray-500">Pabandykite hard refresh (Cmd+Shift+R) arba atsijungti ir vėl prisijungti.</p><button onclick="supabase.auth.signOut().then(()=>location.href=\'prisijungimas.html?redirect=admin.html\')" class="mt-4 px-6 py-2 bg-primary text-white font-semibold text-sm cursor-pointer" style="border-radius:6px;">Atsijungti</button></div>';
            }
        }
    }, 5000);

    // Listen for auth state — catches session restore + login
    supabase.auth.onAuthStateChange(async (event, session) => {
        clearTimeout(authTimeout);
        console.log('[admin] auth event:', event, '| email:', session?.user?.email);

        if (adminInitialized) return;

        const user = session?.user || null;

        // Wait for INITIAL_SESSION or SIGNED_IN
        if (!user && event === 'INITIAL_SESSION') {
            hideLoading();
            document.getElementById('access-denied').classList.remove('hidden');
            document.getElementById('access-denied').innerHTML = `
                <div class="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center mx-auto mb-4" style="border-radius:50%;">
                    <svg class="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                </div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Prisijunkite</h2>
                <p class="text-gray-500 dark:text-gray-400 text-sm">Prisijunkite su admin paskyra.</p>
                <a href="prisijungimas.html?redirect=admin.html" class="inline-block mt-4 px-6 py-2 bg-primary text-white font-semibold text-sm" style="border-radius:6px;">Prisijungti</a>
            `;
            return;
        }

        if (!user) return;

        hideLoading();
        adminInitialized = true;
        document.getElementById('access-denied').classList.add('hidden');

        if (!isAdmin(user.email)) {
            document.getElementById('access-denied').classList.remove('hidden');
            document.getElementById('access-denied').innerHTML = `
                <div class="w-16 h-16 bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4" style="border-radius:50%;">
                    <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                </div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Prieiga uždrausta</h2>
                <p class="text-gray-500 dark:text-gray-400 text-sm">Prisijungėte kaip: <strong>${escapeHtml(user.email)}</strong></p>
                <p class="text-gray-400 text-xs mt-1">Šis puslapis prieinamas tik administratoriams.</p>
                <button onclick="supabase.auth.signOut().then(()=>location.reload())" class="inline-block mt-4 px-6 py-2 bg-primary text-white font-semibold text-sm cursor-pointer" style="border-radius:6px;">Atsijungti ir bandyti kitu el. paštu</button>
            `;
            return;
        }

        document.getElementById('admin-email').textContent = user.email;
        document.getElementById('admin-content').classList.remove('hidden');

        console.log('Setting up tabs...');
        setupTabs();
        setupMessagesFilters();
        console.log('Setting up filters...');
        setupFilters();
        setupListingsFilters();
        setupPortfolioLinkFilters();

        // Break out of onAuthStateChange callback before querying —
        // supabase-js can deadlock if you await .from() inside the callback
        console.log('Scheduling loadListings...');
        setTimeout(() => {
            loadListings().then(() => {
                console.log('Listings loaded');
            }).catch(e => {
                console.error('Admin init error:', e);
                const container = document.getElementById('listings-list');
                if (container) {
                    container.innerHTML = `<div class="text-red-500 p-4">Klaida: ${e.message}</div>`;
                }
            });
            loadListingsPendingCount();
            loadPortfolioLinksPendingCount();
            loadMessagesCount();
        }, 0);
    });
});

// ---- Tabs ----
function setupTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => {
                t.classList.remove('active', 'border-primary', 'text-gray-900', 'dark:text-white');
                t.classList.add('border-transparent', 'text-gray-400');
            });
            tab.classList.add('active', 'border-primary', 'text-gray-900', 'dark:text-white');
            tab.classList.remove('border-transparent', 'text-gray-400');

            const tabName = tab.dataset.tab;
            document.getElementById('tab-listings').classList.toggle('hidden', tabName !== 'listings');
            document.getElementById('tab-applications').classList.toggle('hidden', tabName !== 'applications');
            document.getElementById('tab-subscriptions').classList.toggle('hidden', tabName !== 'subscriptions');
            document.getElementById('tab-disputes').classList.toggle('hidden', tabName !== 'disputes');
            document.getElementById('tab-portfolio-links').classList.toggle('hidden', tabName !== 'portfolio-links');
            document.getElementById('tab-analytics').classList.toggle('hidden', tabName !== 'analytics');
            document.getElementById('tab-messages').classList.toggle('hidden', tabName !== 'messages');
            document.getElementById('tab-reviews').classList.toggle('hidden', tabName !== 'reviews');
            document.getElementById('tab-orders').classList.toggle('hidden', tabName !== 'orders');

            if (tabName === 'listings') loadListings();
            if (tabName === 'applications') loadApplications();
            if (tabName === 'subscriptions') loadSubscriptions();
            if (tabName === 'disputes') loadDisputes();
            if (tabName === 'portfolio-links') loadPortfolioLinks();
            if (tabName === 'analytics') loadAnalytics();
            if (tabName === 'messages') loadMessages();
            if (tabName === 'reviews') loadReviewsAdmin();
            if (tabName === 'orders') loadOrdersAdmin();
        });
    });

    setupReviewsFilters();
    setupOrdersFilters();
}

// ---- Reviews moderation ----

let reviewsFilter = 'visible';
let reviewsCache = [];

function setupReviewsFilters() {
    document.querySelectorAll('.reviews-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.reviews-filter').forEach(b => {
                b.classList.remove('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
                b.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            });
            btn.classList.add('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            reviewsFilter = btn.dataset.status;
            loadReviewsAdmin();
        });
    });
    const csv = document.getElementById('reviews-csv-btn');
    if (csv) csv.addEventListener('click', () => exportCsv('atsiliepimai', reviewsCache.map(r => ({
        id: r.id, kurejas: r.creators?.name || '', autorius: r.author_name || '',
        ivertinimas: r.rating, atsiliepimas: r.content || '', atsakymas: r.creator_response || '',
        pasleptas: r.hidden ? 'taip' : 'ne', data: r.created_at
    }))));
}

async function loadReviewsAdmin() {
    const list = document.getElementById('reviews-mod-list');
    if (!list) return;
    list.innerHTML = '<div class="text-center py-12 text-gray-400 dark:text-gray-500">Kraunama...</div>';

    let query = supabase.from('reviews').select('*, creators(name)').order('created_at', { ascending: false });
    if (reviewsFilter === 'visible') query = query.eq('hidden', false);
    else if (reviewsFilter === 'hidden') query = query.eq('hidden', true);

    const { data: reviews, error } = await query;
    if (error) { list.innerHTML = `<p class="text-red-500 text-sm">Klaida: ${escapeHtml(error.message)}</p>`; return; }
    reviewsCache = reviews || [];
    if (!reviews.length) { list.innerHTML = '<div class="text-center py-12 text-gray-400">Atsiliepimų nėra.</div>'; return; }

    list.innerHTML = reviews.map(r => `
        <div class="bg-white dark:bg-gray-900 border border-secondary dark:border-gray-700 p-4 ${r.hidden ? 'opacity-60' : ''}" style="border-radius:8px;" data-review-row="${escapeHtml(r.id)}">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(r.author_name || 'Anon')}</span>
                        <span class="text-xs text-yellow-500">${'★'.repeat(Math.max(0, Math.min(5, r.rating || 0)))}</span>
                        <span class="text-xs text-gray-400">→ ${escapeHtml(r.creators?.name || '—')}</span>
                        ${r.hidden ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-600" style="border-radius:10px;">PASLĖPTAS</span>' : ''}
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${escapeHtml(r.content || '')}</p>
                    ${r.creator_response ? `<p class="text-xs text-primary mt-1">↳ atsakymas: ${escapeHtml(r.creator_response)}</p>` : ''}
                    <p class="text-[11px] text-gray-400 mt-1">${new Date(r.created_at).toLocaleString('lt-LT')}</p>
                </div>
                <div class="flex flex-col gap-1.5 flex-shrink-0">
                    <button data-review-hide="${escapeHtml(r.id)}" data-hidden="${r.hidden}" class="px-3 py-1.5 text-xs font-semibold ${r.hidden ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}" style="border-radius:4px;">${r.hidden ? 'Rodyti' : 'Slėpti'}</button>
                    <button data-review-del="${escapeHtml(r.id)}" class="px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200" style="border-radius:4px;">Trinti</button>
                </div>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('[data-review-hide]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.reviewHide;
        const newHidden = btn.dataset.hidden !== 'true';
        btn.disabled = true;
        const { error } = await supabase.from('reviews').update({ hidden: newHidden }).eq('id', id);
        if (error) { alert('Klaida: ' + error.message); btn.disabled = false; return; }
        loadReviewsAdmin();
    }));
    list.querySelectorAll('[data-review-del]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Negrįžtamai ištrinti šį atsiliepimą?')) return;
        btn.disabled = true;
        const { error } = await supabase.from('reviews').delete().eq('id', btn.dataset.reviewDel);
        if (error) { alert('Klaida: ' + error.message); btn.disabled = false; return; }
        loadReviewsAdmin();
    }));
}

// ---- Orders / payments overview ----

let ordersFilter = 'all';
let ordersCache = [];

function setupOrdersFilters() {
    document.querySelectorAll('.orders-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.orders-filter').forEach(b => {
                b.classList.remove('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
                b.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            });
            btn.classList.add('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            ordersFilter = btn.dataset.status;
            loadOrdersAdmin();
        });
    });
    const csv = document.getElementById('orders-csv-btn');
    if (csv) csv.addEventListener('click', () => exportCsv('uzsakymai', ordersCache.map(o => ({
        id: o.id, kurejas: o.creators?.name || '', paslauga: o.service_name || '',
        suma_eur: ((o.amount_cents || 0) / 100).toFixed(2), komisija_eur: ((o.platform_fee_cents || 0) / 100).toFixed(2),
        statusas: o.status, stripe_status: o.stripe_status || '', sukurta: o.created_at, apmoketa: o.paid_at || ''
    }))));
}

async function loadOrdersAdmin() {
    const list = document.getElementById('orders-admin-list');
    const summary = document.getElementById('orders-summary');
    if (!list) return;
    list.innerHTML = '<div class="text-center py-12 text-gray-400 dark:text-gray-500">Kraunama...</div>';

    let query = supabase.from('orders').select('*, creators(name)').neq('status', 'pending_payment').order('created_at', { ascending: false });
    if (ordersFilter !== 'all') query = query.eq('status', ordersFilter);

    const { data: orders, error } = await query;
    if (error) { list.innerHTML = `<p class="text-red-500 text-sm">Klaida: ${escapeHtml(error.message)}</p>`; return; }
    ordersCache = orders || [];

    // Summary cards (computed over the current filter)
    const gross = orders.reduce((s, o) => s + (o.amount_cents || 0), 0) / 100;
    const fees = orders.reduce((s, o) => s + (o.platform_fee_cents || 0), 0) / 100;
    const escrow = orders.filter(o => ['paid', 'delivered', 'rejected', 'disputed'].includes(o.status))
        .reduce((s, o) => s + (o.amount_cents || 0), 0) / 100;
    if (summary) summary.innerHTML = `
        ${adminStatCard('Užsakymų', orders.length, 'bg-gray-50 dark:bg-gray-800')}
        ${adminStatCard('Bendra suma', '€' + gross.toFixed(2), 'bg-blue-50 dark:bg-blue-900/20')}
        ${adminStatCard('Platformos komisija', '€' + fees.toFixed(2), 'bg-green-50 dark:bg-green-900/20')}
        ${adminStatCard('Escrow (užšaldyta)', '€' + escrow.toFixed(2), 'bg-amber-50 dark:bg-amber-900/20')}
    `;

    if (!orders.length) { list.innerHTML = '<div class="text-center py-12 text-gray-400">Užsakymų nėra.</div>'; return; }

    const STATUS_LT = { paid: 'Apmokėta', delivered: 'Pristatyta', approved: 'Užbaigta', released: 'Išmokėta', rejected: 'Atmesta', refunded: 'Grąžinta', disputed: 'Ginčas' };
    list.innerHTML = orders.map(o => `
        <div class="bg-white dark:bg-gray-900 border border-secondary dark:border-gray-700 p-4 flex items-center justify-between gap-3" style="border-radius:8px;">
            <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(o.service_name || 'Paslauga')}</span>
                    <span class="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" style="border-radius:10px;">${escapeHtml(STATUS_LT[o.status] || o.status)}</span>
                </div>
                <p class="text-xs text-gray-400 mt-1">Kūrėjas: ${escapeHtml(o.creators?.name || '—')} · ${new Date(o.created_at).toLocaleDateString('lt-LT')}</p>
            </div>
            <div class="text-right flex-shrink-0">
                <p class="text-sm font-bold text-gray-900 dark:text-white">€${((o.amount_cents || 0) / 100).toFixed(2)}</p>
                <p class="text-[11px] text-gray-400">komisija €${((o.platform_fee_cents || 0) / 100).toFixed(2)}</p>
            </div>
        </div>
    `).join('');
}

function adminStatCard(label, value, bg) {
    return `<div class="${bg} border border-secondary dark:border-gray-700 p-3" style="border-radius:8px;">
        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(label)}</p>
        <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">${escapeHtml(String(value))}</p>
    </div>`;
}

// CSV export helper — builds a CSV from an array of flat objects and downloads it.
function exportCsv(name, rows) {
    if (!rows || !rows.length) { alert('Nėra duomenų eksportui.'); return; }
    const headers = Object.keys(rows[0]);
    const esc = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medijus-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ---- Status filters ----
function setupFilters() {
    document.querySelectorAll('.status-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-filter').forEach(b => {
                b.classList.remove('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
                b.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            });
            btn.classList.add('active');
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            btn.classList.add('bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');

            currentFilter = btn.dataset.status;
            loadApplications();
        });
    });
}

// ---- Load badge applications ----
async function loadApplications() {
    const container = document.getElementById('applications-list');
    container.innerHTML = '<div class="text-center py-12 text-gray-400">Kraunama...</div>';

    let query = supabase
        .from('badge_applications')
        .select('*')
        .order('created_at', { ascending: false });

    if (currentFilter !== 'all') {
        query = query.eq('status', currentFilter);
    }

    const { data: apps, error } = await query;
    console.log('Applications query:', { apps, error, filter: currentFilter });

    if (error) {
        container.innerHTML = `
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-5" style="border-radius:10px;">
                <p class="text-red-600 dark:text-red-400 font-semibold text-sm mb-2">Klaida kraunant paraiškas</p>
                <p class="text-red-500 text-xs font-mono">${error.message}</p>
                <p class="text-gray-500 text-xs mt-3">Patikrinkite ar paleidote admin RLS politikas Supabase SQL editoriuje.</p>
            </div>
        `;
        return;
    }

    // Fetch creator details separately (avoids RLS join issues)
    if (apps && apps.length > 0) {
        const creatorIds = [...new Set(apps.map(a => a.creator_id))];
        const { data: creators, error: creatorsErr } = await supabase
            .from('creators')
            .select('id, name, creator_categories(categories(name))')
            .in('id', creatorIds);

        if (creatorsErr) {
            console.warn('Creators fetch error:', creatorsErr.message, creatorsErr);
        }

        const creatorMap = {};
        (creators || []).forEach(c => { creatorMap[c.id] = c; });
        apps.forEach(app => { app.creators = creatorMap[app.creator_id] || null; });
    }

    // Update pending count
    const pendingCount = apps ? apps.filter(a => a.status === 'pending').length : 0;
    const countEl = document.getElementById('pending-count');
    if (currentFilter === 'all') {
        countEl.textContent = pendingCount > 0 ? pendingCount : '';
    } else if (currentFilter === 'pending') {
        countEl.textContent = apps.length > 0 ? apps.length : '';
    }

    if (!apps || apps.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-400 dark:text-gray-500">Nėra paraiškų</div>';
        return;
    }

    container.innerHTML = apps.map(app => renderApplication(app)).join('');
}

function renderApplication(app) {
    const creator = app.creators || {};
    // Extract category from nested join: creator_categories → categories → name
    const categoryName = (creator.creator_categories || [])
        .map(cc => cc.categories?.name)
        .filter(Boolean)
        .join(', ');
    const date = new Date(app.created_at).toLocaleDateString('lt-LT', { year: 'numeric', month: 'long', day: 'numeric' });
    const reviewedDate = app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString('lt-LT') : '';

    const statusBadge = {
        pending: '<span class="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold" style="border-radius:4px;">Laukia</span>',
        approved: '<span class="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold" style="border-radius:4px;">Patvirtinta</span>',
        rejected: '<span class="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold" style="border-radius:4px;">Atmesta</span>',
    }[app.status] || '';

    const actions = app.status === 'pending' ? `
        <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button onclick="approveApplication('${app.id}')" class="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold" style="border-radius:6px;">
                Patvirtinti
            </button>
            <button onclick="openRejectModal('${app.id}')" class="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold" style="border-radius:6px;">
                Atmesti
            </button>
        </div>
    ` : '';

    const adminNote = app.admin_note ? `
        <div class="mt-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400" style="border-radius:6px;">
            <span class="font-medium">Pastaba:</span> ${escapeHtml(app.admin_note)}
        </div>
    ` : '';

    const reviewedInfo = reviewedDate ? `<span class="text-xs text-gray-400 ml-2">Peržiūrėta: ${reviewedDate}</span>` : '';

    return `
        <div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 p-5" style="border-radius:10px;">
            <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-sm font-bold flex-shrink-0" style="border-radius:50%;">
                        ${escapeHtml(creator.name ? creator.name.charAt(0).toUpperCase() : '?')}
                    </div>
                    <div>
                        <p class="font-semibold text-gray-900 dark:text-white">${escapeHtml(creator.name || 'Nežinomas')}</p>
                        <p class="text-xs text-gray-400">${escapeHtml(categoryName)} &middot; ${date}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${statusBadge}
                    ${reviewedInfo}
                </div>
            </div>

            <div class="mt-4 space-y-2">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-medium text-gray-400 uppercase w-20 flex-shrink-0">Portfolio</span>
                    <a href="${safeUrl(app.portfolio_url) || '#'}" target="_blank" rel="noopener" class="text-sm text-primary hover:underline truncate">${escapeHtml(app.portfolio_url || '—')}</a>
                </div>
                ${app.message ? `
                <div class="flex items-start gap-2">
                    <span class="text-xs font-medium text-gray-400 uppercase w-20 flex-shrink-0 pt-0.5">Žinutė</span>
                    <p class="text-sm text-gray-600 dark:text-gray-300">${escapeHtml(app.message)}</p>
                </div>
                ` : ''}
            </div>

            ${adminNote}
            ${actions}
        </div>
    `;
}

// ---- Approve application ----
async function approveApplication(appId) {
    const { error } = await supabase
        .from('badge_applications')
        .update({
            status: 'approved',
            reviewed_at: new Date().toISOString()
        })
        .eq('id', appId);

    if (error) {
        alert('Klaida: ' + error.message);
        return;
    }

    // Also activate the quality badge for this creator
    const { data: app } = await supabase
        .from('badge_applications')
        .select('creator_id')
        .eq('id', appId)
        .single();

    if (app) {
        await supabase
            .from('creator_badges')
            .upsert({
                creator_id: app.creator_id,
                badge_type: 'quality',
                active: true,
                purchased_at: new Date().toISOString(),
                expires_at: null // permanent for approved applications
            }, { onConflict: 'creator_id,badge_type' });
    }

    await loadApplications();
}

// ---- Reject modal ----
function openRejectModal(appId) {
    rejectingAppId = appId;
    document.getElementById('reject-note').value = '';
    const title = document.getElementById('reject-modal-title');
    if (title) title.textContent = 'Atmesti paraišką';
    const modal = document.getElementById('reject-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('confirm-reject-btn').onclick = () => rejectApplication();
}

function closeRejectModal() {
    rejectingAppId = null;
    const modal = document.getElementById('reject-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function rejectApplication() {
    if (!rejectingAppId) return;

    const note = document.getElementById('reject-note').value.trim();

    const { error } = await supabase
        .from('badge_applications')
        .update({
            status: 'rejected',
            admin_note: note || null,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', rejectingAppId);

    if (error) {
        alert('Klaida: ' + error.message);
        return;
    }

    closeRejectModal();
    await loadApplications();
}

// ==========================================
// ---- Listings moderation ----
// ==========================================

function setupListingsFilters() {
    document.querySelectorAll('.listings-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.listings-filter').forEach(b => {
                b.classList.remove('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
                b.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            });
            btn.classList.add('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');

            currentListingsFilter = btn.dataset.status;
            loadListings();
        });
    });
}

// ==========================================
// Contact messages (kontaktai.html form)
// ==========================================

function setupMessagesFilters() {
    document.querySelectorAll('.messages-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.messages-filter').forEach(b => {
                b.classList.remove('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
                b.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            });
            btn.classList.add('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');

            currentMessagesFilter = btn.dataset.status;
            loadMessages();
        });
    });
}

async function loadMessagesCount() {
    const { count } = await supabase
        .from('contact_messages')
        .select('id', { count: 'exact', head: true })
        .eq('handled', false);
    const el = document.getElementById('messages-count');
    if (el) el.textContent = count > 0 ? count : '';
}

async function loadMessages() {
    const container = document.getElementById('messages-list');
    container.innerHTML = '<div class="text-center py-12 text-gray-400">Kraunama...</div>';

    let query = supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

    if (currentMessagesFilter === 'unhandled') query = query.eq('handled', false);
    else if (currentMessagesFilter === 'handled') query = query.eq('handled', true);

    const { data: messages, error } = await query;

    if (error) {
        container.innerHTML = `
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-5" style="border-radius:10px;">
                <p class="text-red-600 dark:text-red-400 font-semibold text-sm mb-2">Klaida kraunant žinutes</p>
                <p class="text-red-500 text-xs font-mono">${error.message}</p>
            </div>`;
        return;
    }

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-400 dark:text-gray-500">Žinučių nėra</div>';
        return;
    }

    container.innerHTML = messages.map(renderMessage).join('');
}

function renderMessage(m) {
    const date = new Date(m.created_at).toLocaleString('lt-LT', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const name = escapeHtml(m.name || '—');
    const email = escapeHtml(m.email || '');
    const body = escapeHtml(m.message || '').replace(/\n/g, '<br>');

    const badge = m.handled
        ? '<span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold" style="border-radius:10px;">Atsakyta</span>'
        : '<span class="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-semibold" style="border-radius:10px;">Nauja</span>';

    const action = m.handled
        ? `<button onclick="markMessageHandled('${m.id}', false)" class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium">Pažymėti kaip naują</button>`
        : `<button onclick="markMessageHandled('${m.id}', true)" class="text-sm text-primary hover:underline font-semibold">Pažymėti atsakyta</button>`;

    return `
        <div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 p-5" style="border-radius:12px;">
            <div class="flex items-start justify-between gap-4 mb-3">
                <div>
                    <p class="font-semibold text-gray-900 dark:text-white">${name}</p>
                    <a href="mailto:${email}" class="text-sm text-primary hover:underline">${email}</a>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0">
                    ${badge}
                    <span class="text-xs text-gray-400 dark:text-gray-500">${date}</span>
                </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">${body}</p>
            <div class="flex items-center gap-4 pt-3 border-t border-secondary dark:border-gray-700">
                <a href="mailto:${email}?subject=Re: Medijus užklausa" class="text-sm text-primary hover:underline font-semibold">Atsakyti el. paštu</a>
                ${action}
            </div>
        </div>`;
}

async function markMessageHandled(id, handled) {
    const { error } = await supabase
        .from('contact_messages')
        .update({ handled })
        .eq('id', id);
    if (error) {
        alert('Klaida: ' + error.message);
        return;
    }
    await loadMessages();
    await loadMessagesCount();
}

async function loadListingsPendingCount() {
    const { count } = await supabase
        .from('creators')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
    const el = document.getElementById('listings-pending-count');
    if (el) el.textContent = count > 0 ? count : '';
}

async function loadListings() {
    const container = document.getElementById('listings-list');
    container.innerHTML = '<div class="text-center py-12 text-gray-400">Kraunama...</div>';

    let query = supabase
        .from('creators')
        .select('*, creator_categories(categories(name))')
        .order('created_at', { ascending: false });

    if (currentListingsFilter !== 'all') {
        query = query.eq('status', currentListingsFilter);
    }

    const { data: listings, error } = await query;

    if (error) {
        container.innerHTML = `
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-5" style="border-radius:10px;">
                <p class="text-red-600 dark:text-red-400 font-semibold text-sm mb-2">Klaida kraunant skelbimus</p>
                <p class="text-red-500 text-xs font-mono">${error.message}</p>
            </div>
        `;
        return;
    }

    await loadListingsPendingCount();

    if (!listings || listings.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-400 dark:text-gray-500">Nėra skelbimų</div>';
        return;
    }

    container.innerHTML = listings.map(renderListing).join('');
}

function renderListing(l) {
    const cats = (l.creator_categories || [])
        .map(cc => cc.categories?.name)
        .filter(Boolean)
        .join(', ');
    const date = new Date(l.created_at).toLocaleDateString('lt-LT', { year: 'numeric', month: 'long', day: 'numeric' });
    const reviewedDate = l.reviewed_at ? new Date(l.reviewed_at).toLocaleDateString('lt-LT') : '';

    const statusBadge = {
        pending:  '<span class="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold" style="border-radius:4px;">Laukia</span>',
        approved: '<span class="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold" style="border-radius:4px;">Patvirtinta</span>',
        rejected: '<span class="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold" style="border-radius:4px;">Atmesta</span>',
    }[l.status] || '';

    const actions = l.status === 'pending' ? `
        <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <a href="kurejas.html#id=${l.id}" target="_blank" class="py-2 px-4 border border-secondary dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700" style="border-radius:6px;">Peržiūrėti</a>
            <button onclick="approveListing('${l.id}')" class="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold" style="border-radius:6px;">Patvirtinti</button>
            <button onclick="openRejectListingModal('${l.id}')" class="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold" style="border-radius:6px;">Atmesti</button>
        </div>
    ` : `
        <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <a href="kurejas.html#id=${l.id}" target="_blank" class="py-2 px-4 border border-secondary dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700" style="border-radius:6px;">Peržiūrėti</a>
            ${l.status === 'rejected' ? `<button onclick="approveListing('${l.id}')" class="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold" style="border-radius:6px;">Patvirtinti</button>` : ''}
            ${l.status === 'approved' ? `<button onclick="openRejectListingModal('${l.id}')" class="py-2 px-4 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold" style="border-radius:6px;">Atmesti</button>` : ''}
        </div>
    `;

    const adminNote = l.admin_note ? `
        <div class="mt-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400" style="border-radius:6px;">
            <span class="font-medium">Atmetimo priežastis:</span> ${escapeHtml(l.admin_note)}
        </div>
    ` : '';

    const reviewedInfo = reviewedDate ? `<span class="text-xs text-gray-400 ml-2">Peržiūrėta: ${reviewedDate}</span>` : '';

    const avatar = l.image_url
        ? `<img src="${safeUrl(l.image_url)}" loading="lazy" decoding="async" class="w-12 h-12 object-cover flex-shrink-0" style="border-radius:8px;" alt="">`
        : `<div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-sm font-bold flex-shrink-0" style="border-radius:8px;">${escapeHtml(l.name ? l.name.charAt(0).toUpperCase() : '?')}</div>`;

    return `
        <div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 p-5" style="border-radius:10px;">
            <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3">
                    ${avatar}
                    <div>
                        <p class="font-semibold text-gray-900 dark:text-white">${escapeHtml(l.name || 'Be vardo')}</p>
                        <p class="text-xs text-gray-400">${escapeHtml(l.role || '—')}${l.location ? ' · ' + escapeHtml(l.location) : ''} · ${date}</p>
                        ${cats ? `<p class="text-xs text-gray-400 mt-0.5">Kategorijos: ${escapeHtml(cats)}</p>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    ${statusBadge}
                    ${reviewedInfo}
                </div>
            </div>

            ${l.bio ? `
            <div class="mt-3 text-sm text-gray-600 dark:text-gray-300">
                ${escapeHtml(l.bio)}
            </div>
            ` : ''}

            <div class="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>Kaina: <span class="font-medium text-gray-900 dark:text-white">${escapeHtml(l.price_label || '—')}</span></span>
            </div>

            ${adminNote}
            ${actions}
        </div>
    `;
}

async function approveListing(id) {
    const { error } = await supabase
        .from('creators')
        .update({
            status: 'approved',
            admin_note: null,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) {
        alert('Klaida: ' + error.message);
        return;
    }

    await loadListings();
}

function openRejectListingModal(id) {
    rejectingListingId = id;
    document.getElementById('reject-note').value = '';
    const title = document.getElementById('reject-modal-title');
    if (title) title.textContent = 'Atmesti skelbimą';
    const modal = document.getElementById('reject-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('confirm-reject-btn').onclick = () => rejectListing();
}

async function rejectListing() {
    if (!rejectingListingId) return;

    const note = document.getElementById('reject-note').value.trim();

    const { error } = await supabase
        .from('creators')
        .update({
            status: 'rejected',
            admin_note: note || null,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', rejectingListingId);

    if (error) {
        alert('Klaida: ' + error.message);
        return;
    }

    rejectingListingId = null;
    closeRejectModal();
    await loadListings();
}

// ---- Load subscriptions overview ----
async function loadSubscriptions() {
    const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        document.getElementById('subscriptions-list').innerHTML = `<div class="text-center py-12 text-red-500">Klaida: ${error.message}</div>`;
        return;
    }

    if (!subs) return;

    // Stats
    const activeTrials = subs.filter(s => s.plan === 'trial' && s.status === 'active').length;
    const activePro = subs.filter(s => s.plan === 'pro' && s.status === 'active').length;
    const expired = subs.filter(s => s.status === 'expired').length;

    document.getElementById('stat-trials').textContent = activeTrials;
    document.getElementById('stat-pro').textContent = activePro;
    document.getElementById('stat-expired').textContent = expired;

    // List
    const container = document.getElementById('subscriptions-list');
    if (subs.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-gray-400">Nėra prenumeratų</div>';
        return;
    }

    container.innerHTML = subs.map(sub => {
        const planLabel = sub.plan === 'pro' ? 'Pro' : 'Trial';
        const statusColor = sub.status === 'active' ? 'emerald' : 'gray';
        const date = new Date(sub.created_at).toLocaleDateString('lt-LT');

        let endDate = '';
        if (sub.plan === 'trial' && sub.trial_ends_at) {
            endDate = new Date(sub.trial_ends_at).toLocaleDateString('lt-LT');
        } else if (sub.plan === 'pro' && sub.paid_ends_at) {
            endDate = new Date(sub.paid_ends_at).toLocaleDateString('lt-LT');
        }

        return `
            <div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 px-5 py-3 flex items-center justify-between" style="border-radius:8px;">
                <div class="flex items-center gap-3">
                    <div>
                        <p class="font-medium text-gray-900 dark:text-white text-sm">${escapeHtml(sub.user_id?.slice(0, 8) || 'Vartotojas')}</p>
                        <p class="text-xs text-gray-400">${date}${sub.ip_address ? ' &middot; IP: ' + escapeHtml(sub.ip_address) : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="px-2 py-1 bg-${statusColor}-100 dark:bg-${statusColor}-900/30 text-${statusColor}-600 dark:text-${statusColor}-400 text-xs font-bold" style="border-radius:4px;">${planLabel}</span>
                    <span class="text-xs text-gray-400">${sub.status === 'active' ? 'iki ' + endDate : sub.status}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ---- Analytics ----
async function loadAnalytics() {
    await Promise.all([
        loadConversionFunnel(),
        loadTrialAlerts(),
        loadRevenueOverview(),
    ]);
}

async function loadConversionFunnel() {
    const container = document.getElementById('funnel-bars');

    // Fetch counts in parallel
    const [profilesRes, creatorsRes, trialsRes, proRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('creators').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('plan', 'trial'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('plan', 'pro'),
    ]);

    const steps = [
        { label: 'Registracijos', count: profilesRes.count || 0, color: 'bg-blue-400' },
        { label: 'Kūrėjų profiliai', count: creatorsRes.count || 0, color: 'bg-indigo-400' },
        { label: 'Trial pradėję', count: trialsRes.count || 0, color: 'bg-yellow-400' },
        { label: 'Pro prenumeratos', count: proRes.count || 0, color: 'bg-emerald-400' },
    ];

    const maxCount = Math.max(...steps.map(s => s.count), 1);

    container.innerHTML = steps.map(step => {
        const heightPct = Math.max((step.count / maxCount) * 100, 8);
        const stepIdx = steps.indexOf(step);
        const prevStep = stepIdx > 0 ? steps[stepIdx - 1] : null;
        const convRate = prevStep && prevStep.count > 0
            ? Math.min(Math.round((step.count / prevStep.count) * 100), 100)
            : null;

        return `
            <div class="flex-1 flex flex-col items-center gap-2">
                <span class="text-2xl font-bold text-gray-900 dark:text-white">${step.count}</span>
                <div class="w-full ${step.color} transition-all duration-500" style="height:${heightPct}px; min-height:8px; border-radius:6px 6px 0 0;"></div>
                <span class="text-xs font-medium text-gray-600 dark:text-gray-400 text-center">${step.label}</span>
                ${convRate !== null ? `<span class="text-xs text-gray-400">${convRate}%</span>` : '<span class="text-xs text-transparent">-</span>'}
            </div>
        `;
    }).join(`
        <div class="flex items-center text-gray-300 dark:text-gray-600 text-lg pb-8">→</div>
    `);
}

async function loadTrialAlerts() {
    const container = document.getElementById('trial-alerts');
    const countEl = document.getElementById('expiring-count');

    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiring, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('plan', 'trial')
        .eq('status', 'active')
        .lte('trial_ends_at', threeDaysFromNow)
        .order('trial_ends_at', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="text-red-500 text-sm p-4">Klaida: ${escapeHtml(error.message)}</div>`;
        return;
    }

    countEl.textContent = expiring && expiring.length > 0 ? expiring.length : '';

    if (!expiring || expiring.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400 dark:text-gray-500">Nėra baigiančių trial per 3 dienas</div>';
        return;
    }

    container.innerHTML = expiring.map(sub => {
        const endsAt = new Date(sub.trial_ends_at);
        const now = new Date();
        const daysLeft = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24));
        const isExpired = daysLeft <= 0;
        const urgency = isExpired ? 'red' : daysLeft <= 1 ? 'orange' : 'yellow';

        return `
            <div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 px-5 py-3 flex items-center justify-between" style="border-radius:8px;">
                <div>
                    <p class="font-medium text-gray-900 dark:text-white text-sm">${escapeHtml(sub.user_id?.slice(0, 8) || 'Vartotojas')}</p>
                    <p class="text-xs text-gray-400">Baigiasi: ${endsAt.toLocaleDateString('lt-LT')}</p>
                </div>
                <span class="px-3 py-1 bg-${urgency}-100 dark:bg-${urgency}-900/30 text-${urgency}-600 dark:text-${urgency}-400 text-xs font-bold" style="border-radius:4px;">
                    ${isExpired ? 'Pasibaigė' : daysLeft === 1 ? 'Liko 1 diena' : `Liko ${daysLeft} d.`}
                </span>
            </div>
        `;
    }).join('');
}

async function loadRevenueOverview() {
    const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('plan', 'pro')
        .order('created_at', { ascending: false });

    if (error) {
        document.getElementById('revenue-list').innerHTML = `<div class="text-red-500 text-sm p-4">Klaida: ${escapeHtml(error.message)}</div>`;
        return;
    }

    const proSubs = subs || [];
    const activePro = proSubs.filter(s => s.status === 'active');

    // Business model: €10/mo, €5 with review discount
    const fullPrice = 10;
    const discountedPrice = 5;

    // MRR = active pro * price (assume full price unless has_discount flag)
    const mrr = activePro.reduce((sum, s) => {
        return sum + (s.discount_applied ? discountedPrice : fullPrice);
    }, 0);

    // Total revenue = all pro subs * price (simplified — real calculation would use payment records)
    const totalRevenue = proSubs.reduce((sum, s) => {
        return sum + (s.discount_applied ? discountedPrice : fullPrice);
    }, 0);

    const discountedCount = proSubs.filter(s => s.discount_applied).length;

    document.getElementById('stat-mrr').textContent = `€${mrr}`;
    document.getElementById('stat-total-revenue').textContent = `€${totalRevenue}`;
    document.getElementById('stat-discounted').textContent = discountedCount > 0 ? `${discountedCount} vnt.` : '0';

    const container = document.getElementById('revenue-list');

    if (proSubs.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400 dark:text-gray-500">Dar nėra Pro prenumeratų</div>';
        return;
    }

    container.innerHTML = proSubs.map(sub => {
        const date = new Date(sub.created_at).toLocaleDateString('lt-LT');
        const price = sub.discount_applied ? discountedPrice : fullPrice;
        const statusColor = sub.status === 'active' ? 'emerald' : 'gray';

        return `
            <div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 px-5 py-3 flex items-center justify-between" style="border-radius:8px;">
                <div>
                    <p class="font-medium text-gray-900 dark:text-white text-sm">${escapeHtml(sub.user_id?.slice(0, 8) || 'Vartotojas')}</p>
                    <p class="text-xs text-gray-400">${date}${sub.discount_applied ? ' · su nuolaida' : ''}</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-bold text-gray-900 dark:text-white text-sm">€${price}/mėn</span>
                    <span class="px-2 py-1 bg-${statusColor}-100 dark:bg-${statusColor}-900/30 text-${statusColor}-600 dark:text-${statusColor}-400 text-xs font-bold" style="border-radius:4px;">
                        ${sub.status === 'active' ? 'Aktyvus' : 'Neaktyvus'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// ---- Disputes (escrow) ----
async function loadEscrowSummary() {
    const { data: rows, error } = await supabase
        .from('orders')
        .select('status, amount_cents, platform_fee_cents')
        .in('status', ['paid', 'delivered', 'rejected', 'disputed', 'approved', 'released']);

    if (error) { console.warn('escrow summary error', error); return; }

    const buckets = {
        paid: { count: 0, cents: 0 },
        delivered: { count: 0, cents: 0 },
        disputed: { count: 0, cents: 0 },
        escrowTotal: { count: 0, cents: 0 },
        feeEarned: { count: 0, cents: 0 },
        feePending: { count: 0, cents: 0 },
    };

    const ESCROW_STATUSES = new Set(['paid', 'delivered', 'rejected', 'disputed']);
    const EARNED_STATUSES = new Set(['approved', 'released']);

    (rows || []).forEach(r => {
        const cents = r.amount_cents || 0;
        const fee = r.platform_fee_cents || 0;

        if (ESCROW_STATUSES.has(r.status)) {
            buckets.escrowTotal.count++;
            buckets.escrowTotal.cents += cents;
            buckets.feePending.count++;
            buckets.feePending.cents += fee;

            if (r.status === 'paid') {
                buckets.paid.count++;
                buckets.paid.cents += cents;
            } else if (r.status === 'delivered') {
                buckets.delivered.count++;
                buckets.delivered.cents += cents;
            } else {
                buckets.disputed.count++;
                buckets.disputed.cents += cents;
            }
        } else if (EARNED_STATUSES.has(r.status)) {
            buckets.feeEarned.count++;
            buckets.feeEarned.cents += fee;
        }
    });

    const fmt = c => '€' + (c / 100).toFixed(2);
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setText('escrow-total', fmt(buckets.escrowTotal.cents));
    setText('escrow-total-count', `${buckets.escrowTotal.count} užsakymų`);
    setText('escrow-paid', fmt(buckets.paid.cents));
    setText('escrow-paid-count', `${buckets.paid.count} užsakymų`);
    setText('escrow-delivered', fmt(buckets.delivered.cents));
    setText('escrow-delivered-count', `${buckets.delivered.count} užsakymų`);
    setText('escrow-disputed', fmt(buckets.disputed.cents));
    setText('escrow-disputed-count', `${buckets.disputed.count} užsakymų`);

    setText('fee-earned', fmt(buckets.feeEarned.cents));
    setText('fee-earned-count', `${buckets.feeEarned.count} užsakymų`);
    setText('fee-pending', fmt(buckets.feePending.cents));
    setText('fee-pending-count', `${buckets.feePending.count} užsakymų`);
    setText('fee-total', fmt(buckets.feeEarned.cents + buckets.feePending.cents));
    setText('fee-total-count', `${buckets.feeEarned.count + buckets.feePending.count} užsakymų`);
}

async function loadDisputes() {
    loadEscrowSummary(); // fire-and-forget, fills summary cards

    const container = document.getElementById('disputes-list');
    container.innerHTML = '<div class="text-center py-12 text-gray-400">Kraunama...</div>';

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, creators(id, name, user_id)')
        .in('status', ['rejected', 'disputed'])
        .order('rejected_at', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="text-red-500 p-4">Klaida: ${escapeHtml(error.message)}</div>`;
        return;
    }

    if (!orders || orders.length === 0) {
        const countEl0 = document.getElementById('disputes-count');
        if (countEl0) { countEl0.textContent = '0'; countEl0.style.display = 'none'; }
    }
    if (!orders || orders.length === 0) {
        container.innerHTML = `<div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 p-8 text-center" style="border-radius:8px;">
            <p class="text-sm text-gray-500 dark:text-gray-400">Šiuo metu ginčų nėra. 👍</p>
        </div>`;
        return;
    }

    container.innerHTML = orders.map(o => {
        const amount = (o.amount_cents != null) ? (o.amount_cents / 100).toFixed(2) : Number(o.amount || 0).toFixed(2);
        const creatorPart = (o.amount_cents != null) ? ((o.amount_cents - (o.platform_fee_cents || 0)) / 100).toFixed(2) : '?';
        const isDisputed = o.status === 'disputed';
        const statusBadge = isDisputed
            ? '<span class="px-2 py-1 text-[11px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" style="border-radius:4px;">GINČAS (eskaluota)</span>'
            : '<span class="px-2 py-1 text-[11px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" style="border-radius:4px;">ATMESTA</span>';
        const borderCls = isDisputed ? 'border-red-200 dark:border-red-900' : 'border-orange-200 dark:border-orange-900';
        const deadlineInfo = !isDisputed && o.resolution_deadline ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-eskalavimas: ${new Date(o.resolution_deadline).toLocaleString('lt-LT')}</p>` : '';

        return `
        <div class="bg-white dark:bg-gray-800 border ${borderCls} p-5" style="border-radius:8px;">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h4 class="font-bold text-gray-900 dark:text-white">${escapeHtml(o.service_name || 'Paslauga')}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Kūrėjas: ${escapeHtml(o.creators?.name || '—')} • €${amount} • Order ID: ${escapeHtml(o.id)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pristatyta: ${o.delivered_at ? new Date(o.delivered_at).toLocaleString('lt-LT') : '—'} • Atmesta: ${o.rejected_at ? new Date(o.rejected_at).toLocaleString('lt-LT') : '—'}</p>
                    ${deadlineInfo}
                </div>
                ${statusBadge}
            </div>

            ${o.rejection_reason ? `
                <div class="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-sm" style="border-radius:6px;">
                    <strong class="text-orange-700 dark:text-orange-400">Kliento atmetimo priežastis:</strong>
                    <p class="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">${escapeHtml(o.rejection_reason)}</p>
                </div>` : ''}

            <div class="mt-4 flex flex-col sm:flex-row gap-2">
                <button onclick="openDisputeChat('${escapeHtml(o.user_id)}', '${escapeHtml(o.creator_id)}', '${escapeHtml(o.creators?.name || '')}')" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold cursor-pointer flex items-center gap-1.5" style="border-radius:4px;">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    Žiūrėti pokalbį
                </button>
                <button onclick="resolveDispute('${escapeHtml(o.id)}', 'refund')" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">
                    Grąžinti klientui (€${amount})
                </button>
                <button onclick="resolveDispute('${escapeHtml(o.id)}', 'release')" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">
                    Atiduoti kūrėjui (€${creatorPart})
                </button>
            </div>
        </div>`;
    }).join('');

    // Update count badge — only show disputed (escalated) ones as urgent
    const disputedCount = (orders || []).filter(o => o.status === 'disputed').length;
    const countEl = document.getElementById('disputes-count');
    if (countEl) {
        countEl.textContent = String(disputedCount || 0);
        countEl.style.display = disputedCount === 0 ? 'none' : '';
    }
}

async function openDisputeChat(clientUserId, creatorId, creatorName) {
    let modal = document.getElementById('admin-chat-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-chat-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-900 max-w-2xl w-full max-h-[80vh] flex flex-col" style="border-radius:8px;">
                <div class="flex items-center justify-between p-4 border-b border-secondary dark:border-gray-700">
                    <h3 class="font-bold text-gray-900 dark:text-white">Pokalbis: <span id="admin-chat-creator-name"></span></h3>
                    <button id="admin-chat-close" class="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div id="admin-chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
                    <p class="text-sm text-gray-400 text-center">Kraunama...</p>
                </div>
            </div>`;
        document.body.appendChild(modal);
        document.getElementById('admin-chat-close').addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
    }
    modal.classList.remove('hidden');
    document.getElementById('admin-chat-creator-name').textContent = creatorName || '—';
    const msgsEl = document.getElementById('admin-chat-messages');
    msgsEl.innerHTML = '<p class="text-sm text-gray-400 text-center">Kraunama...</p>';

    const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id, client_id, creator_id')
        .eq('client_id', clientUserId)
        .eq('creator_id', creatorId)
        .limit(1);

    if (convErr || !convs?.length) {
        msgsEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Pokalbio dar nėra arba nepavyko užkrauti.</p>';
        return;
    }

    const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', convs[0].id)
        .order('created_at', { ascending: true });

    if (!messages?.length) {
        msgsEl.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Nieko nerasta šiame pokalbyje.</p>';
        return;
    }

    msgsEl.innerHTML = messages.map(m => {
        const fromClient = m.sender_id === clientUserId;
        const align = fromClient ? 'justify-start' : 'justify-end';
        const bubble = fromClient
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'bg-primary/20 text-gray-900 dark:text-white';
        const label = fromClient ? 'Klientas' : 'Kūrėjas';
        const time = new Date(m.created_at).toLocaleString('lt-LT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `
            <div class="flex ${align}">
                <div class="max-w-[80%]">
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 ${fromClient ? '' : 'text-right'}">${label} • ${time}</p>
                    <div class="px-3 py-2 ${bubble} text-sm whitespace-pre-wrap" style="border-radius:8px;">${escapeHtml(m.content || '')}</div>
                </div>
            </div>`;
    }).join('');
    msgsEl.scrollTop = msgsEl.scrollHeight;
}

async function resolveDispute(orderId, resolution) {
    const label = resolution === 'refund' ? 'GRĄŽINTI KLIENTUI' : 'ATIDUOTI KŪRĖJUI';
    const notes = prompt(`Sprendimas: ${label}\n\nĮveskite sprendimo pastabas (privaloma, bus išsaugotos):`);
    if (!notes || notes.trim().length < 5) {
        alert('Pastabos privalomos (min 5 simboliai).');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert('Sesija pasibaigė.');
        return;
    }

    try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/order-admin-resolve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ order_id: orderId, resolution, notes }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error) throw new Error(result.error || 'Klaida');
        alert('Sprendimas pritaikytas. ✓');
        loadDisputes();
    } catch (err) {
        alert('Klaida: ' + err.message);
    }
}

// ---- Portfolio links moderation ----
let currentPortfolioLinkFilter = 'pending';

function setupPortfolioLinkFilters() {
    document.querySelectorAll('.portfolio-link-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.portfolio-link-filter').forEach(b => {
                b.classList.remove('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
                b.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            });
            btn.classList.add('active', 'bg-yellow-100', 'dark:bg-yellow-900/30', 'text-yellow-700', 'dark:text-yellow-400');
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
            currentPortfolioLinkFilter = btn.dataset.status;
            loadPortfolioLinks();
        });
    });
}

async function loadPortfolioLinks() {
    const container = document.getElementById('portfolio-links-list');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-12 text-gray-400">Kraunama...</div>';

    const { data: creators, error } = await supabase
        .from('creators')
        .select('id, name, external_portfolio_url, external_portfolio_status, external_portfolio_submitted_at, external_portfolio_admin_note')
        .eq('external_portfolio_status', currentPortfolioLinkFilter)
        .not('external_portfolio_url', 'is', null)
        .order('external_portfolio_submitted_at', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="text-red-500 p-4">Klaida: ${escapeHtml(error.message)}</div>`;
        return;
    }

    // Update count
    const { count: pendingCount } = await supabase
        .from('creators')
        .select('id', { count: 'exact', head: true })
        .eq('external_portfolio_status', 'pending');
    const countEl = document.getElementById('portfolio-links-count');
    if (countEl) {
        countEl.textContent = String(pendingCount || 0);
        countEl.style.display = (pendingCount || 0) === 0 ? 'none' : '';
    }

    if (!creators || creators.length === 0) {
        container.innerHTML = `<div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 p-8 text-center" style="border-radius:8px;">
            <p class="text-sm text-gray-500 dark:text-gray-400">Nieko nėra šiame filtre.</p>
        </div>`;
        return;
    }

    container.innerHTML = creators.map(c => {
        const submitted = c.external_portfolio_submitted_at ? new Date(c.external_portfolio_submitted_at).toLocaleString('lt-LT') : '—';
        const actions = currentPortfolioLinkFilter === 'pending' ? `
            <div class="flex gap-2 mt-3">
                <button onclick="resolvePortfolioLink('${escapeHtml(c.id)}', 'approved')" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">✓ Patvirtinti</button>
                <button onclick="resolvePortfolioLink('${escapeHtml(c.id)}', 'rejected')" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold cursor-pointer" style="border-radius:4px;">✗ Atmesti</button>
            </div>` : '';
        const note = c.external_portfolio_admin_note ? `
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2"><strong>Admin pastaba:</strong> ${escapeHtml(c.external_portfolio_admin_note)}</p>` : '';
        return `
            <div class="bg-white dark:bg-gray-800 border border-secondary dark:border-gray-700 p-4" style="border-radius:8px;">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(c.name || 'Be vardo')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Pateikta: ${submitted}</p>
                        <a href="${escapeHtml(c.external_portfolio_url)}" target="_blank" rel="noopener noreferrer" class="block mt-2 text-sm text-primary hover:underline truncate">${escapeHtml(c.external_portfolio_url)} ↗</a>
                        ${note}
                        ${actions}
                    </div>
                    <a href="kurejas.html?id=${escapeHtml(c.id)}" target="_blank" class="text-xs text-gray-500 dark:text-gray-400 hover:text-primary whitespace-nowrap">Žiūrėti kūrėjo profilį →</a>
                </div>
            </div>`;
    }).join('');
}

async function loadPortfolioLinksPendingCount() {
    const { count } = await supabase
        .from('creators')
        .select('id', { count: 'exact', head: true })
        .eq('external_portfolio_status', 'pending');
    const el = document.getElementById('portfolio-links-count');
    if (el) {
        el.textContent = String(count || 0);
        el.style.display = (count || 0) === 0 ? 'none' : '';
    }
}

async function resolvePortfolioLink(creatorId, status) {
    let note = null;
    if (status === 'rejected') {
        note = prompt('Atmetimo priežastis (matys kūrėjas, privaloma):');
        if (!note || note.trim().length < 3) {
            alert('Priežastis privaloma.');
            return;
        }
    }
    const { error } = await supabase.from('creators').update({
        external_portfolio_status: status,
        external_portfolio_reviewed_at: new Date().toISOString(),
        external_portfolio_admin_note: note,
    }).eq('id', creatorId);
    if (error) { alert('Klaida: ' + error.message); return; }
    loadPortfolioLinks();
}

// ---- Utility ----
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
