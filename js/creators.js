// Creators page - Dynamic data loading, search, filter, sort, pagination

const PAGE_SIZE = 6;
let currentPage = 0;
let currentCategory = null;
let currentSearch = '';
let currentSort = 'rating';
let allLoaded = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Check URL params for category filter
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    if (categoryParam) {
        currentCategory = categoryParam;
    }

    setupSearch();
    setupFilters();
    setupSort();
    setupLoadMore();
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

function setupFilters() {
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.dataset.category || null;
            currentPage = 0;
            allLoaded = false;
            loadCreators(true);
        });

        // Mark active if matching URL param
        if (currentCategory && pill.dataset.category === currentCategory) {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        }
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

    // Build query
    let query = supabase
        .from('creators')
        .select('*, creator_categories(category_id, categories(slug, name))')
        .eq('is_rising_star', false);

    // Search filter
    if (currentSearch) {
        query = query.or(`name.ilike.%${currentSearch}%,role.ilike.%${currentSearch}%,location.ilike.%${currentSearch}%`);
    }

    // Sort
    switch (currentSort) {
        case 'rating':
            query = query.order('rating', { ascending: false });
            break;
        case 'reviews':
            query = query.order('review_count', { ascending: false });
            break;
        case 'price-low':
            query = query.order('price_from', { ascending: true });
            break;
        case 'price-high':
            query = query.order('price_from', { ascending: false });
            break;
    }

    // Pagination
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data: creators, error } = await query;

    if (error) {
        console.error('Error loading creators:', error);
        return;
    }

    // Filter by category client-side (since junction table filtering is complex)
    let filtered = creators;
    if (currentCategory) {
        filtered = creators.filter(c =>
            c.creator_categories?.some(cc => cc.categories?.slug === currentCategory)
        );
    }

    // Update count
    const { count } = await supabase
        .from('creators')
        .select('id', { count: 'exact', head: true })
        .eq('is_rising_star', false);

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
        return `
            <div class="card-hover bg-white dark:bg-gray-900 border border-secondary dark:border-gray-700 overflow-hidden" style="border-radius: 6px;">
                <div class="relative h-48 bg-gradient-to-br ${gradient} overflow-hidden">
                    <img src="${creator.image_url || ''}" alt="" class="w-full h-full object-cover opacity-80">
                </div>
                <div class="p-6">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="font-bold text-gray-900 dark:text-white">${creator.name}</h3>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${creator.role}</p>
                        </div>
                        <div class="flex items-center text-sm">
                            <svg class="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                            </svg>
                            <span class="ml-1 font-bold text-gray-900 dark:text-white">${creator.rating}</span>
                            <span class="ml-1 text-gray-400">(${creator.review_count})</span>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${creator.location || ''}</p>
                    <div class="flex items-center justify-between pt-4 border-t border-secondary dark:border-gray-700">
                        <div>
                            <span class="text-sm text-gray-600 dark:text-gray-400">Nuo</span>
                            <span class="font-bold text-gray-900 dark:text-white ml-1">€${creator.price_from}</span>
                        </div>
                        <button class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium" style="border-radius: 4px;">
                            Peržiūrėti
                        </button>
                    </div>
                </div>
            </div>
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
