// Public creator profile page

document.addEventListener('DOMContentLoaded', async () => {
    // Support both query params (?id=) and hash params (#id=)
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const creatorId = params.get('id') || hashParams.get('id');

    if (!creatorId) {
        showError('Nenurodytas kūrėjo ID.');
        return;
    }

    await loadProfile(creatorId);
});

const GRADIENTS = [
    'from-pink-500 to-rose-500',
    'from-purple-500 to-violet-600',
    'from-emerald-500 to-teal-600',
    'from-indigo-500 to-purple-600',
    'from-rose-500 to-red-500',
    'from-violet-500 to-purple-600',
];

function starSvg(filled) {
    const color = filled ? '#FFC50F' : '#D1D5DB';
    return `<svg width="16" height="16" viewBox="0 0 20 20" fill="${color}"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
}

function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) html += starSvg(i <= Math.round(rating));
    return html;
}

async function loadProfile(creatorId) {
    // Step 1: load creator basic data (no join first — to isolate errors)
    const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .select('*')
        .eq('id', creatorId)
        .maybeSingle();

    if (creatorError) {
        console.error('Creator query error:', creatorError);
        showError('Klaida kraunant profilį: ' + creatorError.message);
        return;
    }

    if (!creator) {
        showError('Kūrėjas su šiuo ID nerastas.');
        return;
    }

    if (creator.status !== 'approved') {
        const { data: { user } } = await supabase.auth.getUser();
        const isAdmin = user?.email === 'kkleivaarnas@gmail.com';
        if (!isAdmin) {
            showError('Kūrėjas su šiuo ID nerastas.');
            return;
        }
    }

    // Step 2: load creator categories separately
    const { data: catLinks } = await supabase
        .from('creator_categories')
        .select('categories(slug, name)')
        .eq('creator_id', creatorId);

    const categories = (catLinks || []).map(l => l.categories).filter(Boolean);

    // Step 3: load profile (only if user_id is set — seed data won't have it)
    let profile = null;
    if (creator.user_id) {
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', creator.user_id)
            .maybeSingle();
        profile = profileData;
    }

    // Update page title
    document.getElementById('page-title').textContent = `${creator.name} - Artifex`;

    // Hero background
    const hero = document.getElementById('profile-hero');
    if (creator.image_url) {
        hero.innerHTML = `<img src="${safeUrl(creator.image_url)}" alt="${escapeAttr(creator.name)}" class="profile-hero-img">` + hero.innerHTML;
    } else {
        const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
        hero.innerHTML = `<div class="profile-hero-gradient bg-gradient-to-br ${gradient}"></div>` + hero.innerHTML;
    }

    // Load badges
    const { data: badges } = await supabase
        .from('creator_badges')
        .select('badge_type')
        .eq('creator_id', creatorId)
        .eq('active', true);
    const badgeTypes = (badges || []).map(b => b.badge_type);

    // Name, role
    document.getElementById('creator-name').textContent = creator.name;
    document.getElementById('creator-role').textContent = creator.role || '';

    // Badges next to name
    const nameEl = document.getElementById('creator-name');
    if (badgeTypes.length > 0) {
        const badgeHtml = badgeTypes.map(t => {
            if (t === 'quality') return '<span title="Patikrinta kokybė" class="inline-flex items-center ml-2 align-middle"><svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg></span>';
            if (t === 'promoted') return '<span title="Reklamuojamas" class="inline-flex items-center ml-1 align-middle"><svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg></span>';
            return '';
        }).join('');
        nameEl.innerHTML = escapeHtml(creator.name) + badgeHtml;
    }

    // Rating
    const ratingRow = document.getElementById('creator-rating-row');
    if (creator.rating) {
        ratingRow.innerHTML = `
            <span class="flex">${renderStars(creator.rating)}</span>
            <span class="text-white font-bold text-sm">${escapeHtml(creator.rating)}</span>
            <span class="text-gray-300 text-sm">(${escapeHtml(creator.review_count || 0)} atsiliepim${(creator.review_count || 0) === 1 ? 'as' : 'ų'})</span>
        `;
    }

    // Location
    const loc = creator.location || profile?.location;
    if (loc) {
        document.getElementById('creator-location-row').innerHTML = `
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${escapeHtml(loc)}</span>
        `;
    }

    // Price badge
    if (creator.price_from) {
        document.getElementById('creator-price-badge').innerHTML = `
            <div class="text-gray-300 text-xs mb-0.5">Kaina nuo</div>
            <div class="text-white text-2xl font-bold">€${escapeHtml(creator.price_from)}</div>
            ${creator.price_label ? `<div class="text-gray-300 text-xs">${escapeHtml(creator.price_label)}</div>` : ''}
        `;
    }

    // Bio
    const bio = creator.bio || profile?.bio;
    if (bio) {
        document.getElementById('creator-bio').textContent = bio;
        document.getElementById('bio-section').classList.remove('hidden');
    }

    // Categories
    if (categories.length > 0) {
        document.getElementById('creator-categories').innerHTML = categories.map(c =>
            `<span class="category-badge">${escapeHtml(c.name)}</span>`
        ).join('');
        document.getElementById('categories-section').classList.remove('hidden');
    }

    // Profile info panel (from account settings)
    renderProfileInfoPanel(creator, profile);

    // Show content
    document.getElementById('profile-loading').classList.add('hidden');
    document.getElementById('profile-content').classList.remove('hidden');

    // Message button
    const msgBtn = document.getElementById('msg-creator-btn');
    if (msgBtn) {
        msgBtn.addEventListener('click', async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = 'prisijungimas.html';
                return;
            }
            window.location.href = `zinutes.html?creator_id=${creatorId}`;
        });
    }

    // Load services and reviews in parallel
    loadServices(creatorId, creator);
    loadReviews(creatorId);
}

function renderProfileInfoPanel(creator, profile) {
    const container = document.getElementById('profile-info-panel');
    if (!container) return;

    const rows = [];

    if (creator.role) {
        rows.push(['Profesija', escapeHtml(creator.role)]);
    }
    const loc = creator.location || profile?.location;
    if (loc) rows.push(['Miestas', escapeHtml(loc)]);
    if (creator.price_from) {
        rows.push(['Kaina nuo', `€${escapeHtml(creator.price_from)}${creator.price_label ? ' — ' + escapeHtml(creator.price_label) : ''}`]);
    }
    if (profile?.phone) rows.push(['Telefonas', escapeHtml(profile.phone)]);
    if (profile?.website) {
        rows.push(['Svetainė', `<a href="${safeUrl(profile.website)}" target="_blank" rel="noopener" class="text-primary hover:underline break-all">${escapeHtml(profile.website)}</a>`]);
    }
    if (profile?.social_instagram) {
        const handle = String(profile.social_instagram).replace('@', '').replace(/[^A-Za-z0-9._]/g, '');
        if (handle) {
            rows.push(['Instagram', `<a href="https://instagram.com/${escapeAttr(handle)}" target="_blank" rel="noopener" class="text-primary hover:underline">@${escapeHtml(handle)}</a>`]);
        }
    }
    if (profile?.social_facebook) {
        rows.push(['Facebook', `<a href="${safeUrl(profile.social_facebook)}" target="_blank" rel="noopener" class="text-primary hover:underline break-all">${escapeHtml(profile.social_facebook)}</a>`]);
    }
    if (profile?.social_linkedin) {
        rows.push(['LinkedIn', `<a href="${safeUrl(profile.social_linkedin)}" target="_blank" rel="noopener" class="text-primary hover:underline break-all">${escapeHtml(profile.social_linkedin)}</a>`]);
    }
    if (profile?.social_youtube) {
        rows.push(['YouTube', `<a href="${safeUrl(profile.social_youtube)}" target="_blank" rel="noopener" class="text-primary hover:underline break-all">${escapeHtml(profile.social_youtube)}</a>`]);
    }

    if (rows.length === 0) {
        container.closest('.section-card')?.classList.add('hidden');
        return;
    }

    container.innerHTML = `
        <table class="w-full text-sm">
            <tbody>
                ${rows.map(([label, value]) => `
                    <tr class="border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <td class="py-2.5 pr-4 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap w-1/3">${label}</td>
                        <td class="py-2.5 text-gray-900 dark:text-white">${value}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadServices(creatorId, creator) {
    const container = document.getElementById('services-list');
    const actionEl = document.getElementById('order-action');

    const { data: services, error } = await supabase
        .from('creator_services')
        .select('*')
        .eq('creator_id', creatorId)
        .order('price', { ascending: true });

    if (error || !services || services.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-500 dark:text-gray-400">Kūrėjas dar nenustatė atskirų paslaugų.</p>
            ${creator.price_from ? `<div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span class="text-xs text-gray-400">Kaina nuo</span>
                <span class="font-bold text-gray-900 dark:text-white ml-1">€${escapeHtml(creator.price_from)}</span>
            </div>` : ''}`;
        actionEl.innerHTML = `<p class="text-xs text-gray-400 text-center">Susisiekite tiesiogiai dėl kainų</p>`;
        return;
    }

    // Check if creator has packages (tier-based)
    const packages = services.filter(s => s.tier);
    const legacyServices = services.filter(s => !s.tier);

    if (packages.length > 0) {
        renderPackageComparison(packages, actionEl, creatorId);
    } else {
        renderLegacyServices(legacyServices, container, actionEl, creatorId);
    }
}

const TIER_ORDER = { bazinis: 1, standartinis: 2, premium: 3 };
const TIER_LABELS = { bazinis: 'Bazinis', standartinis: 'Standartinis', premium: 'Premium' };

function renderPackageComparison(packages, actionEl, creatorId) {
    const container = document.getElementById('services-list');
    packages.sort((a, b) => (TIER_ORDER[a.tier] || 9) - (TIER_ORDER[b.tier] || 9));

    // Mobile: tab bar + single card; Desktop: side-by-side
    const tabsHtml = packages.map((p, i) => `
        <button class="pkg-tab flex-1 text-center py-2 text-xs font-semibold transition-colors
            ${i === 0 ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400 border-b-2 border-transparent hover:text-gray-700'}"
            data-pkg-idx="${i}">
            ${TIER_LABELS[p.tier] || ''}<br><span class="font-bold">€${escapeHtml(p.price)}</span>
        </button>
    `).join('');

    const cardsHtml = packages.map((pkg, i) => {
        const isHighlighted = pkg.tier === 'standartinis';
        const revText = pkg.revisions === -1 ? 'Be limito' : pkg.revisions === 1 ? '1 korekcija' : `${pkg.revisions || 0} korekcijos`;
        const borderCls = isHighlighted ? 'border-2 border-primary' : 'border border-gray-100 dark:border-gray-700';
        const badge = isHighlighted ? '<span class="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap z-10">Populiariausias</span>' : '';

        return `
            <div class="pkg-card relative ${borderCls} bg-white dark:bg-gray-900 p-3 flex flex-col ${i > 0 ? 'hidden md:flex' : ''}"
                data-pkg-idx="${i}" data-service-id="${escapeAttr(pkg.id)}" data-service-name="${escapeAttr(pkg.name)}" data-service-price="${escapeAttr(pkg.price)}"
                style="border-radius:8px; min-height:200px;">
                ${badge}
                <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">${TIER_LABELS[pkg.tier] || ''}</span>
                <span class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">€${escapeHtml(pkg.price)}</span>
                <span class="text-xs font-medium text-gray-800 dark:text-gray-200 mt-1.5 leading-tight">${escapeHtml(pkg.name)}</span>
                ${pkg.description ? `<p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-3">${escapeHtml(pkg.description)}</p>` : ''}
                <div class="flex gap-2 mt-2 text-[11px] text-gray-400">
                    ${pkg.delivery_days ? `<span>&#128197; ${escapeHtml(pkg.delivery_days)} d.d.</span>` : ''}
                    <span>&#128260; ${escapeHtml(revText)}</span>
                </div>
                ${pkg.features?.length ? `
                    <ul class="mt-2 space-y-0.5 text-[11px] text-gray-600 dark:text-gray-300 flex-1">
                        ${pkg.features.map(f => `<li class="flex items-start gap-1"><span class="text-green-500 mt-px">&#10003;</span><span>${escapeHtml(f)}</span></li>`).join('')}
                    </ul>
                ` : '<div class="flex-1"></div>'}
                <button class="pkg-select-btn mt-3 w-full text-center text-xs font-semibold py-2 cursor-pointer transition-colors
                    ${isHighlighted ? 'bg-primary hover:bg-primary-hover text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    style="border-radius:4px;">
                    Pasirinkti
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="flex md:hidden mb-3 gap-1 border-b border-gray-100 dark:border-gray-700">
            ${tabsHtml}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-${packages.length} gap-2">
            ${cardsHtml}
        </div>
    `;

    // Mobile tab switching
    container.querySelectorAll('.pkg-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const idx = tab.dataset.pkgIdx;
            container.querySelectorAll('.pkg-tab').forEach(t => {
                t.classList.remove('text-primary', 'border-primary');
                t.classList.add('text-gray-500', 'dark:text-gray-400', 'border-transparent');
            });
            tab.classList.remove('text-gray-500', 'dark:text-gray-400', 'border-transparent');
            tab.classList.add('text-primary', 'border-primary');
            container.querySelectorAll('.pkg-card').forEach(c => {
                c.classList.toggle('hidden', c.dataset.pkgIdx !== idx);
                c.classList.remove('md:flex');
                if (c.dataset.pkgIdx === idx) c.classList.remove('hidden');
            });
            // Re-show all on desktop via media query workaround
            container.querySelectorAll('.pkg-card').forEach(c => c.classList.add('md:flex'));
        });
    });

    // Select package
    container.querySelectorAll('.pkg-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.pkg-card');
            const service = {
                id: parseInt(card.dataset.serviceId),
                name: card.dataset.serviceName,
                price: parseInt(card.dataset.servicePrice),
            };
            // Highlight selected
            container.querySelectorAll('.pkg-select-btn').forEach(b => {
                b.textContent = 'Pasirinkti';
                b.classList.remove('ring-2', 'ring-primary');
            });
            btn.textContent = '✓ Pasirinkta';
            btn.classList.add('ring-2', 'ring-primary');
            renderOrderButton(service, actionEl, creatorId);
        });
    });

    // Auto-select if only one package
    if (packages.length === 1) {
        container.querySelector('.pkg-select-btn')?.click();
    } else {
        actionEl.innerHTML = `<p class="text-xs text-gray-400 text-center">Pasirinkite paketą norėdami tęsti</p>`;
    }
}

function renderLegacyServices(services, container, actionEl, creatorId) {
    container.innerHTML = services.map(s => `
        <div class="service-card p-3 mb-2 rounded-lg border border-gray-100 dark:border-gray-700"
            data-service-id="${escapeAttr(s.id)}"
            data-service-name="${escapeAttr(s.name)}"
            data-service-price="${escapeAttr(s.price)}">
            <div class="flex items-start justify-between gap-2">
                <span class="text-sm font-semibold text-gray-900 dark:text-white leading-tight">${escapeHtml(s.name)}</span>
                <span class="text-sm font-bold text-primary whitespace-nowrap">€${escapeHtml(s.price)}${s.duration ? `<span class="text-xs text-gray-400 font-normal"> / ${escapeHtml(s.duration)}</span>` : ''}</span>
            </div>
            ${s.description ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">${escapeHtml(s.description)}</p>` : ''}
        </div>
    `).join('');

    let selectedService = null;
    container.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', () => {
            container.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedService = {
                id: parseInt(card.dataset.serviceId),
                name: card.dataset.serviceName,
                price: parseInt(card.dataset.servicePrice),
            };
            renderOrderButton(selectedService, actionEl, creatorId);
        });
    });

    if (services.length === 1) {
        container.querySelector('.service-card')?.click();
    } else {
        actionEl.innerHTML = `<p class="text-xs text-gray-400 text-center">Pasirinkite paslaugą norėdami tęsti</p>`;
    }
}

function renderOrderButton(service, actionEl, creatorId) {
    actionEl.innerHTML = `
        <div class="border-t border-gray-100 dark:border-gray-700 pt-3">
            <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-gray-600 dark:text-gray-400 truncate pr-2">${escapeHtml(service.name)}</span>
                <span class="font-bold text-gray-900 dark:text-white">€${escapeHtml(service.price)}</span>
            </div>
            <button id="pay-btn" class="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 text-sm" style="border-radius:6px;">
                Apmokėti per Paysera
            </button>
            <p id="pay-error" class="text-xs text-red-500 mt-2 hidden"></p>
        </div>
    `;
    document.getElementById('pay-btn').addEventListener('click', () => initiatePayment(service, creatorId));
}

async function initiatePayment(service, creatorId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'prisijungimas.html';
        return;
    }

    const btn = document.getElementById('pay-btn');
    const errEl = document.getElementById('pay-error');
    btn.disabled = true;
    btn.textContent = 'Kraunama...';

    try {
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: session.user.id,
                creator_id: creatorId,
                service_id: service.id,
                service_name: service.name,
                amount: service.price,
            })
            .select()
            .single();

        if (orderError) throw orderError;

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/paysera-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ order_id: order.id, amount: service.price, service_name: service.name }),
        });

        const result = await resp.json();
        if (!resp.ok || result.error) throw new Error(result.error || 'Klaida kuriant mokėjimą');
        window.location.href = result.url;
    } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Apmokėti per Paysera';
        if (errEl) { errEl.textContent = 'Klaida: ' + err.message; errEl.classList.remove('hidden'); }
    }
}

async function loadReviews(creatorId) {
    const container = document.getElementById('creator-reviews');

    const { data: reviews, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

    if (error || !reviews || reviews.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400">Kol kas nėra atsiliepimų.</p>';
        return;
    }

    container.innerHTML = reviews.map(r => `
        <div class="review-card">
            <div class="flex items-center justify-between mb-1">
                <span class="font-semibold text-sm text-gray-900 dark:text-white">${escapeHtml(r.author_name)}</span>
                <span class="flex">${renderStars(r.rating)}</span>
            </div>
            ${r.content ? `<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">${escapeHtml(r.content)}</p>` : ''}
            ${r.author_location ? `<p class="text-xs text-gray-400 mt-1">${escapeHtml(r.author_location)}</p>` : ''}
        </div>
    `).join('');
}

function showError(msg) {
    document.getElementById('profile-loading').classList.add('hidden');
    const errEl = document.getElementById('profile-error');
    errEl.classList.remove('hidden');
    const msgEl = errEl.querySelector('p');
    if (msgEl && msg) msgEl.textContent = msg;
}
