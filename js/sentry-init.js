// =============================================
// Sentry Error Tracking - Artifex
// =============================================
// Replace SENTRY_DSN with the DSN from your Sentry project.
// (Sentry → Settings → Projects → your project → Client Keys (DSN))

const SENTRY_DSN = 'REPLACE_WITH_YOUR_SENTRY_DSN';

if (typeof Sentry !== 'undefined' && SENTRY_DSN && !SENTRY_DSN.startsWith('REPLACE')) {
    Sentry.init({
        dsn: SENTRY_DSN,

        // Release tag - update when shipping a new version
        release: 'artifex@0.1.0',

        environment: window.location.hostname === 'localhost' ? 'development' : 'production',

        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                // Mask input fields and text content by default for privacy
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],

        // Performance monitoring — 100% in dev, lower in prod
        tracesSampleRate: 1.0,

        // Session replay — capture all errors, 50% of normal sessions
        replaysSessionSampleRate: 0.5,
        replaysOnErrorSampleRate: 1.0,

        // Propagate traces to our API calls (Supabase)
        tracePropagationTargets: [
            'localhost',
            /^https:\/\/.*\.supabase\.co/,
        ],

        // Filter out noisy errors
        ignoreErrors: [
            // Browser extensions
            'top.GLOBALS',
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
        ],

        beforeSend(event, hint) {
            // Add user context if logged in
            if (typeof supabase !== 'undefined') {
                supabase.auth.getSession().then(({ data }) => {
                    if (data?.session?.user) {
                        Sentry.setUser({
                            id: data.session.user.id,
                            email: data.session.user.email,
                        });
                    }
                });
            }
            return event;
        },
    });

    console.log('[Sentry] Initialized');
} else if (SENTRY_DSN.startsWith('REPLACE')) {
    console.warn('[Sentry] Not initialized — DSN not configured in js/sentry-init.js');
}
