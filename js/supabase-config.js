const SUPABASE_URL = 'https://huqnfqagjsjgotxnecfk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_o4g-fkVbmHzYBAkSan5PQw_n9M0R1sq';
const _supabaseLib = window.supabase;
var supabase = _supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Soft-launch flag: keep payments OFF until the company is registered and
// Stripe is switched to live keys. While false, checkout and Stripe Connect
// onboarding show a "coming soon" state instead of hitting Stripe (test mode).
// Flip to true (and deploy) once live payments are ready.
window.PAYMENTS_ENABLED = false;
