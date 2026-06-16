// Global browser notifications for new chat messages.
// Loaded on every page; subscribes to realtime messages and pings the user
// when someone else writes to them. Updates a small badge on the nav messages icon.

(function () {
    'use strict';

    if (typeof supabase === 'undefined') return;

    let currentUserId = null;
    let realtimeChannel = null;
    let permissionRequested = false;

    function ensureBadge(count) {
        const link = document.querySelector('a[href="zinutes.html"]');
        if (!link) return;
        let badge = link.querySelector('.nav-msg-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'nav-msg-badge absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full';
                link.classList.add('relative');
                link.appendChild(badge);
            }
            badge.textContent = count > 9 ? '9+' : String(count);
        } else if (badge) {
            badge.remove();
        }
    }

    function incrementBadge() {
        const link = document.querySelector('a[href="zinutes.html"]');
        if (!link) return;
        const badge = link.querySelector('.nav-msg-badge');
        const current = badge ? parseInt(badge.textContent.replace('+', ''), 10) || 0 : 0;
        ensureBadge(current + 1);
    }

    async function loadInitialUnreadCount() {
        // Count messages addressed to current user that aren't read yet.
        // (messages.is_read = false AND sender_id != me) under RLS.
        try {
            const { count } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .neq('sender_id', currentUserId)
                .eq('is_read', false);
            ensureBadge(count || 0);
        } catch (_) {
            // Ignore on error — badge stays at 0.
        }
    }

    function maybeRequestPermission() {
        if (permissionRequested) return;
        permissionRequested = true;
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            // Don't block — only ask in browsers that support requestPermission
            Notification.requestPermission().catch(() => { });
        }
    }

    function showNotification(msg, conversation) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        // Don't show if the tab is currently focused on zinutes.html with this conversation open
        if (document.visibilityState === 'visible' && location.pathname.endsWith('/zinutes.html')) {
            const params = new URLSearchParams(location.search);
            if (params.get('id') === msg.conversation_id) return;
        }

        const title = conversation?.other_name ? `Žinutė nuo ${conversation.other_name}` : 'Nauja žinutė';
        const preview = (msg.content || '').slice(0, 140);
        try {
            const n = new Notification(title, {
                body: preview,
                icon: '/favicon.ico',
                tag: `chat-${msg.conversation_id}`,
            });
            n.onclick = () => {
                window.focus();
                window.location.href = `zinutes.html?id=${encodeURIComponent(msg.conversation_id)}`;
                n.close();
            };
        } catch (_) { /* notification creation can throw in some browsers */ }
    }

    async function getConversationContext(conversationId) {
        // Best-effort lookup of the other party name for nicer notif text.
        try {
            const { data: conv } = await supabase
                .from('conversations')
                .select('id, client_id, creator_id, creators(name), profiles!conversations_client_id_fkey(name)')
                .eq('id', conversationId)
                .single();
            if (!conv) return null;
            const isClient = conv.client_id === currentUserId;
            return { other_name: isClient ? conv.creators?.name : conv.profiles?.name };
        } catch (_) {
            return null;
        }
    }

    async function handleNewMessage(msg) {
        if (msg.sender_id === currentUserId) return; // own message
        incrementBadge();
        const ctx = await getConversationContext(msg.conversation_id);
        showNotification(msg, ctx);
    }

    function subscribe() {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        realtimeChannel = supabase
            .channel('global-message-notifications')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => handleNewMessage(payload.new))
            .subscribe();
    }

    async function init() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        currentUserId = session.user.id;

        // Wait a tick so the nav has been rendered by auth.js
        setTimeout(() => {
            maybeRequestPermission();
            loadInitialUnreadCount();
            subscribe();
        }, 500);
    }

    document.addEventListener('DOMContentLoaded', init);

    // Re-init on auth state change (login / logout)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            if (realtimeChannel) supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
            currentUserId = null;
            ensureBadge(0);
        } else if (session?.user && session.user.id !== currentUserId) {
            currentUserId = session.user.id;
            maybeRequestPermission();
            loadInitialUnreadCount();
            subscribe();
        }
    });
})();

// --- Global presence: live count of creators currently online (homepage badge) ---
(function presenceCounter() {
    function ltCreators(n) {
        const d = n % 10, dd = n % 100;
        if (d === 1 && dd !== 11) return 'kūrėjas';
        if (d >= 2 && d <= 9 && !(dd >= 11 && dd <= 19)) return 'kūrėjai';
        return 'kūrėjų';
    }

    let channel = null;

    function renderCount() {
        const el = document.getElementById('badge-online');
        if (!el || !channel) return;
        const state = channel.presenceState();
        let online = 0;
        // Only tracked users appear; count those flagged as creators.
        Object.values(state).forEach(metas => {
            if (metas.some(m => m.is_creator)) online++;
        });
        if (online > 0) {
            el.textContent = `• ${online} ${ltCreators(online)} prisijungę`;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    async function start() {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        const isCreator = user?.user_metadata?.role === 'kurejas';
        const key = user?.id || ('guest-' + Math.random().toString(36).slice(2));

        channel = supabase.channel('online-creators', { config: { presence: { key } } });
        channel
            .on('presence', { event: 'sync' }, renderCount)
            .subscribe(async (status) => {
                // Logged-in users mark themselves present; guests only observe.
                if (status === 'SUBSCRIBED' && user) {
                    await channel.track({ is_creator: isCreator });
                }
            });
    }

    document.addEventListener('DOMContentLoaded', start);
})();
