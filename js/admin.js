// =============================================
// Artifex Admin Panel
// =============================================

const ADMIN_EMAILS = ['kkleivaarnas@gmail.com'];

let currentFilter = 'pending';
let rejectingAppId = null;
let currentListingsFilter = 'pending';
let rejectingListingId = null;

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
    // Listen for auth state — catches session restore + login
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, '| email:', session?.user?.email);

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
        console.log('Setting up filters...');
        setupFilters();
        setupListingsFilters();

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
            document.getElementById('tab-analytics').classList.toggle('hidden', tabName !== 'analytics');

            if (tabName === 'listings') loadListings();
            if (tabName === 'applications') loadApplications();
            if (tabName === 'subscriptions') loadSubscriptions();
            if (tabName === 'analytics') loadAnalytics();
        });
    });
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
        ? `<img src="${safeUrl(l.image_url)}" class="w-12 h-12 object-cover flex-shrink-0" style="border-radius:8px;" alt="">`
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

// ---- Utility ----
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
