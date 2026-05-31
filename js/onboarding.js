// Onboarding wizard. Strict — user can't proceed until all required fields filled.
(function () {
    'use strict';
    if (typeof supabase === 'undefined') return;

    let currentUser = null;
    let currentStep = 1;
    const state = {
        name: '',
        location: '',
        role: '', // 'klientas' | 'kurejas'
        creatorRole: '', // Fotografas / Videografas / etc
        price: null,
        interests: [],
        budget: '',
        bio: '',
    };

    function qs(s) { return document.querySelector(s); }
    function qsa(s) { return document.querySelectorAll(s); }

    function showStep(n) {
        currentStep = n;
        qsa('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== String(n)));
        qsa('.step-dot').forEach(d => {
            const sn = parseInt(d.dataset.step);
            d.classList.remove('done', 'current');
            d.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-500');
            if (sn < n) {
                d.classList.add('done');
            } else if (sn === n) {
                d.classList.add('current');
            } else {
                d.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-500');
            }
        });
        const p12 = qs('#progress-1-2'); if (p12) p12.style.width = n >= 2 ? '100%' : '0';
        const p23 = qs('#progress-2-3'); if (p23) p23.style.width = n >= 3 ? '100%' : '0';
    }

    function err(id, msg) {
        const el = qs(id);
        if (!el) return;
        if (msg) {
            el.textContent = msg;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    async function init() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            window.location.href = 'prisijungimas.html?redirect=onboarding.html';
            return;
        }
        currentUser = session.user;

        // Prefill from metadata if any
        const meta = currentUser.user_metadata || {};
        if (meta.name) {
            qs('#ob-name').value = meta.name;
            state.name = meta.name;
        }
        if (meta.role === 'kurejas' || meta.role === 'klientas') {
            state.role = meta.role;
            qsa('.ob-role-btn').forEach(b => {
                if (b.dataset.rolePick === meta.role) {
                    b.classList.add('border-primary', 'bg-primary/10');
                }
            });
        }

        // If already onboarded, skip
        const { data: profile } = await supabase.from('profiles').select('onboarded_at').eq('id', currentUser.id).maybeSingle();
        if (profile?.onboarded_at) {
            window.location.href = 'profilis.html';
            return;
        }

        wireStep1();
        wireStep2();
        wireStep3();
    }

    function wireStep1() {
        qsa('.ob-role-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                qsa('.ob-role-btn').forEach(b => b.classList.remove('border-primary', 'bg-primary/10'));
                btn.classList.add('border-primary', 'bg-primary/10');
                state.role = btn.dataset.rolePick;
            });
        });

        qs('#step1-next').addEventListener('click', () => {
            state.name = qs('#ob-name').value.trim();
            state.location = qs('#ob-location').value;

            if (!state.name || state.name.length < 2) return err('#step1-error', 'Įvesk savo vardą (min 2 simboliai).');
            if (!state.location) return err('#step1-error', 'Pasirink miestą.');
            if (!state.role) return err('#step1-error', 'Pasirink ar esi klientas, ar kūrėjas.');
            err('#step1-error', null);

            // Configure step 2 based on role
            if (state.role === 'kurejas') {
                qs('#step2-title').textContent = 'Tavo profesija ir kainos';
                qs('#step2-subtitle').textContent = 'Tai pamatys klientai. Galėsi tikslinti vėliau.';
                qs('#step2-creator').classList.remove('hidden');
                qs('#step2-client').classList.add('hidden');
            } else {
                qs('#step2-title').textContent = 'Ko ieškai?';
                qs('#step2-subtitle').textContent = 'Padės tau parodyti tinkamus kūrėjus.';
                qs('#step2-client').classList.remove('hidden');
                qs('#step2-creator').classList.add('hidden');
            }
            showStep(2);
        });
    }

    function wireStep2() {
        qsa('.ob-tag-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;
                if (state.interests.includes(tag)) {
                    state.interests = state.interests.filter(t => t !== tag);
                    btn.classList.remove('border-primary', 'bg-primary/10', 'text-primary');
                } else {
                    state.interests.push(tag);
                    btn.classList.add('border-primary', 'bg-primary/10', 'text-primary');
                }
            });
        });

        qs('#step2-back').addEventListener('click', () => showStep(1));

        qs('#step2-next').addEventListener('click', () => {
            err('#step2-error', null);
            if (state.role === 'kurejas') {
                state.creatorRole = qs('#ob-role').value;
                const priceRaw = qs('#ob-price').value;
                state.price = priceRaw ? parseInt(priceRaw) : null;
                if (!state.creatorRole) return err('#step2-error', 'Pasirink profesiją.');
                if (state.price === null || isNaN(state.price) || state.price < 0) return err('#step2-error', 'Įvesk kainą (gali būti 0 jei kuri portfolio).');
            } else {
                state.budget = qs('#ob-budget').value;
                if (state.interests.length === 0) return err('#step2-error', 'Pasirink bent vieną sritį.');
                if (!state.budget) return err('#step2-error', 'Pasirink biudžeto rėžį.');
            }
            showStep(3);
        });
    }

    function wireStep3() {
        const fileInput = qs('#ob-avatar');
        fileInput.addEventListener('change', () => {
            const f = fileInput.files?.[0];
            if (f) qs('#ob-avatar-preview').classList.remove('hidden');
        });

        qs('#step3-back').addEventListener('click', () => showStep(2));

        qs('#step3-finish').addEventListener('click', async () => {
            err('#step3-error', null);
            const btn = qs('#step3-finish');
            btn.disabled = true;
            btn.textContent = 'Saugoma...';
            try {
                state.bio = qs('#ob-bio').value.trim();
                await persist();
                window.location.href = 'profilis.html?welcome=1';
            } catch (e) {
                err('#step3-error', e.message);
                btn.disabled = false;
                btn.textContent = 'Užbaigti ✓';
            }
        });
    }

    async function persist() {
        // 1. Update profile
        const profileUpdate = {
            id: currentUser.id,
            name: state.name,
            role: state.role,
            location: state.location,
            bio: state.bio || null,
            onboarded_at: new Date().toISOString(),
        };
        const { error: pErr } = await supabase.from('profiles').upsert(profileUpdate);
        if (pErr) throw new Error('Profilio klaida: ' + pErr.message);

        // 2. Update auth metadata
        await supabase.auth.updateUser({ data: { name: state.name, role: state.role } });

        // 3. If creator: create creators row (status=pending for admin review)
        if (state.role === 'kurejas') {
            const { data: existing } = await supabase.from('creators').select('id').eq('user_id', currentUser.id).maybeSingle();
            if (!existing) {
                const { error: cErr } = await supabase.from('creators').insert({
                    user_id: currentUser.id,
                    name: state.name,
                    role: state.creatorRole,
                    location: state.location,
                    bio: state.bio || null,
                    price_from: state.price ?? 0,
                    price_label: state.price ? `Nuo €${state.price}` : 'Pagal susitarimą',
                    rating: 0,
                    review_count: 0,
                    portfolio_current: 0,
                    status: 'pending',
                    is_rising_star: false,
                });
                if (cErr) throw new Error('Kūrėjo profilio klaida: ' + cErr.message);
            }
        }

        // 4. Avatar upload (optional)
        const fileInput = qs('#ob-avatar');
        const file = fileInput.files?.[0];
        if (file) {
            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `${currentUser.id}/avatar.${ext}`;
            const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
            if (!upErr) {
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                const avatarUrl = (urlData?.publicUrl || '') + '?t=' + Date.now();
                await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
                await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
                if (state.role === 'kurejas') {
                    await supabase.from('creators').update({ image_url: avatarUrl }).eq('user_id', currentUser.id);
                }
            }
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
