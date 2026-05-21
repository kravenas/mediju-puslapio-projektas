import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const SITE = 'https://mediju-puslapio-projektas.vercel.app';
const SUPABASE = 'https://huqnfqagjsjgotxnecfk.supabase.co';
const ANON_KEY = 'sb_publishable_o4g-fkVbmHzYBAkSan5PQw_n9M0R1sq';

const failRate = new Rate('failed_requests');
const homepageLatency = new Trend('homepage_latency_ms');
const creatorsApiLatency = new Trend('creators_api_latency_ms');

export const options = {
    stages: [
        { duration: '20s', target: 50 },
        { duration: '40s', target: 100 },
        { duration: '20s', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        failed_requests: ['rate<0.05'],
    },
};

export default function () {
    const homepage = http.get(`${SITE}/`);
    homepageLatency.add(homepage.timings.duration);
    check(homepage, { 'homepage 200': r => r.status === 200 }) || failRate.add(1);

    sleep(1);

    const creators = http.get(
        `${SUPABASE}/rest/v1/creators?select=id,name,role,location,rating,price_from&status=eq.approved&is_rising_star=eq.false&order=rating.desc&limit=6`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    creatorsApiLatency.add(creators.timings.duration);
    check(creators, { 'creators 200': r => r.status === 200 }) || failRate.add(1);

    sleep(1);

    const search = http.get(
        `${SUPABASE}/rest/v1/creators?select=id,name,role&or=(name.ilike.%25foto%25,role.ilike.%25foto%25)&limit=10`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    check(search, { 'search 200': r => r.status === 200 }) || failRate.add(1);

    sleep(1);
}
