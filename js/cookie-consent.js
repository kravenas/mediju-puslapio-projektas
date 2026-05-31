(function () {
    const KEY = 'medijus-cookie-consent-v1';

    if (localStorage.getItem(KEY)) return;

    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Slapukų sutikimas');
    banner.style.cssText = 'position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:9999;max-width:42rem;margin:0 auto;background:#111827;color:#fff;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.25);padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0.75rem;font-family:Inter,-apple-system,sans-serif;font-size:0.875rem;line-height:1.5;';

    banner.innerHTML = `
        <div>
            <strong style="display:block;margin-bottom:0.25rem;font-size:0.95rem;">Slapukai</strong>
            <span style="color:#d1d5db;">
                Naudojame būtinuosius slapukus svetainės veikimui (prisijungimui, nuostatoms) ir analitinius — klaidų stebėsenai per Sentry.
                Plačiau — <a href="privatumo-politika.html" style="color:#FFC50F;text-decoration:underline;">Privatumo politika</a>.
            </span>
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;flex-wrap:wrap;">
            <button id="cookie-reject" type="button" style="padding:0.5rem 1rem;background:transparent;color:#d1d5db;border:1px solid #374151;border-radius:6px;cursor:pointer;font-size:0.875rem;font-weight:500;">Tik būtinieji</button>
            <button id="cookie-accept" type="button" style="padding:0.5rem 1.25rem;background:#FFC50F;color:#111827;border:none;border-radius:6px;cursor:pointer;font-size:0.875rem;font-weight:600;">Sutinku su visais</button>
        </div>
    `;

    function attach() {
        document.body.appendChild(banner);

        function save(level) {
            localStorage.setItem(KEY, JSON.stringify({
                level,
                timestamp: new Date().toISOString(),
            }));
            banner.style.transition = 'opacity 0.2s';
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 200);
        }

        banner.querySelector('#cookie-accept').addEventListener('click', () => save('all'));
        banner.querySelector('#cookie-reject').addEventListener('click', () => save('essential'));
    }

    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach);
})();
