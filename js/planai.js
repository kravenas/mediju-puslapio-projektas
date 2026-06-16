// =============================================
// Planai & Badges – purchase flow (test mode)
// =============================================

const BADGE_PRICES = { quality: '4.99', promoted: '9.99' };
const BADGE_LABELS = { quality: 'Kokybės ženkliukas', promoted: 'Promoted ženkliukas' };

let currentUser = null;
let currentCreator = null;
let activeBadges = [];

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    if (user) {
        const { data: creator } = await supabase
            .from('creators')
            .select('id')
            .eq('user_id', user.id)
            .single();
        currentCreator = creator;

        if (creator) {
            await loadActiveBadges(creator.id);
        }

        // Load subscription status
        await loadSubscriptionStatus();
    }

    setupBadgeButtons();
    setupProButton();
});

// ---- Subscription status on plans page ----
async function loadSubscriptionStatus() {
    if (!window.medijusSubscription) return;

    const sub = await window.medijusSubscription.getSubscription();
    const statusEl = document.getElementById('plan-status');
    const proBtn = document.getElementById('activate-pro-btn');
    if (!statusEl || !proBtn) return;

    if (!sub) {
        statusEl.textContent = 'Prisijunkite, kad aktyvuotumėte Pro planą';
        return;
    }

    if (sub.plan === 'pro' && sub.status === 'active') {
        proBtn.textContent = '✓ Pro planas aktyvus';
        proBtn.classList.remove('bg-primary', 'hover:bg-primary-hover');
        proBtn.classList.add('bg-green-500', 'cursor-default');
        proBtn.disabled = true;
        statusEl.textContent = `Galioja iki ${new Date(sub.paid_ends_at).toLocaleDateString('lt-LT')}`;
    } else if (sub.status === 'expired') {
        statusEl.innerHTML = '<span style="color:#ef4444;">Pro planas baigėsi — aktyvuok iš naujo</span>';
        proBtn.textContent = 'Aktyvuoti Pro planą — €10/mėn';
    } else {
        // free plan
        statusEl.textContent = 'Naudojiesi nemokamu planu — aktyvuok Pro, kad atrakintum naujokus.';
    }

    // Check for review discount
    const reviewCount = await window.medijusSubscription.getUserReviewCount();
    if (reviewCount > 0 && window.medijusSubscription.canGetReviewDiscount(sub)) {
        const priceInfo = window.medijusSubscription.getPrice(sub);
        if (priceInfo.hasDiscount) {
            proBtn.innerHTML = `Aktyvuoti Pro — <s>€${priceInfo.original}</s> €${priceInfo.price}/mėn`;
        }
    }
}

// ---- Pro plan button ----
function setupProButton() {
    const proBtn = document.getElementById('activate-pro-btn');
    if (!proBtn) return;

    proBtn.addEventListener('click', async () => {
        if (!currentUser) {
            window.location.href = 'prisijungimas.html';
            return;
        }

        if (proBtn.disabled) return;

        const sub = await window.medijusSubscription.getSubscription();
        if (sub?.plan === 'pro' && sub?.status === 'active') return;

        // Check for review discount
        const reviewCount = await window.medijusSubscription.getUserReviewCount();
        const useDiscount = reviewCount > 0 && window.medijusSubscription.canGetReviewDiscount(sub);

        proBtn.disabled = true;
        proBtn.textContent = 'Aktyvuojama...';

        const result = await window.medijusSubscription.activateProPlan(useDiscount);

        if (result.error) {
            showBadgeNotification('Klaida: ' + result.error, 'error');
            proBtn.disabled = false;
            proBtn.textContent = 'Aktyvuoti Pro planą';
            return;
        }

        const priceInfo = window.medijusSubscription.getPrice(sub);
        const paidAmount = useDiscount ? priceInfo.price : priceInfo.original;

        showBadgeNotification(`Pro planas aktyvuotas! Mokėjimas: €${paidAmount}. Galioja 30 dienų.`, 'success');
        await loadSubscriptionStatus();
    });
}

// ---- Load active badges ----
async function loadActiveBadges(creatorId) {
    const { data } = await supabase
        .from('creator_badges')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('active', true);
    activeBadges = data || [];
    updateButtonStates();
}

// ---- Update button states based on owned badges ----
function updateButtonStates() {
    const qualityBtn = document.getElementById('buy-quality-badge');
    const promotedBtn = document.getElementById('buy-promoted-badge');

    if (!qualityBtn || !promotedBtn) return;

    const hasQuality = activeBadges.some(b => b.badge_type === 'quality');
    const hasPromoted = activeBadges.some(b => b.badge_type === 'promoted');

    if (hasQuality) {
        qualityBtn.innerHTML = '<span class="flex items-center justify-center gap-2">✓ Ženkliukas aktyvus</span>';
        qualityBtn.classList.remove('border-emerald-500', 'text-emerald-600', 'dark:text-emerald-400', 'hover:bg-emerald-50', 'dark:hover:bg-emerald-900/20');
        qualityBtn.classList.add('bg-emerald-500', 'text-white', 'cursor-default');
        qualityBtn.onclick = null;
    }

    if (hasPromoted) {
        promotedBtn.innerHTML = '<span class="flex items-center justify-center gap-2">✓ Ženkliukas aktyvus</span>';
        promotedBtn.classList.remove('border-purple-500', 'text-purple-600', 'dark:text-purple-400', 'hover:bg-purple-50', 'dark:hover:bg-purple-900/20');
        promotedBtn.classList.add('bg-purple-500', 'text-white', 'cursor-default');
        promotedBtn.onclick = null;
    }
}

// ---- Setup badge buttons ----
function setupBadgeButtons() {
    const qualityBtn = document.getElementById('buy-quality-badge');
    const promotedBtn = document.getElementById('buy-promoted-badge');

    if (qualityBtn) {
        qualityBtn.addEventListener('click', handleQualityBadgeClick);
    }
    if (promotedBtn) {
        promotedBtn.addEventListener('click', () => openPurchaseModal('promoted'));
    }

    // Load existing application status
    if (currentCreator) {
        loadBadgeApplicationStatus();
    }
}

// ---- Quality badge application flow ----
let qualityFormVisible = false;

async function loadBadgeApplicationStatus() {
    if (!currentUser || !currentCreator) return;

    const { data: app } = await supabase
        .from('badge_applications')
        .select('*')
        .eq('creator_id', currentCreator.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!app) return;

    const qualityBtn = document.getElementById('buy-quality-badge');
    const statusEl = document.getElementById('qa-status');
    const formEl = document.getElementById('quality-form');
    if (!qualityBtn || !statusEl) return;

    if (app.status === 'pending') {
        qualityBtn.textContent = '⏳ Paraiška peržiūrima';
        qualityBtn.classList.remove('border-emerald-500', 'text-emerald-600', 'dark:text-emerald-400', 'hover:bg-emerald-50', 'dark:hover:bg-emerald-900/20');
        qualityBtn.classList.add('bg-yellow-100', 'dark:bg-yellow-900/20', 'text-yellow-700', 'dark:text-yellow-400', 'border-yellow-400', 'cursor-default');
        qualityBtn.disabled = true;
        statusEl.textContent = `Pateikta: ${new Date(app.created_at).toLocaleDateString('lt-LT')}`;
        if (formEl) formEl.classList.add('hidden');
    } else if (app.status === 'approved') {
        qualityBtn.innerHTML = '<span class="flex items-center justify-center gap-2">✓ Ženkliukas suteiktas</span>';
        qualityBtn.classList.remove('border-emerald-500', 'text-emerald-600', 'dark:text-emerald-400', 'hover:bg-emerald-50', 'dark:hover:bg-emerald-900/20');
        qualityBtn.classList.add('bg-emerald-500', 'text-white', 'cursor-default');
        qualityBtn.disabled = true;
        statusEl.textContent = 'Kokybės ženkliukas aktyvus';
        statusEl.classList.remove('text-gray-400');
        statusEl.classList.add('text-emerald-500');
        if (formEl) formEl.classList.add('hidden');
    } else if (app.status === 'rejected') {
        statusEl.innerHTML = `<span class="text-red-500">Paraiška atmesta${app.admin_note ? ': ' + app.admin_note : ''}. Galite pateikti iš naujo.</span>`;
        // Allow resubmission — keep button enabled
    }
}

async function handleQualityBadgeClick() {
    if (!currentUser) {
        showBadgeNotification('Prisijunkite, kad galėtumėte pateikti paraišką', 'error');
        setTimeout(() => { window.location.href = 'prisijungimas.html'; }, 1500);
        return;
    }

    if (!currentCreator) {
        showBadgeNotification('Tik kūrėjai gali pateikti paraišką. Sukurkite kūrėjo profilį.', 'error');
        return;
    }

    const formEl = document.getElementById('quality-form');
    const qualityBtn = document.getElementById('buy-quality-badge');
    if (!formEl) return;

    // First click — show the form
    if (!qualityFormVisible) {
        formEl.classList.remove('hidden');
        qualityFormVisible = true;
        qualityBtn.textContent = 'Siųsti paraišką';
        qualityBtn.classList.remove('border-emerald-500', 'text-emerald-600', 'dark:text-emerald-400', 'hover:bg-emerald-50', 'dark:hover:bg-emerald-900/20');
        qualityBtn.classList.add('bg-emerald-500', 'text-white', 'hover:bg-emerald-600');
        return;
    }

    // Second click — submit the form
    const portfolioUrl = document.getElementById('qa-portfolio-url').value.trim();
    const message = document.getElementById('qa-message').value.trim();
    const errorEl = document.getElementById('qa-error');

    if (!portfolioUrl) {
        errorEl.textContent = 'Įveskite portfolio nuorodą';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        new URL(portfolioUrl);
    } catch {
        errorEl.textContent = 'Neteisingas URL formatas';
        errorEl.classList.remove('hidden');
        return;
    }

    errorEl.classList.add('hidden');
    qualityBtn.disabled = true;
    qualityBtn.textContent = 'Siunčiama...';

    const { error } = await supabase
        .from('badge_applications')
        .insert({
            creator_id: currentCreator.id,
            user_id: currentUser.id,
            portfolio_url: portfolioUrl,
            message: message || null,
        });

    if (error) {
        showBadgeNotification('Klaida: ' + error.message, 'error');
        qualityBtn.disabled = false;
        qualityBtn.textContent = 'Siųsti paraišką';
        return;
    }

    showBadgeNotification('Paraiška pateikta! Peržiūrėsime per 1–3 darbo dienas.', 'success');
    qualityFormVisible = false;
    await loadBadgeApplicationStatus();
}

// ---- Open purchase modal ----
function openPurchaseModal(badgeType) {
    if (!currentUser) {
        showBadgeNotification('Prisijunkite, kad galėtumėte įsigyti ženkliuką', 'error');
        setTimeout(() => { window.location.href = 'prisijungimas.html'; }, 1500);
        return;
    }

    if (!currentCreator) {
        showBadgeNotification('Tik kūrėjai gali įsigyti ženkliukus. Sukurkite kūrėjo profilį.', 'error');
        return;
    }

    if (activeBadges.some(b => b.badge_type === badgeType)) {
        showBadgeNotification('Šis ženkliukas jau aktyvus!', 'info');
        return;
    }

    const modal = document.getElementById('purchase-modal');
    const title = document.getElementById('modal-badge-title');
    const price = document.getElementById('modal-badge-price');
    const icon = document.getElementById('modal-badge-icon');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    title.textContent = BADGE_LABELS[badgeType];
    price.textContent = `€${BADGE_PRICES[badgeType]}/mėn`;
    document.getElementById('modal-badge-total').textContent = `€${BADGE_PRICES[badgeType]}`;

    if (badgeType === 'quality') {
        icon.innerHTML = '<svg class="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>';
        confirmBtn.className = 'w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold disabled:opacity-50';
        confirmBtn.style.borderRadius = '6px';
    } else {
        icon.innerHTML = '<svg class="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>';
        confirmBtn.className = 'w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold disabled:opacity-50';
        confirmBtn.style.borderRadius = '6px';
    }

    confirmBtn.onclick = () => purchaseBadge(badgeType);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// ---- Close modal ----
function closePurchaseModal() {
    const modal = document.getElementById('purchase-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// ---- Purchase badge (test mode – no real payment) ----
async function purchaseBadge(badgeType) {
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const originalText = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Apdorojama...';

    // Simulate payment delay
    await new Promise(r => setTimeout(r, 1200));

    const { data, error } = await supabase
        .from('creator_badges')
        .upsert({
            creator_id: currentCreator.id,
            badge_type: badgeType,
            active: true,
            purchased_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, { onConflict: 'creator_id,badge_type' })
        .select()
        .single();

    confirmBtn.disabled = false;
    confirmBtn.textContent = originalText;

    closePurchaseModal();

    if (error) {
        console.error('Badge purchase error:', error);
        showBadgeNotification('Klaida įsigyjant ženkliuką: ' + error.message, 'error');
        return;
    }

    activeBadges.push(data);
    updateButtonStates();
    showBadgeNotification(`${BADGE_LABELS[badgeType]} sėkmingai aktyvuotas! Galioja 30 dienų.`, 'success');
}

// ---- Notification ----
function showBadgeNotification(message, type) {
    // Remove existing
    const existing = document.getElementById('badge-notification');
    if (existing) existing.remove();

    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };

    const div = document.createElement('div');
    div.id = 'badge-notification';
    div.className = `fixed top-20 left-1/2 -translate-x-1/2 z-[9999] ${colors[type] || colors.info} text-white px-6 py-3 font-medium shadow-lg`;
    div.style.borderRadius = '8px';
    div.style.maxWidth = '90vw';
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => {
        div.style.transition = 'opacity 0.3s';
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 300);
    }, 4000);
}
