// Rising Stars page - Dynamic data loading, search, filter + modal

let rsCurrentSearch = '';
let rsSelectedCategorySlugs = [];
let rsSelectedCity = '';
let rsMaxPrice = 500;
let rsMinRating = 0;

const RS_CATEGORY_GROUPS = [
    {
        group: 'Fotografai',
        slugs: ['foto-asmenims','foto-vestuves','foto-verslui','foto-nekilnojamas','foto-automobiliai','foto-kurybiniai'],
        names: ['Asmenims','Vestuvės','Verslui','Nekilnojamasis Turtas','Automobiliai','Kūrybiniai Projektai'],
    },
    {
        group: 'Videografai',
        slugs: ['video-asmeniniai','video-vestuves','video-verslo','video-produktu','video-renginiai','video-nekilnojamas','video-muzika','video-socialine'],
        names: ['Asmeniniai Projektai','Vestuvės','Verslo Video','Produktų Video','Renginiai','Nekilnojamasis Turtas','Muzika','Socialinė Medija'],
    },
    {
        group: 'Montažuotojai',
        slugs: ['mont-asmeniniai','mont-vestuves','mont-verslo','mont-produktu','mont-renginiai','mont-muzika','mont-socialine','mont-kurybiniai'],
        names: ['Asmeniniai Projektai','Vestuvės','Verslo Video','Produktų Video','Renginiai','Muzika','Socialinė Medija','Kūrybiniai Projektai'],
    },
    {
        group: 'Dizaineriai',
        slugs: ['diz-logotipai','diz-socialine','diz-spausdinta','diz-pakuotes','diz-web','diz-leidiniai','diz-renginiai','diz-iliustracijos'],
        names: ['Logotipai ir Branding','Socialinė Medija','Spausdinta Medžiaga','Pakuotės Dizainas','Web Dizainas','Leidiniai','Renginiai','Iliustracijos ir Menas'],
    },
];

// Store loaded creators for modal access
const rsCreatorsMap = {};

document.addEventListener('DOMContentLoaded', async () => {
    setupRSSearch();
    setupRSFilters();
    setupRSModal();
    await loadRisingStars();
});

function setupRSSearch() {
    const searchInput = document.getElementById('rs-search');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            rsCurrentSearch = e.target.value.trim();
            loadRisingStars();
        }, 300);
    });
}

function buildRSSidebarCategories() {
    const container = document.getElementById('rs-sidebar-categories');
    if (!container) return;

    container.innerHTML = RS_CATEGORY_GROUPS.map(({ group, slugs, names }) => `
        <div>
            <button class="rs-sidebar-group-toggle flex items-center justify-between w-full mb-1.5 text-left" data-group="${group}">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${group}</span>
                <svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="transform:rotate(-90deg);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
            <div class="rs-sidebar-group-cats hidden space-y-1 pl-1">
                ${slugs.map((slug, i) => `
                    <label class="flex items-center gap-2 cursor-pointer py-0.5">
                        <input type="checkbox" class="rs-cat-filter accent-yellow-400" value="${slug}">
                        <span class="text-sm text-gray-600 dark:text-gray-400">${names[i]}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.rs-sidebar-group-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const cats = btn.nextElementSibling;
            cats.classList.toggle('hidden');
            btn.querySelector('svg').style.transform = cats.classList.contains('hidden') ? 'rotate(-90deg)' : '';
        });
    });

    container.querySelectorAll('.rs-cat-filter').forEach(cb => {
        cb.addEventListener('change', () => {
            rsSelectedCategorySlugs = [...container.querySelectorAll('.rs-cat-filter:checked')].map(c => c.value);
            loadRisingStars();
        });
    });
}

function setupRSFilters() {
    buildRSSidebarCategories();

    const cityEl = document.getElementById('rs-filter-city');
    if (cityEl) cityEl.addEventListener('change', () => {
        rsSelectedCity = cityEl.value;
        loadRisingStars();
    });

    const priceEl = document.getElementById('rs-filter-price');
    const priceVal = document.getElementById('rs-filter-price-val');
    if (priceEl) priceEl.addEventListener('input', () => {
        rsMaxPrice = parseInt(priceEl.value);
        if (priceVal) priceVal.textContent = rsMaxPrice;
        loadRisingStars();
    });

    document.querySelectorAll('input[name="rs-filter-rating"]').forEach(radio => {
        radio.addEventListener('change', () => {
            rsMinRating = parseFloat(radio.value);
            loadRisingStars();
        });
    });

    const clearBtn = document.getElementById('rs-clear-filters-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        rsSelectedCategorySlugs = []; rsSelectedCity = ''; rsMaxPrice = 500; rsMinRating = 0;
        document.querySelectorAll('.rs-cat-filter').forEach(cb => cb.checked = false);
        const city = document.getElementById('rs-filter-city'); if (city) city.value = '';
        const price = document.getElementById('rs-filter-price'); if (price) price.value = 500;
        const pv = document.getElementById('rs-filter-price-val'); if (pv) pv.textContent = '500';
        const ratingAll = document.querySelector('input[name="rs-filter-rating"][value="0"]');
        if (ratingAll) ratingAll.checked = true;
        loadRisingStars();
    });
}

function setupRSModal() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeRSModal();
    });
}

async function loadRisingStars() {
    const grid = document.getElementById('rs-grid');
    const countEl = document.getElementById('rs-count');
    if (!grid) return;

    let query = supabase
        .from('creators')
        .select('*, creator_categories(category_id, categories(slug, name))')
        .eq('status', 'approved')
        .eq('is_rising_star', true)
        .lte('price_from', rsMaxPrice)
        .gte('rating', rsMinRating)
        .order('rating', { ascending: false });

    if (rsSelectedCity) {
        query = query.eq('location', rsSelectedCity);
    }

    if (rsCurrentSearch) {
        query = query.or(`name.ilike.%${rsCurrentSearch}%,role.ilike.%${rsCurrentSearch}%,location.ilike.%${rsCurrentSearch}%`);
    }

    const { data: creators, error } = await query;

    if (error) {
        console.error('Error loading rising stars:', error);
        return;
    }

    // Store creators in map for modal
    creators.forEach(c => { rsCreatorsMap[c.id] = c; });

    // Filter by selected categories (client-side via creator_categories join)
    let filtered = creators;
    if (rsSelectedCategorySlugs.length > 0) {
        filtered = creators.filter(c =>
            c.creator_categories?.some(cc => rsSelectedCategorySlugs.includes(cc.categories?.slug))
        );
    }

    if (countEl) countEl.textContent = filtered.length;

    const gradients = [
        'from-pink-500 to-rose-500',
        'from-purple-500 to-violet-600',
        'from-emerald-500 to-teal-600'
    ];

    grid.innerHTML = filtered.map((creator, i) => {
        const gradient = gradients[i % gradients.length];
        const progressPct = creator.portfolio_target > 0
            ? Math.round((creator.portfolio_current / creator.portfolio_target) * 100)
            : 0;
        const priceTag = creator.price_from === 0
            ? '<span class="px-3 py-1 bg-green-500 text-white text-xs font-bold" style="border-radius: 6px;">NEMOKAMAI</span>'
            : `<span class="px-3 py-1 bg-amber-500 text-white text-xs font-bold" style="border-radius: 6px;">${escapeHtml(creator.price_label || '~€' + creator.price_from)}</span>`;

        const lookingForTags = (creator.looking_for || []).map(tag =>
            `<span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-secondary dark:border-gray-700" style="border-radius: 4px;">${escapeHtml(tag)}</span>`
        ).join('');

        const creatorIdAttr = escapeAttr(creator.id);

        return `
            <div class="card-hover bg-white dark:bg-gray-900 border border-secondary dark:border-gray-700 overflow-hidden" style="border-radius: 6px;">
                <div class="relative h-48 bg-gradient-to-br ${gradient} overflow-hidden">
                    <img src="${safeUrl(creator.image_url)}" alt="" class="w-full h-full object-cover opacity-80">
                    <div class="absolute top-3 left-3">
                        <span class="px-3 py-1 bg-primary text-white text-xs font-bold" style="border-radius: 6px;">
                            KYLANTI ŽVAIGŽDĖ
                        </span>
                    </div>
                    <div class="absolute top-3 right-3">
                        ${priceTag}
                    </div>
                </div>
                <div class="p-6">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="font-bold text-gray-900 dark:text-white">${escapeHtml(creator.name)}</h3>
                            <p class="text-sm text-primary">${escapeHtml(creator.role)}</p>
                        </div>
                        <div class="text-right">
                            <div class="flex items-center text-sm">
                                <svg class="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                </svg>
                                <span class="ml-1 font-bold text-gray-900 dark:text-white">${escapeHtml(creator.rating)}</span>
                                <span class="ml-1 text-gray-400">(${escapeHtml(creator.review_count)})</span>
                            </div>
                            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">${escapeHtml(creator.location || '')}</p>
                        </div>
                    </div>

                    <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-800 border border-secondary dark:border-gray-700" style="border-radius: 6px;">
                        <div class="flex items-center justify-between text-sm mb-2">
                            <span class="text-gray-600 dark:text-gray-400">Portfolio pažanga</span>
                            <span class="font-semibold text-primary">${escapeHtml(creator.portfolio_current)}/${escapeHtml(creator.portfolio_target)}</span>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-700 h-2" style="border-radius: 4px;">
                            <div class="bg-primary h-2" style="width: ${progressPct}%; border-radius: 4px;"></div>
                        </div>
                    </div>

                    ${lookingForTags ? `
                    <div class="mb-4">
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">Ieško projektų:</p>
                        <div class="flex flex-wrap gap-1">${lookingForTags}</div>
                    </div>
                    ` : ''}

                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        ${escapeHtml(creator.bio || '')}
                    </p>

                    <div class="flex gap-2">
                        <button data-rs-open="${creatorIdAttr}" class="flex-1 bg-primary hover:bg-primary-hover text-white py-3 font-semibold text-sm" style="border-radius: 4px;">
                            Peržiūrėti
                        </button>
                        <button data-rs-chat="${creatorIdAttr}" class="flex-1 bg-gray-900 hover:bg-gray-700 text-white py-3 font-semibold text-sm flex items-center justify-center gap-1.5" style="border-radius: 4px;">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            Žinutė
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('[data-rs-open]').forEach(btn => {
        btn.addEventListener('click', () => openRSModal(btn.dataset.rsOpen));
    });
    grid.querySelectorAll('[data-rs-chat]').forEach(btn => {
        btn.addEventListener('click', () => startChatWithCreator(btn.dataset.rsChat));
    });
}

// ============================================
// Rising Star Profile Modal
// ============================================

async function openRSModal(creatorId) {
    const creator = rsCreatorsMap[creatorId];
    if (!creator) return;

    const modal = document.getElementById('rs-modal');
    if (!modal) return;

    const gradients = [
        'from-pink-500 to-rose-500',
        'from-purple-500 to-violet-600',
        'from-emerald-500 to-teal-600',
    ];
    const gradient = gradients[Math.floor(Math.random() * gradients.length)];

    const starSvg = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
    const mapPinSvg = '<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';

    let headerHtml;
    if (creator.image_url) {
        headerHtml = `<img src="${safeUrl(creator.image_url)}" alt="${escapeAttr(creator.name)}" class="modal-header-img">`;
    } else {
        headerHtml = `<div class="modal-header-gradient bg-gradient-to-br ${gradient}"></div>`;
    }

    const progressPct = creator.portfolio_target > 0
        ? Math.round((creator.portfolio_current / creator.portfolio_target) * 100)
        : 0;

    const priceLabel = creator.price_from === 0
        ? '<span style="color: #22c55e; font-weight: 700; font-size: 20px;">NEMOKAMAI</span>'
        : `<strong>€${escapeHtml(creator.price_from)}</strong>`;

    const lookingForTags = (creator.looking_for || []).map(tag =>
        `<span style="display:inline-block; font-size:12px; padding:3px 10px; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:4px; color:#4b5563;">${escapeHtml(tag)}</span>`
    ).join(' ');

    modal.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this)closeRSModal()">
            <div class="modal-card">
                <button class="modal-close" onclick="closeRSModal()" aria-label="Uždaryti">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>

                <div style="position:relative;">
                    ${headerHtml}
                    <div style="position:absolute; top:12px; left:12px;">
                        <span style="padding:4px 12px; background:#D4A017; color:white; font-size:11px; font-weight:700; border-radius:6px;">KYLANTI ŽVAIGŽDĖ</span>
                    </div>
                </div>

                <div class="modal-body">
                    <div class="modal-info-row">
                        <div>
                            <h2 class="modal-name">${escapeHtml(creator.name)}</h2>
                            <p class="modal-role">${escapeHtml(creator.role)}</p>
                        </div>
                        <div class="modal-rating">
                            ${starSvg}
                            <span class="modal-rating-value">${escapeHtml(creator.rating)}</span>
                            <span class="modal-rating-count">(${escapeHtml(creator.review_count)})</span>
                        </div>
                    </div>

                    ${creator.location ? `
                        <div class="modal-location" style="margin-top: 8px;">
                            ${mapPinSvg}
                            <span>${escapeHtml(creator.location)}</span>
                        </div>
                    ` : ''}

                    <hr class="modal-divider">

                    <!-- Portfolio progress -->
                    <div class="modal-section-title">Portfolio pažanga</div>
                    <div style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                            <span style="color:#6b7280;">Projektai</span>
                            <span style="font-weight:600; color:#D4A017;">${escapeHtml(creator.portfolio_current)}/${escapeHtml(creator.portfolio_target)}</span>
                        </div>
                        <div style="width:100%; height:8px; background:#e5e7eb; border-radius:4px;">
                            <div style="width:${progressPct}%; height:8px; background:#D4A017; border-radius:4px;"></div>
                        </div>
                    </div>

                    <hr class="modal-divider">

                    <div class="modal-price">
                        Kaina: ${priceLabel} ${creator.price_label ? '/ ' + escapeHtml(creator.price_label) : ''}
                    </div>

                    ${lookingForTags ? `
                        <hr class="modal-divider">
                        <div class="modal-section-title">Ieško projektų</div>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">${lookingForTags}</div>
                    ` : ''}

                    ${creator.bio ? `
                        <hr class="modal-divider">
                        <div class="modal-section-title">Apie kūrėją</div>
                        <p class="modal-bio">${escapeHtml(creator.bio)}</p>
                    ` : ''}

                    <hr class="modal-divider">

                    <div class="modal-section-title">Atsiliepimai</div>
                    <div id="rs-modal-reviews" class="modal-reviews">
                        <div class="modal-loading">
                            <div class="modal-spinner"></div>
                            <span>Kraunami atsiliepimai...</span>
                        </div>
                    </div>

                    <hr class="modal-divider">

                    <button data-rs-chat="${escapeAttr(creator.id)}" class="modal-cta" style="display:flex; align-items:center; justify-content:center; gap:8px;">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        Parašyti žinutę
                    </button>
                </div>
            </div>
        </div>
    `;

    modal.querySelectorAll('[data-rs-chat]').forEach(btn => {
        btn.addEventListener('click', () => startChatWithCreator(btn.dataset.rsChat));
    });

    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) overlay.classList.add('visible');
    });

    // Load reviews
    loadRSModalReviews(creatorId);
}

async function loadRSModalReviews(creatorId) {
    const container = document.getElementById('rs-modal-reviews');
    if (!container) return;

    const starSvg = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';

    const { data: reviews, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = '<p class="modal-no-reviews">Nepavyko užkrauti atsiliepimų.</p>';
        return;
    }

    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<p class="modal-no-reviews">Kol kas nėra atsiliepimų.</p>';
        return;
    }

    container.innerHTML = reviews.map(review => {
        const rating = Math.max(0, Math.min(5, parseInt(review.rating, 10) || 0));
        let starsHtml = '';
        for (let i = 0; i < rating; i++) {
            starsHtml += starSvg;
        }
        return `
            <div class="modal-review">
                <div class="modal-review-header">
                    <span class="modal-review-author">${escapeHtml(review.author_name)}</span>
                    <div class="modal-review-stars">${starsHtml}</div>
                </div>
                <p class="modal-review-text">${escapeHtml(review.content || '')}</p>
                ${review.author_location ? `<p class="modal-review-location">${escapeHtml(review.author_location)}</p>` : ''}
            </div>
        `;
    }).join('');
}

async function startChatWithCreator(creatorId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'prisijungimas.html';
        return;
    }
    window.location.href = `zinutes.html?creator_id=${creatorId}`;
}

function closeRSModal() {
    const modal = document.getElementById('rs-modal');
    if (!modal) return;

    const overlay = modal.querySelector('.modal-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => {
            modal.innerHTML = '';
            document.body.style.overflow = '';
        }, 250);
    } else {
        modal.innerHTML = '';
        document.body.style.overflow = '';
    }
}
