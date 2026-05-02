// =============================================
// Artifex Chat / Messaging Module
// =============================================

(function () {
    'use strict';

    let currentUser = null;
    let currentConversationId = null;
    let realtimeChannel = null;

    // --- Init ---

    async function initChat() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'prisijungimas.html';
            return;
        }
        currentUser = session.user;
        await loadConversations();
        setupInputHandlers();

        // Check if opened from creator profile with ?creator_id=
        const params = new URLSearchParams(window.location.search);
        const creatorId = params.get('creator_id');
        if (creatorId) {
            await openOrCreateConversation(creatorId);
        }
    }

    // --- Load conversations list ---

    async function loadConversations() {
        const list = document.getElementById('chat-conv-list');
        if (!list) return;

        // Get all conversations where user is client
        const { data: clientConvs } = await supabase
            .from('conversations')
            .select('*, creators(id, name, image_url, role, user_id)')
            .eq('client_id', currentUser.id)
            .order('last_message_at', { ascending: false });

        // Get all conversations where user is creator owner
        const { data: myCreator } = await supabase
            .from('creators')
            .select('id')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        let creatorConvs = [];
        if (myCreator) {
            const { data } = await supabase
                .from('conversations')
                .select('*, creators(id, name, image_url, role, user_id)')
                .eq('creator_id', myCreator.id)
                .order('last_message_at', { ascending: false });
            creatorConvs = data || [];
        }

        // Merge and deduplicate
        const allConvs = [...(clientConvs || []), ...creatorConvs];
        const seen = new Set();
        const conversations = allConvs.filter(c => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        }).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

        // For creator-side conversations, we need client profile names
        const clientIds = conversations
            .filter(c => c.client_id !== currentUser.id)
            .map(c => c.client_id)
            .concat(conversations.filter(c => c.client_id === currentUser.id).map(() => null))
            .filter(Boolean);

        let clientProfiles = {};
        if (clientIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, name, avatar_url')
                .in('id', [...new Set(clientIds)]);
            (profiles || []).forEach(p => { clientProfiles[p.id] = p; });
        }

        // Count unread per conversation
        const unreadCounts = {};
        for (const conv of conversations) {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conv.id)
                .eq('is_read', false)
                .neq('sender_id', currentUser.id);
            unreadCounts[conv.id] = count || 0;
        }

        if (conversations.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center">
                    <svg class="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    <p class="text-sm font-medium">Kol kas nėra pokalbių</p>
                    <p class="text-xs mt-1">Pradėkite pokalbį iš kūrėjo profilio</p>
                </div>
            `;
            return;
        }

        list.innerHTML = conversations.map(conv => {
            const isClient = conv.client_id === currentUser.id;
            let otherName, otherImg;

            if (isClient) {
                // User is the client - show creator info
                otherName = conv.creators?.name || 'Kūrėjas';
                otherImg = conv.creators?.image_url;
            } else {
                // User is the creator - show client info
                const cp = clientProfiles[conv.client_id];
                otherName = cp?.name || 'Klientas';
                otherImg = cp?.avatar_url;
            }

            const initial = otherName.charAt(0).toUpperCase();
            const preview = conv.last_message_text || 'Naujas pokalbis';
            const time = formatConvTime(conv.last_message_at);
            const unread = unreadCounts[conv.id] || 0;

            return `
                <div class="chat-conv-item" data-conv-id="${conv.id}" data-creator-id="${conv.creators?.id}">
                    <div class="chat-conv-avatar bg-gradient-to-br from-amber-400 to-orange-500">
                        ${otherImg
                            ? `<img src="${otherImg}" alt="${otherName}" class="w-full h-full rounded-full object-cover">`
                            : initial
                        }
                    </div>
                    <div class="chat-conv-info">
                        <div class="chat-conv-name">${otherName}</div>
                        <div class="chat-conv-preview">${escapeHtml(preview)}</div>
                    </div>
                    <div class="chat-conv-meta">
                        <span class="chat-conv-time">${time}</span>
                        ${unread > 0 ? `<span class="chat-unread-badge">${unread}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Click handlers
        list.querySelectorAll('.chat-conv-item').forEach(item => {
            item.addEventListener('click', () => {
                selectConversation(item.dataset.convId);
            });
        });

        // Subscribe to realtime updates for all conversations
        subscribeToConversations(conversations.map(c => c.id));
    }

    // --- Open or create conversation with a creator ---

    async function openOrCreateConversation(creatorId) {
        // Check if conversation already exists
        const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('client_id', currentUser.id)
            .eq('creator_id', creatorId)
            .maybeSingle();

        if (existing) {
            selectConversation(existing.id);
            return;
        }

        // Create new conversation
        const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({
                client_id: currentUser.id,
                creator_id: creatorId,
            })
            .select('*, creators(id, name, image_url, role)')
            .single();

        if (error) {
            console.error('Error creating conversation:', error);
            return;
        }

        // Reload list and select
        await loadConversations();
        selectConversation(newConv.id);
    }

    // --- Select a conversation ---

    async function selectConversation(conversationId) {
        currentConversationId = conversationId;

        // Mobile: show chat view
        document.querySelector('.chat-layout')?.classList.add('chat-open');

        // Highlight active
        document.querySelectorAll('.chat-conv-item').forEach(item => {
            item.classList.toggle('active', item.dataset.convId === conversationId);
        });

        // Load conversation header info
        const { data: conv } = await supabase
            .from('conversations')
            .select('*, creators(id, name, image_url, role, user_id)')
            .eq('id', conversationId)
            .single();

        if (!conv) return;

        const isClient = conv.client_id === currentUser.id;
        let headerName, headerRole, headerImg, headerLink;

        if (isClient) {
            headerName = conv.creators?.name || 'Kūrėjas';
            headerRole = conv.creators?.role || '';
            headerImg = conv.creators?.image_url;
            headerLink = `kurejas.html?id=${conv.creators?.id}`;
        } else {
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, avatar_url')
                .eq('id', conv.client_id)
                .maybeSingle();
            headerName = profile?.name || 'Klientas';
            headerRole = '';
            headerImg = profile?.avatar_url;
            headerLink = null;
        }

        const headerEl = document.getElementById('chat-header');
        const initial = headerName.charAt(0).toUpperCase();
        headerEl.innerHTML = `
            <button class="chat-back-btn p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 mr-1" style="display:none;border-radius:4px;" onclick="document.querySelector('.chat-layout').classList.remove('chat-open')">
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div class="chat-conv-avatar bg-gradient-to-br from-amber-400 to-orange-500" style="width:36px;height:36px;font-size:14px;">
                ${headerImg
                    ? `<img src="${headerImg}" alt="${headerName}" class="w-full h-full rounded-full object-cover">`
                    : initial
                }
            </div>
            <div>
                ${headerLink
                    ? `<a href="${headerLink}" class="font-semibold text-sm text-gray-900 dark:text-white hover:text-primary">${headerName}</a>`
                    : `<span class="font-semibold text-sm text-gray-900 dark:text-white">${headerName}</span>`
                }
                ${headerRole ? `<p class="text-xs text-gray-500">${headerRole}</p>` : ''}
            </div>
        `;

        // Show main chat area
        document.getElementById('chat-empty-state')?.classList.add('hidden');
        document.getElementById('chat-active')?.classList.remove('hidden');

        // Load messages
        await loadMessages(conversationId);

        // Mark messages as read
        await markAsRead(conversationId);
    }

    // --- Load messages ---

    async function loadMessages(conversationId) {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';

        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error || !messages) return;

        let lastDate = null;
        messages.forEach(msg => {
            const msgDate = new Date(msg.created_at).toLocaleDateString('lt-LT');
            if (msgDate !== lastDate) {
                lastDate = msgDate;
                container.innerHTML += `<div class="chat-date-divider">${formatDateLabel(msg.created_at)}</div>`;
            }
            container.innerHTML += renderMessage(msg);
        });

        scrollToBottom();
    }

    function renderMessage(msg) {
        const isSent = msg.sender_id === currentUser.id;
        const time = new Date(msg.created_at).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="chat-msg ${isSent ? 'sent' : 'received'}">
                <div>${escapeHtml(msg.content)}</div>
                <div class="chat-msg-time">${time}</div>
            </div>
        `;
    }

    // --- Send message ---

    async function sendMessage() {
        const input = document.getElementById('chat-input');
        const content = input.value.trim();
        if (!content || !currentConversationId) return;

        input.value = '';
        autoResizeInput(input);

        const { error } = await supabase
            .from('messages')
            .insert({
                conversation_id: currentConversationId,
                sender_id: currentUser.id,
                content: content,
            });

        if (error) {
            console.error('Error sending message:', error);
            input.value = content;
            return;
        }

        // Update conversation last message
        await supabase
            .from('conversations')
            .update({
                last_message_text: content.substring(0, 100),
                last_message_at: new Date().toISOString(),
            })
            .eq('id', currentConversationId);
    }

    // --- Mark messages as read ---

    async function markAsRead(conversationId) {
        await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', currentUser.id)
            .eq('is_read', false);

        // Remove unread badge from sidebar
        const item = document.querySelector(`.chat-conv-item[data-conv-id="${conversationId}"]`);
        const badge = item?.querySelector('.chat-unread-badge');
        if (badge) badge.remove();
    }

    // --- Realtime subscription ---

    function subscribeToConversations(conversationIds) {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }

        realtimeChannel = supabase
            .channel('chat-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const msg = payload.new;
                    // If message is in a conversation we're part of
                    if (conversationIds.includes(msg.conversation_id)) {
                        handleNewMessage(msg);
                    }
                }
            )
            .subscribe();
    }

    function handleNewMessage(msg) {
        // If it's the current open conversation, append message
        if (msg.conversation_id === currentConversationId) {
            const container = document.getElementById('chat-messages');
            if (container) {
                container.innerHTML += renderMessage(msg);
                scrollToBottom();
                // Mark as read immediately
                if (msg.sender_id !== currentUser.id) {
                    markAsRead(msg.conversation_id);
                }
            }
        } else {
            // Show unread badge on the conversation item
            const item = document.querySelector(`.chat-conv-item[data-conv-id="${msg.conversation_id}"]`);
            if (item) {
                let badge = item.querySelector('.chat-unread-badge');
                if (badge) {
                    badge.textContent = parseInt(badge.textContent) + 1;
                } else {
                    const meta = item.querySelector('.chat-conv-meta');
                    if (meta) {
                        meta.insertAdjacentHTML('beforeend', '<span class="chat-unread-badge">1</span>');
                    }
                }
            }
        }

        // Update preview text in sidebar
        const item = document.querySelector(`.chat-conv-item[data-conv-id="${msg.conversation_id}"]`);
        if (item) {
            const preview = item.querySelector('.chat-conv-preview');
            if (preview) preview.textContent = msg.content.substring(0, 60);
            const time = item.querySelector('.chat-conv-time');
            if (time) time.textContent = formatConvTime(new Date().toISOString());
            // Move to top of list
            const list = document.getElementById('chat-conv-list');
            if (list && list.firstChild !== item) {
                list.prepend(item);
            }
        }
    }

    // --- Input handlers ---

    function setupInputHandlers() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        if (!input || !sendBtn) return;

        sendBtn.addEventListener('click', sendMessage);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        input.addEventListener('input', () => autoResizeInput(input));
    }

    function autoResizeInput(input) {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }

    // --- Utilities ---

    function scrollToBottom() {
        const container = document.getElementById('chat-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatConvTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffDays === 0) {
            return date.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Vakar';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('lt-LT', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' });
        }
    }

    function formatDateLabel(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffDays === 0) return 'Šiandien';
        if (diffDays === 1) return 'Vakar';
        return date.toLocaleDateString('lt-LT', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // --- Expose globally ---

    window.artifexChat = {
        initChat,
        openOrCreateConversation,
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChat);
    } else {
        initChat();
    }
})();
