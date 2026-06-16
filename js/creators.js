// Creators page - Dynamic data loading, search, filter, sort, pagination + modal

const PAGE_SIZE = 6;
let currentPage = 0;
let currentCategory = null;
let currentSearch = '';
let currentSort = 'rating';
let allLoaded = false;

// Filter state
let selectedCategorySlugs = [];
let selectedCity = '';
let maxPrice = 500;
let minRating = 0;

const CATEGORY_GROUPS = [
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
const creatorsMap = {};

// Modal order state
let selectedModalService = null;
let modalCreatorId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);

    // Check URL params for category filter
    const categoryParam = params.get('category');
    if (categoryParam) {
        currentCategory = categoryParam;
    }

    // Check URL params for search query (from homepage)
    const queryParam = params.get('q');
    if (queryParam) {
        currentSearch = queryParam;
        const searchInput = document.getElementById('creator-search');
        if (searchInput) searchInput.value = queryParam;
    }

    setupSearch();
    setupFilters();
    setupSort();
    setupLoadMore();
    setupModal();
    await loadCreators(true);
});

function setupSearch() {
    const searchInput = document.getElementById('creator-search');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            currentPage = 0;
            allLoaded = false;
            loadCreators(true);
        }, 300);
    });
}

function buildSidebarCategories() {
    const container = document.getElementById('sidebar-categories');
    if (!container) return;

    container.innerHTML = CATEGORY_GROUPS.map(({ group, slugs, names }) => `
        <div>
            <button class="sidebar-group-toggle flex items-center justify-between w-full mb-1.5 text-left" data-group="${group}">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${group}</span>
                <svg class="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="transform:rotate(-90deg);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
            <div class="sidebar-group-cats hidden space-y-1 pl-1">
                ${slugs.map((slug, i) => `
                    <label class="flex items-center gap-2 cursor-pointer py-0.5">
                        <input type="checkbox" class="cat-filter accent-yellow-400" value="${slug}">
                        <span class="text-sm text-gray-600 dark:text-gray-400">${names[i]}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.sidebar-group-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const cats = btn.nextElementSibling;
            cats.classList.toggle('hidden');
            btn.querySelector('svg').style.transform = cats.classList.contains('hidden') ? 'rotate(-90deg)' : '';
        });
    });

    container.querySelectorAll('.cat-filter').forEach(cb => {
        cb.addEventListener('change', () => {
            selectedCategorySlugs = [...container.querySelectorAll('.cat-filter:checked')].map(c => c.value);
            currentPage = 0; allLoaded = false; loadCreators(true);
        });
    });
}

function setupFilters() {
    buildSidebarCategories();

    const cityEl = document.getElementById('filter-city');
    if (cityEl) cityEl.addEventListener('change', () => {
        selectedCity = cityEl.value;
        currentPage = 0; allLoaded = false; loadCreators(true);
    });

    const priceEl = document.getElementById('filter-price');
    const priceVal = document.getElementById('filter-price-val');
    if (priceEl) priceEl.addEventListener('input', () => {
        maxPrice = parseInt(priceEl.value);
        if (priceVal) priceVal.textContent = maxPrice;
        currentPage = 0; allLoaded = false; loadCreators(true);
    });

    document.querySelectorAll('input[name="filter-rating"]').forEach(radio => {
        radio.addEventListener('change', () => {
            minRating = parseFloat(radio.value);
            currentPage = 0; allLoaded = false; loadCreators(true);
        });
    });

    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        selectedCategorySlugs = []; selectedCity = ''; maxPrice = 500; minRating = 0;
        document.querySelectorAll('.cat-filter').forEach(cb => cb.checked = false);
        const city = document.getElementById('filter-city'); if (city) city.value = '';
        const price = document.getElementById('filter-price'); if (price) price.value = 500;
        const pv = document.getElementById('filter-price-val'); if (pv) pv.textContent = '500';
        const ratingAll = document.querySelector('input[name="filter-rating"][value="0"]');
        if (ratingAll) ratingAll.checked = true;
        currentPage = 0; allLoaded = false; loadCreators(true);
    });
}

function setupSort() {
    const sortSelect = document.getElementById('creator-sort');
    if (!sortSelect) return;

    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        currentPage = 0;
        allLoaded = false;
        loadCreators(true);
    });
}

function setupLoadMore() {
    const btn = document.getElementById('load-more-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        currentPage++;
        loadCreators(false);
    });
}

async function loadCreators(replace) {
    const grid = document.getElementById('creators-grid');
    const countEl = document.getElementById('creators-count');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!grid) return;

    // Resolve category slugs → creator IDs server-side
    let filteredCreatorIds = null;
    if (selectedCategorySlugs.length > 0) {
        const { data: catRows } = await supabase
            .from('categories')
            .select('id')
            .in('slug', selectedCategorySlugs);
        const catIds = (catRows || []).map(r => r.id);

        if (catIds.length > 0) {
            const { data: linkRows } = await supabase
                .from('creator_categories')
                .select('creator_id')
                .in('category_id', catIds);
            filteredCreatorIds = [...new Set((linkRows || []).map(r => r.creator_id))];
        } else {
            filteredCreatorIds = [];
        }

        if (filteredCreatorIds.length === 0) {
            if (replace) grid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">Nėra kūrėjų pagal pasirinktus filtrus.</p>';
            if (countEl) countEl.textContent = '0';
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
    }

    // Pre-process search: tokenize, stem (4-char prefix to handle Lithuanian declensions),
    // and resolve which creators match via their categories.
    let searchStems = [];
    const stemCategoryCreatorIds = {};
    if (currentSearch) {
        const words = currentSearch.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
        searchStems = words
            .map(w => w.replace(/[,()%_:*]/g, ''))
            .filter(Boolean)
            .map(w => w.length > 4 ? w.slice(0, 4) : w);

        if (searchStems.length > 0) {
            const [{ data: allCats }, { data: allLinks }] = await Promise.all([
                supabase.from('categories').select('id, name, slug'),
                supabase.from('creator_categories').select('creator_id, category_id'),
            ]);
            const linksByCat = {};
            (allLinks || []).forEach(l => {
                (linksByCat[l.category_id] = linksByCat[l.category_id] || []).push(l.creator_id);
            });
            for (const stem of searchStems) {
                const matchedCats = (allCats || []).filter(c =>
                    (c.name || '').toLowerCase().includes(stem) ||
                    (c.slug || '').toLowerCase().includes(stem)
                );
                stemCategoryCreatorIds[stem] = [...new Set(
                    matchedCats.flatMap(c => linksByCat[c.id] || [])
                )];
            }
        }
    }

    // Build base filter helper
    function applyBaseFilters(q) {
        q = q.eq('status', 'approved');
        q = q.eq('is_rising_star', false);
        if (filteredCreatorIds !== null) q = q.in('id', filteredCreatorIds);
        for (const stem of searchStems) {
            const conditions = [
                `name.ilike.%${stem}%`,
                `role.ilike.%${stem}%`,
                `location.ilike.%${stem}%`,
                `bio.ilike.%${stem}%`,
            ];
            const catIds = stemCategoryCreatorIds[stem];
            if (catIds && catIds.length > 0) {
                conditions.push(`id.in.(${catIds.join(',')})`);
            }
            q = q.or(conditions.join(','));
        }
        if (selectedCity) q = q.eq('location', selectedCity);
        if (maxPrice < 500) q = q.lte('price_from', maxPrice);
        if (minRating > 0) q = q.gte('rating', minRating);
        return q;
    }

    // Load priority badge IDs. Search ranking: promoted > quality > everyone else.
    const { data: priorityBadges } = await supabase
        .from('creator_badges')
        .select('creator_id, badge_type')
        .in('badge_type', ['promoted', 'quality'])
        .eq('active', true);
    const promotedIds = [...new Set((priorityBadges || [])
        .filter(b => b.badge_type === 'promoted').map(b => b.creator_id))];
    // Quality creators rank below promoted. If a creator has both badges,
    // promoted wins and we don't list them twice.
    const qualityIds = [...new Set((priorityBadges || [])
        .filter(b => b.badge_type === 'quality').map(b => b.creator_id))]
        .filter(id => !promotedIds.includes(id));
    // Combined priority block (in rank order) that sits above regular results.
    const priorityIds = [...promotedIds, ...qualityIds];

    // Sort helper
    function applySort(q) {
        switch (currentSort) {
            case 'rating':    q = q.order('rating', { ascending: false }); break;
            case 'reviews':   q = q.order('review_count', { ascending: false }); break;
            case 'price-low': q = q.order('price_from', { ascending: true }); break;
            case 'price-high':q = q.order('price_from', { ascending: false }); break;
        }
        return q;
    }

    let creators = [];

    // On first page, load promoted creators first
    if (currentPage === 0 && promotedIds.length > 0) {
        let promoQuery = applyBaseFilters(
            supabase.from('creators').select('*, creator_categories(category_id, categories(slug, name))')
        );
        promoQuery = promoQuery.in('id', promotedIds);
        promoQuery = applySort(promoQuery);
        const { data: promoCreators } = await promoQuery;
        creators = promoCreators || [];
    }

    // Then quality-badged creators — above regular results, below promoted.
    if (currentPage === 0 && qualityIds.length > 0) {
        let qualityQuery = applyBaseFilters(
            supabase.from('creators').select('*, creator_categories(category_id, categories(slug, name))')
        );
        qualityQuery = qualityQuery.in('id', qualityIds);
        qualityQuery = applySort(qualityQuery);
        const { data: qualityCreators } = await qualityQuery;
        creators = creators.concat(qualityCreators || []);
    }

    // Load regular creators (excluding promoted + quality on page 0)
    let regularQuery = applyBaseFilters(
        supabase.from('creators').select('*, creator_categories(category_id, categories(slug, name))')
    );
    if (priorityIds.length > 0) {
        // Exclude promoted + quality from regular results (already at top)
        for (const pid of priorityIds) {
            regularQuery = regularQuery.neq('id', pid);
        }
    }
    regularQuery = applySort(regularQuery);

    const regularNeeded = PAGE_SIZE - (currentPage === 0 ? creators.length : 0);
    const regularOffset = currentPage === 0 ? 0 : (currentPage * PAGE_SIZE - priorityIds.length);
    regularQuery = regularQuery.range(
        Math.max(0, regularOffset),
        Math.max(0, regularOffset) + regularNeeded - 1
    );

    const { data: regularCreators, error } = await regularQuery;
    if (error) {
        console.error('Error loading creators:', error);
        return;
    }
    creators = creators.concat(regularCreators || []);

    // Store creators in map for modal
    creators.forEach(c => { creatorsMap[c.id] = c; });

    // Build badge map for display
    const creatorIds = creators.map(c => c.id);
    const { data: allBadges } = await supabase
        .from('creator_badges')
        .select('creator_id, badge_type')
        .in('creator_id', creatorIds)
        .eq('active', true);
    const badgeMap = {};
    (allBadges || []).forEach(b => {
        if (!badgeMap[b.creator_id]) badgeMap[b.creator_id] = [];
        badgeMap[b.creator_id].push(b.badge_type);
    });

    const filtered = creators;

    // Update count (with same filters, no pagination)
    const { count } = await applyBaseFilters(
        supabase.from('creators').select('id', { count: 'exact', head: true })
    );
    if (countEl) countEl.textContent = count || 0;

    // Render cards
    const gradients = [
        'from-pink-500 to-rose-500',
        'from-purple-500 to-violet-600',
        'from-emerald-500 to-teal-600',
        'from-indigo-500 to-purple-600',
        'from-rose-500 to-red-500',
        'from-violet-500 to-purple-600'
    ];

    const html = filtered.map((creator, i) => {
        const gradient = gradients[i % gradients.length];
        const cBadges = badgeMap[creator.id] || [];
        const qualityIcon = cBadges.includes('quality') ? '<svg class="w-4 h-4 text-emerald-500 flex-shrink-0" title="Patikrinta kokybė" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>' : '';
        const promotedIcon = cBadges.includes('promoted') ? '<svg class="w-4 h-4 text-purple-500 flex-shrink-0" title="Reklamuojamas" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>' : '';
        const promotedBanner = cBadges.includes('promoted') ? '<div class="absolute top-2 right-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 z-10" style="border-radius: 3px;">Reklamuojamas</div>' : '';
        return `
            <a href="kurejas.html#id=${creator.id}" class="block card-hover creator-card overflow-hidden cursor-pointer" style="text-decoration: none; color: inherit;">
                <div class="relative h-48 bg-gradient-to-br ${gradient} overflow-hidden">
                    ${promotedBanner}
                    <img src="${safeUrl(creator.image_url)}" alt="" loading="lazy" decoding="async" class="w-full h-full object-cover opacity-80">
                </div>
                <div class="p-6">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="font-bold text-gray-900 dark:text-white flex items-center gap-1">${escapeHtml(creator.name)}${qualityIcon}${promotedIcon}</h3>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(creator.role)}</p>
                        </div>
                        <div class="flex items-center text-sm">
                            <svg class="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                            </svg>
                            <span class="ml-1 font-bold text-gray-900 dark:text-white">${escapeHtml(creator.rating)}</span>
                            <span class="ml-1 text-gray-400">(${escapeHtml(creator.review_count)})</span>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${escapeHtml(creator.location || '')}</p>
                    <div class="flex items-center justify-between pt-4 border-t border-secondary dark:border-gray-700">
                        <div>
                            <span class="text-sm text-gray-600 dark:text-gray-400">Nuo</span>
                            <span class="font-bold text-gray-900 dark:text-white ml-1">€${escapeHtml(creator.price_from)}</span>
                        </div>
                        <span class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium" style="border-radius: 4px;">
                            Peržiūrėti
                        </span>
                    </div>
                </div>
            </a>
        `;
    }).join('');

    if (replace) {
        grid.innerHTML = html;
    } else {
        grid.insertAdjacentHTML('beforeend', html);
    }

    // Show/hide load more
    if (filtered.length < PAGE_SIZE) {
        allLoaded = true;
    }
    if (loadMoreBtn) {
        loadMoreBtn.style.display = allLoaded ? 'none' : '';
    }
}

// ============================================
// Creator Profile Modal
// ============================================

function setupModal() {
    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCreatorModal();
    });
}

async function openCreatorModal(creatorId) {
    const creator = creatorsMap[creatorId];
    if (!creator) return;

    const modal = document.getElementById('creator-modal');
    if (!modal) return;

    modalCreatorId = creatorId;
    selectedModalService = null;

    const gradients = [
        'from-pink-500 to-rose-500',
        'from-purple-500 to-violet-600',
        'from-emerald-500 to-teal-600',
        'from-indigo-500 to-purple-600',
    ];
    const gradient = gradients[Math.floor(Math.random() * gradients.length)];

    const starSvg = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';

    const mapPinSvg = '<svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';

    // Build header
    let headerHtml;
    if (creator.image_url) {
        headerHtml = `<img src="${safeUrl(creator.image_url)}" alt="${escapeAttr(creator.name)}" class="modal-header-img">`;
    } else {
        headerHtml = `<div class="modal-header-gradient bg-gradient-to-br ${gradient}"></div>`;
    }

    // Build stars for rating
    function renderStars(rating) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                html += starSvg;
            }
        }
        return html;
    }

    modal.innerHTML = `
        <div class="modal-overlay" onclick="if(event.target===this)closeCreatorModal()">
            <div class="modal-card">
                <button class="modal-close" onclick="closeCreatorModal()" aria-label="Uždaryti">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>

                ${headerHtml}

                <div class="modal-body">
                    <div class="modal-info-row">
                        <div>
                            <h2 class="modal-name">${escapeHtml(creator.name)}</h2>
                            <p class="modal-role">${escapeHtml(creator.role)}</p>
                        </div>
                        <div class="modal-rating">
                            ${starSvg}
                            <span class="modal-rating-value">${creator.rating}</span>
                            <span class="modal-rating-count">(${creator.review_count})</span>
                        </div>
                    </div>

                    ${creator.location ? `
                        <div class="modal-location" style="margin-top: 8px;">
                            ${mapPinSvg}
                            <span>${creator.location}</span>
                        </div>
                    ` : ''}

                    <hr class="modal-divider">

                    <div id="modal-services-section">
                        <div class="modal-loading" style="justify-content: flex-start; padding: 6px 0; gap: 8px;">
                            <div class="modal-spinner"></div>
                            <span>Kraunamos paslaugos...</span>
                        </div>
                    </div>

                    ${creator.bio ? `
                        <hr class="modal-divider">
                        <div class="modal-section-title">Apie kūrėją</div>
                        <p class="modal-bio">${creator.bio}</p>
                    ` : ''}

                    <hr class="modal-divider">

                    <div class="modal-section-title">Atsiliepimai</div>
                    <div id="modal-reviews" class="modal-reviews">
                        <div class="modal-loading">
                            <div class="modal-spinner"></div>
                            <span>Kraunami atsiliepimai...</span>
                        </div>
                    </div>

                    <hr class="modal-divider">

                    <div id="modal-order-section" class="modal-order-section">
                        <p class="modal-order-hint">Pasirinkite paslaugą norėdami tęsti</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Show modal with animation
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) overlay.classList.add('visible');
    });

    // Load services and reviews in parallel
    loadModalServices(creatorId, creator);
    loadModalReviews(creatorId);
}

async function loadModalServices(creatorId, creator) {
    const container = document.getElementById('modal-services-section');
    if (!container) return;

    const { data: services, error } = await supabase
        .from('creator_services')
        .select('*')
        .eq('creator_id', creatorId)
        .order('price', { ascending: true });

    if (error || !services || services.length === 0) {
        container.innerHTML = `
            <div class="modal-price">
                Kaina nuo <strong>€${creator.price_from}</strong>
            </div>
        `;
        const orderSection = document.getElementById('modal-order-section');
        if (orderSection) {
            orderSection.innerHTML = '<p class="modal-order-hint">Kūrėjas dar nenustatė paslaugų. Susisiekite el. paštu.</p>';
        }
        return;
    }

    const packages = services.filter(s => s.tier);
    const legacy = services.filter(s => !s.tier);

    if (packages.length > 0) {
        renderModalPackages(packages, container);
    } else {
        renderModalLegacyServices(legacy, container);
    }
}

const MODAL_TIER_ORDER = { bazinis: 1, standartinis: 2, premium: 3 };
const MODAL_TIER_LABELS = { bazinis: 'Bazinis', standartinis: 'Standartinis', premium: 'Premium' };

function renderModalPackages(packages, container) {
    packages.sort((a, b) => (MODAL_TIER_ORDER[a.tier] || 9) - (MODAL_TIER_ORDER[b.tier] || 9));

    const tabsHtml = packages.map((p, i) => {
        const isActive = i === 0;
        const highlighted = p.tier === 'standartinis';
        return `
            <button class="modal-pkg-tab flex-1 text-center py-2.5 px-1 text-xs font-semibold transition-colors relative
                ${isActive ? 'text-primary border-b-2 border-primary' : 'text-gray-400 border-b-2 border-transparent hover:text-gray-600'}"
                data-pkg-idx="${i}">
                ${highlighted ? '<span style="position:absolute;top:-2px;left:50%;transform:translateX(-50%);font-size:8px;background:#D4A017;color:#fff;padding:0 4px;border-radius:4px;">TOP</span>' : ''}
                ${MODAL_TIER_LABELS[p.tier]}<br><span class="font-bold text-sm">€${p.price}</span>
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <div class="modal-section-title">Paketai ir kainos</div>
        <div style="display:flex;gap:2px;border-bottom:1px solid rgba(128,128,128,0.2);margin-bottom:12px;">
            ${tabsHtml}
        </div>
        <div id="modal-pkg-content"></div>
    `;

    function showPackageDetail(idx) {
        const pkg = packages[idx];
        const revText = pkg.revisions === -1 ? 'Be limito' : pkg.revisions === 1 ? '1 korekcija' : `${pkg.revisions || 0} korekcijos`;
        const contentEl = document.getElementById('modal-pkg-content');
        if (!contentEl) return;

        contentEl.innerHTML = `
            <div class="modal-pkg-detail" data-service-id="${escapeAttr(pkg.id)}" data-service-name="${escapeAttr(pkg.name)}" data-service-price="${escapeAttr(pkg.price)}">
                <p style="font-weight:600;font-size:14px;color:var(--text-primary,#111);margin-bottom:4px;">${escapeHtml(pkg.name)}</p>
                ${pkg.description ? `<p style="font-size:12px;color:#888;line-height:1.5;margin-bottom:8px;">${escapeHtml(pkg.description)}</p>` : ''}
                <div style="display:flex;gap:12px;font-size:11px;color:#999;margin-bottom:8px;">
                    ${pkg.delivery_days ? `<span>&#128197; Pristatymas: ${escapeHtml(pkg.delivery_days)} d.d.</span>` : ''}
                    <span>&#128260; ${escapeHtml(revText)}</span>
                </div>
                ${pkg.features?.length ? `
                    <ul style="list-style:none;padding:0;margin:0 0 8px 0;">
                        ${pkg.features.map(f => `<li style="font-size:12px;color:#555;padding:2px 0;display:flex;align-items:flex-start;gap:6px;"><span style="color:#22c55e;">&#10003;</span><span>${escapeHtml(f)}</span></li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;

        // Auto-select this package for order
        selectModalService(pkg.id, pkg.name, pkg.price);
    }

    // Tab click handlers
    container.querySelectorAll('.modal-pkg-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.modal-pkg-tab').forEach(t => {
                t.classList.remove('text-primary', 'border-primary');
                t.classList.add('text-gray-400', 'border-transparent');
            });
            tab.classList.remove('text-gray-400', 'border-transparent');
            tab.classList.add('text-primary', 'border-primary');
            showPackageDetail(parseInt(tab.dataset.pkgIdx));
        });
    });

    // Show first package by default
    showPackageDetail(0);
}

function renderModalLegacyServices(services, container) {
    container.innerHTML = `
        <div class="modal-section-title">Paslaugos ir kainos</div>
        <p class="modal-select-hint">Pasirinkite paslaugą norėdami užsakyti</p>
        <div class="modal-services-list">
            ${services.map(s => `
                <div class="modal-service"
                    data-service-id="${escapeAttr(s.id)}"
                    data-service-name="${escapeAttr(s.name)}"
                    data-service-price="${escapeAttr(s.price)}">
                    <div class="modal-service-header">
                        <span class="modal-service-name">${escapeHtml(s.name)}</span>
                        <span class="modal-service-price">€${escapeHtml(s.price)}${s.duration ? `<span class="modal-service-duration"> / ${escapeHtml(s.duration)}</span>` : ''}</span>
                    </div>
                    ${s.description ? `<p class="modal-service-desc">${escapeHtml(s.description)}</p>` : ''}
                </div>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.modal-service').forEach(el => {
        el.addEventListener('click', () => {
            selectModalService(
                Number(el.dataset.serviceId),
                el.dataset.serviceName,
                Number(el.dataset.servicePrice)
            );
        });
    });

    if (services.length === 1) {
        container.querySelector('.modal-service')?.click();
    }
}

function selectModalService(id, name, price) {
    selectedModalService = { id, name, price };

    document.querySelectorAll('.modal-service').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.modal-service[data-service-id="${id}"]`)?.classList.add('selected');

    const section = document.getElementById('modal-order-section');
    if (!section) return;

    section.innerHTML = `
        <div class="modal-order-summary">
            <div class="modal-order-info">
                <span class="modal-order-name">${escapeHtml(name)}</span>
                <span class="modal-order-price">€${escapeHtml(price)}</span>
            </div>
            <button class="modal-cta" id="stripe-pay-btn" onclick="initiatePayment()">
                Apmokėti kortele
            </button>
        </div>
    `;
}

async function initiatePayment() {
    if (!selectedModalService || !modalCreatorId) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        closeCreatorModal();
        window.location.href = 'prisijungimas.html';
        return;
    }

    const btn = document.getElementById('stripe-pay-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Kraunama...'; }

    try {
        // Create order record in DB
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: session.user.id,
                creator_id: modalCreatorId,
                service_id: selectedModalService.id,
                service_name: selectedModalService.name,
                amount: selectedModalService.price,
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // Call Stripe Checkout Edge Function
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/stripe-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ order_id: order.id }),
        });

        const result = await resp.json();
        if (!resp.ok || result.error) throw new Error(result.error || 'Klaida kuriant mokėjimą');

        window.location.href = result.url;
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Apmokėti kortele'; }
        const section = document.getElementById('modal-order-section');
        if (section) {
            const errEl = document.createElement('p');
            errEl.className = 'modal-order-error';
            errEl.textContent = 'Klaida: ' + err.message;
            section.appendChild(errEl);
        }
    }
}

async function loadModalReviews(creatorId) {
    const container = document.getElementById('modal-reviews');
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

function closeCreatorModal() {
    const modal = document.getElementById('creator-modal');
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

