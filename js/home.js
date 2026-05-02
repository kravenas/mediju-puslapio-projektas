// Homepage - Dynamic data loading from Supabase

document.addEventListener('DOMContentLoaded', async () => {
    setupHeroSearch();
    await Promise.all([
        loadCategories(),
        loadReviews(),
        loadStats()
    ]);
});

function setupHeroSearch() {
    const input = document.getElementById('hero-search');
    const btn = document.getElementById('hero-search-btn');
    if (!input || !btn) return;

    function doSearch() {
        const q = input.value.trim();
        if (q) {
            window.location.href = `kurejai.html?q=${encodeURIComponent(q)}`;
        } else {
            window.location.href = 'kurejai.html';
        }
    }

    btn.addEventListener('click', doSearch);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
    });

    // Make popular search tags clickable
    document.querySelectorAll('.popular-search-tag').forEach(tag => {
        tag.style.cursor = 'pointer';
        tag.addEventListener('click', () => {
            window.location.href = `kurejai.html?q=${encodeURIComponent(tag.textContent.trim())}`;
        });
    });
}

// Load categories with creator counts
async function loadCategories() {
    const container = document.getElementById('categories-grid');
    if (!container) return;

    const bgColors = {
        'vestuves': 'bg-pink-500',
        'corporate': 'bg-blue-500',
        'produktai': 'bg-yellow-500',
        'maistas': 'bg-red-500',
        'video': 'bg-purple-500',
        'nekilnojamas-turtas': 'bg-teal-500',
        'portretai': 'bg-green-500',
        'dronas': 'bg-sky-500'
    };

    const categoryIcons = {
        'vestuves': '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>',
        'corporate': '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>',
        'produktai': '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>',
        'maistas': '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265z"/></svg>',
        'video': '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25z"/></svg>',
        'nekilnojamas-turtas': '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>',
        'portretai': '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>',
        'dronas': '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>'
    };

    // Only show the 8 main categories (not sidebar subcategories)
    const MAIN_SLUGS = ['vestuves', 'corporate', 'produktai', 'maistas', 'video', 'nekilnojamas-turtas', 'portretai', 'dronas'];

    const { data: categories, error } = await supabase
        .from('categories')
        .select('*, creator_categories(count)')
        .in('slug', MAIN_SLUGS)
        .order('id');

    if (error) {
        console.error('Error loading categories:', error);
        return;
    }

    container.innerHTML = categories.map(cat => {
        const count = cat.creator_categories?.[0]?.count || 0;
        const bg = bgColors[cat.slug] || 'bg-gray-500';
        return `
            <a href="kurejai.html?category=${cat.slug}" class="card-hover bg-white dark:bg-gray-900 border border-secondary dark:border-gray-700 p-6 hover:border-primary" style="border-radius: 6px;">
                <div class="w-12 h-12 ${bg} flex items-center justify-center mb-4" style="border-radius: 6px;">
                    ${categoryIcons[cat.slug] || '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/></svg>'}
                </div>
                <h3 class="font-bold text-gray-900 dark:text-white mb-1">${escapeHtml(cat.name)}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">${count} kūrėjų</p>
            </a>
        `;
    }).join('');
}

// Load latest reviews
async function loadReviews() {
    const container = document.getElementById('reviews-grid');
    if (!container) return;

    const { data: reviews, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Error loading reviews:', error);
        return;
    }

    container.innerHTML = reviews.map(review => {
        const authorName = review.author_name || '';
        const initial = escapeHtml(authorName.charAt(0));
        const rating = Math.max(0, Math.min(5, parseInt(review.rating, 10) || 0));
        const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        return `
            <div class="bg-gray-50 dark:bg-gray-800 border border-secondary dark:border-gray-700 p-8" style="border-radius: 8px;">
                <div class="flex items-center gap-1 mb-4">
                    <span class="text-primary text-xl">${stars}</span>
                </div>
                <p class="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                    "${escapeHtml(review.content)}"
                </p>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary flex items-center justify-center text-white font-bold" style="border-radius: 8px;">${initial}</div>
                    <div>
                        <div class="font-semibold text-gray-900 dark:text-white">${escapeHtml(authorName)}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(review.author_location || '')}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Load aggregate stats
async function loadStats() {
    const creatorsEl = document.getElementById('stat-creators');
    const reviewsEl = document.getElementById('stat-reviews');
    const ratingEl = document.getElementById('stat-rating');
    if (!creatorsEl) return;

    const [creatorsRes, reviewsRes] = await Promise.all([
        supabase.from('creators').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('reviews').select('rating')
    ]);

    const totalCreators = creatorsRes.count || 0;
    const reviews = reviewsRes.data || [];
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
        : '0.0';

    if (creatorsEl) creatorsEl.textContent = totalCreators > 100 ? `${totalCreators}+` : totalCreators;
    if (reviewsEl) reviewsEl.textContent = totalReviews > 100 ? `${totalReviews}+` : totalReviews;
    if (ratingEl) ratingEl.textContent = `${avgRating}★`;
}
