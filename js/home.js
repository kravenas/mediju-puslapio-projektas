// Homepage - Dynamic data loading from Supabase

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadCategories(),
        loadReviews(),
        loadStats()
    ]);
});

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

    const { data: categories, error } = await supabase
        .from('categories')
        .select('*, creator_categories(count)')
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
                    <span class="text-2xl">${cat.emoji || ''}</span>
                </div>
                <h3 class="font-bold text-gray-900 dark:text-white mb-1">${cat.name}</h3>
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
        const initial = review.author_name.charAt(0);
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        return `
            <div class="bg-gray-50 dark:bg-gray-800 border border-secondary dark:border-gray-700 p-8" style="border-radius: 8px;">
                <div class="flex items-center gap-1 mb-4">
                    <span class="text-primary text-xl">${stars}</span>
                </div>
                <p class="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                    "${review.content}"
                </p>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary flex items-center justify-center text-white font-bold" style="border-radius: 8px;">${initial}</div>
                    <div>
                        <div class="font-semibold text-gray-900 dark:text-white">${review.author_name}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">${review.author_location || ''}</div>
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
        supabase.from('creators').select('id', { count: 'exact', head: true }),
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
