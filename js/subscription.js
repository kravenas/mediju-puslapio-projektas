// =============================================
// Medijus Subscription Module
// =============================================

(function () {
    'use strict';

    const PLAN_PRICE = 10; // €10/month
    const REVIEW_DISCOUNT_PERCENT = 50; // 50% off for leaving a review
    const TRIAL_DAYS = 14;
    const MAX_TRIALS_PER_IP = 2; // max trial accounts from same IP

    // --- Get client IP address ---

    async function getClientIP() {
        try {
            const resp = await fetch('https://api.ipify.org?format=json');
            const data = await resp.json();
            return data.ip;
        } catch (e) {
            console.warn('Could not fetch IP:', e);
            return null;
        }
    }

    // --- Check if email is verified ---

    function isEmailVerified(user) {
        return user && user.email_confirmed_at != null;
    }

    // --- Check if IP already used too many trials ---

    async function isIPBlocked(ip) {
        if (!ip) return false;

        const { count } = await supabase
            .from('trial_ip_log')
            .select('*', { count: 'exact', head: true })
            .eq('ip_address', ip);

        return (count || 0) >= MAX_TRIALS_PER_IP;
    }

    // --- Log IP for trial ---

    async function logTrialIP(userId, ip) {
        if (!ip) return;

        await supabase
            .from('trial_ip_log')
            .insert({ ip_address: ip, user_id: userId });

        // Also store on subscription
        await supabase
            .from('subscriptions')
            .update({ ip_address: ip })
            .eq('user_id', userId);
    }

    // --- Show email verification banner ---

    function showEmailVerificationBanner() {
        const existing = document.getElementById('email-verify-banner');
        if (existing) return;

        const banner = document.createElement('div');
        banner.id = 'email-verify-banner';
        banner.style.cssText = 'position:fixed;top:64px;left:0;right:0;z-index:9998;background:#f59e0b;color:white;text-align:center;padding:12px 16px;font-size:13px;';
        banner.innerHTML = `
            <strong>Patvirtinkite el. paštą</strong> — patikrinkite savo pašto dėžutę ir spauskite patvirtinimo nuorodą, kad aktyvuotumėte bandomąjį laikotarpį.
            <button onclick="this.parentElement.remove()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;cursor:pointer;font-size:18px;">×</button>
        `;
        document.body.appendChild(banner);
    }

    // --- Show IP blocked message ---

    function showIPBlockedMessage() {
        const existing = document.getElementById('ip-blocked-banner');
        if (existing) return;

        const banner = document.createElement('div');
        banner.id = 'ip-blocked-banner';
        banner.style.cssText = 'position:fixed;top:64px;left:0;right:0;z-index:9998;background:#ef4444;color:white;text-align:center;padding:12px 16px;font-size:13px;';
        banner.innerHTML = `
            Bandomasis laikotarpis negalimas — pasiektas registracijų limitas. <a href="planai.html" style="text-decoration:underline;font-weight:700;">Įsigykite Pro planą</a>
            <button onclick="this.parentElement.remove()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;cursor:pointer;font-size:18px;">×</button>
        `;
        document.body.appendChild(banner);
    }

    // --- Get current subscription ---

    async function getSubscription() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: sub } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!sub) return null;

        // Check if trial/paid has expired
        if (sub.plan === 'trial' && sub.status === 'active') {
            const trialEnd = new Date(sub.trial_ends_at);
            if (trialEnd < new Date()) {
                await supabase
                    .from('subscriptions')
                    .update({ status: 'expired', updated_at: new Date().toISOString() })
                    .eq('id', sub.id);
                sub.status = 'expired';
            }
        }

        if (sub.plan === 'pro' && sub.status === 'active' && sub.paid_ends_at) {
            const paidEnd = new Date(sub.paid_ends_at);
            if (paidEnd < new Date()) {
                await supabase
                    .from('subscriptions')
                    .update({ status: 'expired', updated_at: new Date().toISOString() })
                    .eq('id', sub.id);
                sub.status = 'expired';
            }
        }

        return sub;
    }

    // --- Check if user has active subscription ---

    async function hasActiveSubscription() {
        const sub = await getSubscription();
        return sub && sub.status === 'active';
    }

    // --- Get days remaining ---

    function getDaysRemaining(sub) {
        if (!sub || sub.status !== 'active') return 0;

        let endDate;
        if (sub.plan === 'trial') {
            endDate = new Date(sub.trial_ends_at);
        } else if (sub.plan === 'pro') {
            endDate = new Date(sub.paid_ends_at);
        }

        if (!endDate) return 0;
        const diff = endDate - new Date();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // --- Check if user can get review discount ---

    function canGetReviewDiscount(sub) {
        if (!sub) return false;
        return sub.review_discount_used < sub.review_discount_max;
    }

    // --- Calculate price with potential discount ---

    function getPrice(sub) {
        if (canGetReviewDiscount(sub)) {
            const discounted = PLAN_PRICE * (1 - REVIEW_DISCOUNT_PERCENT / 100);
            return { price: discounted, original: PLAN_PRICE, hasDiscount: true };
        }
        return { price: PLAN_PRICE, original: PLAN_PRICE, hasDiscount: false };
    }

    // --- Activate pro plan (test mode) ---

    async function activateProPlan(useReviewDiscount) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Neprisijungta' };

        const sub = await getSubscription();
        if (!sub) return { error: 'Prenumerata nerasta' };

        const updateData = {
            plan: 'pro',
            status: 'active',
            paid_started_at: new Date().toISOString(),
            paid_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
        };

        if (useReviewDiscount && canGetReviewDiscount(sub)) {
            updateData.review_discount_used = sub.review_discount_used + 1;
        }

        const { data, error } = await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('id', sub.id)
            .select()
            .single();

        if (error) return { error: error.message };
        return { data };
    }

    // --- Check if user has left any reviews ---

    async function getUserReviewCount() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 0;

        // Check reviews by user's profile name or email
        const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile?.name) return 0;

        const { count } = await supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('author_name', profile.name);

        return count || 0;
    }

    // --- Show welcome popup for new users ---

    function showWelcomePopup() {
        // Check if already shown
        if (localStorage.getItem('medijus-welcome-shown')) return;

        const overlay = document.createElement('div');
        overlay.id = 'welcome-popup';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);padding:1rem;';

        overlay.innerHTML = `
            <div style="background:white;border-radius:12px;max-width:480px;width:100%;padding:2.5rem;text-align:center;position:relative;" class="dark:bg-gray-900">
                <button onclick="document.getElementById('welcome-popup').remove()" style="position:absolute;top:12px;right:12px;background:none;border:none;cursor:pointer;padding:4px;">
                    <svg width="20" height="20" fill="none" stroke="#9ca3af" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12"/></svg>
                </button>

                <div style="width:64px;height:64px;background:linear-gradient(135deg,#D4A017,#B8860B);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
                    <svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>

                <h2 style="font-size:24px;font-weight:800;color:#111827;margin-bottom:8px;" class="dark:text-white">Sveiki atvykę!</h2>
                <p style="font-size:15px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6;">
                    Jūsų <strong style="color:#D4A017;">nemokamas 14 dienų planas</strong> aktyvuotas! Naudokitės visomis paslaugomis — naujokų paieška, žinutės, užsakymai.
                </p>

                <div style="background:#f9fafb;border-radius:8px;padding:1rem;margin-bottom:1.5rem;text-align:left;" class="dark:bg-gray-800">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                        <svg width="18" height="18" fill="none" stroke="#22c55e" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                        <span style="font-size:13px;color:#374151;" class="dark:text-gray-300">Prieiga prie visų kūrėjų ir naujokų</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                        <svg width="18" height="18" fill="none" stroke="#22c55e" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                        <span style="font-size:13px;color:#374151;" class="dark:text-gray-300">Žinutės su kūrėjais</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <svg width="18" height="18" fill="none" stroke="#22c55e" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                        <span style="font-size:13px;color:#374151;" class="dark:text-gray-300">Paslaugų užsakymas ir mokėjimai</span>
                    </div>
                </div>

                <button class="bg-primary" onclick="document.getElementById('welcome-popup').remove()" style="width:100%;padding:12px;background:#D4A017;color:white;font-weight:700;font-size:15px;border:none;border-radius:6px;cursor:pointer;">
                    Pradėti naršyti
                </button>

                <p style="font-size:12px;color:#9ca3af;margin-top:12px;">
                    Po 14 dienų — tik €10/mėn. Palikite atsiliepimą ir gaukite 10% nuolaidą!
                </p>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        localStorage.setItem('medijus-welcome-shown', 'true');
    }

    // --- Show trial expiry banner ---

    function showTrialBanner(daysLeft) {
        if (daysLeft > 7) return; // Only show when 7 or fewer days left

        const existing = document.getElementById('trial-banner');
        if (existing) return;

        const banner = document.createElement('div');
        banner.id = 'trial-banner';

        let message, bgColor;
        if (daysLeft <= 0) {
            message = 'Jūsų bandomasis laikotarpis baigėsi. <a href="planai.html" style="text-decoration:underline;font-weight:700;">Aktyvuokite Pro planą</a>';
            bgColor = '#ef4444';
        } else if (daysLeft <= 3) {
            message = `Jūsų bandomasis laikotarpis baigiasi po <strong>${daysLeft} d.</strong> <a href="planai.html" style="text-decoration:underline;font-weight:700;">Aktyvuokite Pro</a>`;
            bgColor = '#f59e0b';
        } else {
            message = `Bandomasis laikotarpis: liko <strong>${daysLeft} dienos</strong>. <a href="planai.html" style="text-decoration:underline;">Peržiūrėti planus</a>`;
            bgColor = '#3b82f6';
        }

        banner.style.cssText = `position:fixed;bottom:0;left:0;right:0;z-index:9998;background:${bgColor};color:white;text-align:center;padding:10px 16px;font-size:13px;`;
        banner.innerHTML = `
            ${message}
            <button onclick="this.parentElement.remove()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;cursor:pointer;font-size:18px;">×</button>
        `;
        document.body.appendChild(banner);
    }

    // --- Init subscription checks on page load ---

    async function initSubscription() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Check email verification
        if (!isEmailVerified(user)) {
            showEmailVerificationBanner();
            return; // Don't activate anything until email is verified
        }

        const sub = await getSubscription();
        if (!sub) return;

        // 2. For new trial users — check IP and log it
        if (sub.plan === 'trial' && sub.status === 'active' && !sub.ip_address) {
            const ip = await getClientIP();

            if (ip) {
                const blocked = await isIPBlocked(ip);
                if (blocked) {
                    // Deactivate trial — too many trials from this IP
                    await supabase
                        .from('subscriptions')
                        .update({
                            status: 'expired',
                            ip_address: ip,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', sub.id);
                    sub.status = 'expired';
                    showIPBlockedMessage();
                    return;
                }

                // Log this IP as used for trial
                await logTrialIP(user.id, ip);
            }
        }

        // 3. Show welcome popup for new trial users (first visit)
        if (sub.plan === 'trial' && sub.status === 'active') {
            const created = new Date(sub.created_at);
            const now = new Date();
            const hoursSinceCreation = (now - created) / (1000 * 60 * 60);
            if (hoursSinceCreation < 1) {
                showWelcomePopup();
            }
        }

        // 4. Show trial expiry banner
        if (sub.plan === 'trial') {
            const daysLeft = getDaysRemaining(sub);
            showTrialBanner(daysLeft);
        }
    }

    // --- Expose globally ---

    window.medijusSubscription = {
        getSubscription,
        hasActiveSubscription,
        getDaysRemaining,
        canGetReviewDiscount,
        getPrice,
        activateProPlan,
        getUserReviewCount,
        showWelcomePopup,
        initSubscription,
        isEmailVerified,
        isIPBlocked,
        getClientIP,
        PLAN_PRICE,
        REVIEW_DISCOUNT_PERCENT,
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSubscription);
    } else {
        initSubscription();
    }
})();
