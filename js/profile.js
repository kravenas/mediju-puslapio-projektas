// =============================================
// Artifex Profile Page Module
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
            'profile-form-phone': profile.phone || '',
            'profile-form-website': profile.website || '',
            'profile-form-instagram': profile.social_instagram || '',
            'profile-form-facebook': profile.social_facebook || '',
            'profile-form-linkedin': profile.social_linkedin || '',
            'profile-form-youtube': profile.social_youtube || ''
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
        const website = qs('#profile-form-website')?.value || '';
        const initial = name.charAt(0).toUpperCase();
        const role = currentProfile?.role || currentUser?.user_metadata?.role || 'klientas';
        const roleLt = isCreatorRole(role) ? 'Kūrėjas' : 'Klientas';
        const avatarUrl = currentProfile?.avatar_url;

        const previewEl = qs('#profile-preview');
        if (!previewEl) return;

        const websiteUrl = website ? (website.startsWith('http') ? website : 'https://' + website) : '';
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
                ${website ? `
                    <a href="${safeUrl(websiteUrl)}" target="_blank" class="text-sm text-primary hover:underline mt-1 inline-block">${escapeHtml(website.replace(/^https?:\/\//, ''))}</a>
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

        let servicesInitialized = false;

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
                phone: qs('#profile-form-phone')?.value?.trim() || null,
                website: qs('#profile-form-website')?.value?.trim() || null,
                social_instagram: qs('#profile-form-instagram')?.value?.trim() || null,
                social_facebook: qs('#profile-form-facebook')?.value?.trim() || null,
                social_linkedin: qs('#profile-form-linkedin')?.value?.trim() || null,
                social_youtube: qs('#profile-form-youtube')?.value?.trim() || null
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
        const viewsEl = qs('#stat-views');
        const ordersEl = qs('#stat-orders');

        if (creatorData) {
            if (ratingEl) ratingEl.textContent = creatorData.rating || '0.0';
            if (reviewsEl) reviewsEl.textContent = creatorData.review_count || '0';
            if (viewsEl) viewsEl.textContent = '—';
            if (ordersEl) ordersEl.textContent = '—';

            renderReviews(creatorData.reviews || []);
        } else {
            if (ratingEl) ratingEl.textContent = '—';
            if (reviewsEl) reviewsEl.textContent = '0';
            if (viewsEl) viewsEl.textContent = '—';
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

        container.innerHTML = sorted.map(r => `
            <div class="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div class="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <span class="text-sm font-semibold text-gray-600 dark:text-gray-300">${(r.author_name || '?').charAt(0)}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="font-medium text-sm text-gray-900 dark:text-white">${r.author_name}</span>
                        <span class="text-xs text-gray-400">${formatDate(r.created_at)}</span>
                    </div>
                    <div class="flex gap-0.5 mt-0.5">
                        ${Array.from({ length: 5 }, (_, i) =>
                            `<svg class="w-3.5 h-3.5 ${i < r.rating ? 'text-primary' : 'text-gray-300 dark:text-gray-600'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`
                        ).join('')}
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">${r.content || ''}</p>
                </div>
            </div>
        `).join('');
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
        };
        for (const [id, val] of Object.entries(map)) {
            const el = qs(`#${id}`);
            if (el) el.value = val;
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

        const payload = {
            name:        creatorName,
            role,
            bio:         qs('#skel-bio')?.value?.trim()      || null,
            location:    qs('#skel-location')?.value?.trim() || null,
            price_from:  price,
            price_label: `Nuo €${price}`,
            image_url:   qs('#skel-image')?.value?.trim()    || null,
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
                    .insert({ ...payload, user_id: currentUser.id, is_rising_star: false, rating: 0, review_count: 0, status: 'pending' })
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
