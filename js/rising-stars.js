// Rising Stars page - Dynamic data loading, search, filter

let rsCurrentSearch = '';
let rsCurrentCategory = null;

document.addEventListener('DOMContentLoaded', async () => {
    setupRSSearch();
    setupRSFilters();
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

function setupRSFilters() {
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            rsCurrentCategory = pill.dataset.category || null;
            loadRisingStars();
        });
    });
}

async function loadRisingStars() {
    const grid = document.getElementById('rs-grid');
    const countEl = document.getElementById('rs-count');
    if (!grid) return;

    let query = supabase
        .from('creators')
        .select('*, creator_categories(category_id, categories(slug, name))')
        .eq('is_rising_star', true)
        .order('rating', { ascending: false });

    if (rsCurrentSearch) {
        query = query.or(`name.ilike.%${rsCurrentSearch}%,role.ilike.%${rsCurrentSearch}%,location.ilike.%${rsCurrentSearch}%`);
    }

    const { data: creators, error } = await query;

    if (error) {
        console.error('Error loading rising stars:', error);
        return;
    }

    // Filter by category client-side using looking_for array
    let filtered = creators;
    if (rsCurrentCategory) {
        filtered = creators.filter(c => {
            // Check looking_for array
            if (c.looking_for && c.looking_for.some(tag =>
                tag.toLowerCase().includes(rsCurrentCategory.toLowerCase())
            )) return true;
            // Check category associations
            if (c.creator_categories?.some(cc => cc.categories?.slug === rsCurrentCategory)) return true;
            return false;
        });
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
            : `<span class="px-3 py-1 bg-amber-500 text-white text-xs font-bold" style="border-radius: 6px;">${creator.price_label || '~€' + creator.price_from}</span>`;

        const lookingForTags = (creator.looking_for || []).map(tag =>
            `<span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-secondary dark:border-gray-700" style="border-radius: 4px;">${tag}</span>`
        ).join('');

        return `
            <div class="card-hover bg-white dark:bg-gray-900 border border-secondary dark:border-gray-700 overflow-hidden" style="border-radius: 6px;">
                <div class="relative h-48 bg-gradient-to-br ${gradient} overflow-hidden">
                    <img src="${creator.image_url || ''}" alt="" class="w-full h-full object-cover opacity-80">
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
                            <h3 class="font-bold text-gray-900 dark:text-white">${creator.name}</h3>
                            <p class="text-sm text-primary">${creator.role}</p>
                        </div>
                        <div class="text-right">
                            <div class="flex items-center text-sm">
                                <svg class="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                </svg>
                                <span class="ml-1 font-bold text-gray-900 dark:text-white">${creator.rating}</span>
                                <span class="ml-1 text-gray-400">(${creator.review_count})</span>
                            </div>
                            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">${creator.location || ''}</p>
                        </div>
                    </div>

                    <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-800 border border-secondary dark:border-gray-700" style="border-radius: 6px;">
                        <div class="flex items-center justify-between text-sm mb-2">
                            <span class="text-gray-600 dark:text-gray-400">Portfolio pažanga</span>
                            <span class="font-semibold text-primary">${creator.portfolio_current}/${creator.portfolio_target}</span>
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
                        ${creator.bio || ''}
                    </p>

                    <button class="w-full bg-primary hover:bg-primary-hover text-white py-3 font-semibold" style="border-radius: 4px;">
                        Siųsti Užklausą
                    </button>
                </div>
            </div>
        `;
    }).join('');
}
