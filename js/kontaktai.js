// =============================================
// Medijus — Contact form (kontaktai.html)
// Submits to Supabase public.contact_messages
// =============================================

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const form = document.getElementById('contact-form');
        if (!form || typeof supabase === 'undefined') return;

        const statusEl = document.getElementById('cf-status');
        const submitBtn = document.getElementById('cf-submit');

        function setStatus(msg, kind) {
            statusEl.textContent = msg;
            const colors = {
                error: 'text-red-600 dark:text-red-400',
                success: 'text-green-600 dark:text-green-400',
                '': 'text-gray-500 dark:text-gray-400'
            };
            statusEl.className = 'text-sm ' + (colors[kind] || colors['']);
        }

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const name = document.getElementById('cf-name').value.trim();
            const email = document.getElementById('cf-email').value.trim();
            const message = document.getElementById('cf-message').value.trim();

            if (!name || !email || !message) {
                setStatus('Užpildykite visus laukus.', 'error');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                setStatus('Įveskite teisingą el. pašto adresą.', 'error');
                return;
            }
            if (message.length < 5) {
                setStatus('Žinutė per trumpa.', 'error');
                return;
            }

            const original = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Siunčiama…';
            setStatus('', '');

            try {
                const { error } = await supabase
                    .from('contact_messages')
                    .insert({ name, email, message });
                if (error) throw error;

                form.reset();
                setStatus('Ačiū! Žinutė išsiųsta — atsakysime per 1–2 darbo dienas.', 'success');
            } catch (err) {
                console.error('[kontaktai] insert error:', err);
                setStatus('Nepavyko išsiųsti. Bandykite vėliau arba rašykite info@medijus.lt.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = original;
            }
        });
    });
})();
