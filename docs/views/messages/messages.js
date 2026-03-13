import { supabase } from "../../core/supabase.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";

let conversationsLoadToken = 0;
let activeConversationId = null;
let activeConversationData = null;
let activeMessagesChannel = null;
let currentUserId = null;

/* =========================
   INIT
========================= */

export async function initMessages() {

    cleanupMessagesRealtime();

    const container = document.getElementById("conversations-list");
    const info = document.getElementById("messages-info");
    const chatPanel = document.getElementById("chat-panel");

    if (!container || !info || !chatPanel) return;

    /* reset state every time view opens */

    conversationsLoadToken = 0;
    activeConversationId = null;
    activeConversationData = null;
    currentUserId = null;

    container.innerHTML = "";
    info.textContent = "Φόρτωση συνομιλιών...";

    chatPanel.innerHTML = `
        <div class="chat-empty-state">
            <div class="chat-empty-title">Δεν έχει επιλεγεί συνομιλία</div>
            <div class="chat-empty-text">Επιλέξτε μια συνομιλία από τα αριστερά</div>
        </div>
    `;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        info.textContent = "Δεν βρέθηκε συνδεδεμένος χρήστης";
        return;
    }

    currentUserId = user.id;

    await loadConversations();
}

/* =========================
   FADE HELPER FUNCTION
========================= */

function applyFadeIfOverflow(element) {
    if (!element) return;

    requestAnimationFrame(() => {
        const isOverflowing = element.scrollWidth > element.clientWidth + 1;

        if (isOverflowing) {
            element.classList.add("is-overflowing");
        } else {
            element.classList.remove("is-overflowing");
        }
    });
}

/* =========================
   LOAD CONVERSATIONS
========================= */

async function loadConversations() {

    const localLoadToken = ++conversationsLoadToken;

    const container = document.getElementById("conversations-list");
    const info = document.getElementById("messages-info");
    const chatPanel = document.getElementById("chat-panel");

    if (!container || !info || !chatPanel || !currentUserId) return;

    const selectedConversationId = activeConversationId;

    const { data, error } = await supabase
        .from("conversations")
        .select(`
            id,
            created_at,
            last_message_at,
            friendship:friendship_id (
                id,
                status,
                requester_id,
                receiver_id,
                requester:requester_id (
                    id,
                    username,
                    full_name,
                    avatar_url
                ),
                receiver:receiver_id (
                    id,
                    username,
                    full_name,
                    avatar_url
                )
            )
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    if (localLoadToken !== conversationsLoadToken) return;

    if (!container.isConnected || !info.isConnected) return;

    container.innerHTML = "";

    if (error) {
        console.error("Failed to load conversations:", error);
        info.textContent = "Αποτυχία φόρτωσης συνομιλιών";
        return;
    }

    if (!data || data.length === 0) {
        info.textContent = "Δεν υπάρχουν συνομιλίες";
        return;
    }

    const latestMessagesMap = await loadLatestMessagesMap(data.map(c => c.id));

    if (localLoadToken !== conversationsLoadToken) return;
    if (!container.isConnected || !info.isConnected) return;

    container.innerHTML = "";

    info.textContent =
    data.length === 1
    ? "1 συνομιλία"
    : `${data.length} συνομιλίες`;

    data.forEach(conversation => {

        const friendship = conversation.friendship;
        if (!friendship) return;

        const isRequester = friendship.requester_id === currentUserId;

        const otherUser = isRequester
        ? friendship.receiver
        : friendship.requester;

        const row = document.createElement("div");
        row.dataset.conversationId = conversation.id;

        const avatar = document.createElement("img");
        avatar.className = "conversation-avatar";
        avatar.src = otherUser?.avatar_url || DEFAULT_AVATAR;
        avatar.onerror = () => {
            avatar.src = DEFAULT_AVATAR;
        };

        const text = document.createElement("div");
        text.className = "conversation-text";

        const name = document.createElement("div");
        name.className = "conversation-name";
        name.textContent =
        otherUser?.full_name ||
        otherUser?.username ||
        "User";

        const username = document.createElement("div");
        username.className = "conversation-username";
        username.textContent = "@" + (otherUser?.username ?? "user");

        const meta = document.createElement("div");
        meta.className = "conversation-meta";

        const latestMessage = latestMessagesMap.get(conversation.id);

        if (latestMessage) {
            const prefix = latestMessage.sender_id === currentUserId ? "Εσείς: " : "";
            meta.textContent = prefix + latestMessage.content;
        } else {
            meta.textContent = "Δεν υπάρχουν μηνύματα ακόμη";
        }

        applyFadeIfOverflow(meta);

        text.appendChild(name);
        text.appendChild(username);
        text.appendChild(meta);

        row.appendChild(avatar);
        row.appendChild(text);

        if (conversation.id === selectedConversationId) {
            row.classList.add("selected-conversation");
        }

        row.addEventListener("click", async () => {
            document
                .querySelectorAll("#conversations-list > div")
                .forEach(el => el.classList.remove("selected-conversation"));

            row.classList.add("selected-conversation");

            activeConversationId = conversation.id;

            activeConversationData = {
                conversationId: conversation.id,
                status: friendship.status,
                fullName: otherUser?.full_name || otherUser?.username || "User",
                username: otherUser?.username || "user",
                avatarUrl: otherUser?.avatar_url || DEFAULT_AVATAR
            };

            renderChatSkeleton(chatPanel, activeConversationData);

            await loadMessages(conversation.id, true);
            bindChatInput(currentUserId);
            subscribeToActiveConversation();
        });

        container.appendChild(row);
    });
}

async function loadLatestMessagesMap(conversationIds) {

    const map = new Map();

    if (!conversationIds || conversationIds.length === 0) {
        return map;
    }

    const { data, error } = await supabase
        .from("messages")
        .select("conversation_id,sender_id,content,created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to load latest messages:", error);
        return map;
    }

    data.forEach(message => {
        if (!map.has(message.conversation_id)) {
            map.set(message.conversation_id, message);
        }
    });

    return map;
}

/* =========================
   CHAT SKELETON
========================= */

function renderChatSkeleton(chatPanel, conversation) {

    const disabled = conversation.status !== "accepted";

    chatPanel.innerHTML = `
        <div class="chat-layout">

            <div class="chat-header">
                <img class="chat-header-avatar"
                     src="${conversation.avatarUrl}" />

                <div class="chat-header-text">
                    <div class="chat-header-name">${conversation.fullName}</div>
                    <div class="chat-header-username">@${conversation.username}</div>
                </div>
            </div>

            <div id="chat-messages-area" class="chat-messages-area"></div>

            <div class="chat-input-area">
                <input id="chat-input"
                       type="text"
                       placeholder="Γράψτε μήνυμα..."
                       ${disabled ? "disabled" : ""}/>
                <button id="chat-send-btn"
                        ${disabled ? "disabled" : ""}>
                        Αποστολή
                </button>
            </div>

            ${disabled
                ? `<div class="chat-disabled-note">
                   Η συνομιλία είναι ανενεργή γιατί δεν είστε πλέον φίλοι.
                   </div>`
                : ""}
        </div>
    `;
}

/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages(conversationId, showLoading = false) {

    const messagesArea = document.getElementById("chat-messages-area");
    if (!messagesArea) return;

    if (showLoading) {
        messagesArea.innerHTML =
        `<div class="chat-messages-empty">Φόρτωση μηνυμάτων...</div>`;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from("messages")
        .select("id,sender_id,content,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (conversationId !== activeConversationId) return;
    if (!messagesArea.isConnected) return;

    if (error) {
        console.error("Failed to load messages:", error);
        return;
    }

    messagesArea.innerHTML = "";

    data.forEach(message => {

        const row = document.createElement("div");
        row.className =
        `message-row ${message.sender_id === user.id ? "own" : "other"}`;

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        const content = document.createElement("div");
        content.className = "message-content";
        content.textContent = message.content;

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = formatMessageTime(message.created_at);

        bubble.appendChild(content);
        bubble.appendChild(time);
        row.appendChild(bubble);
        messagesArea.appendChild(row);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;
}

/* =========================
   SEND MESSAGE
========================= */

function bindChatInput(currentUserId) {

    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send-btn");

    if (!input || !sendBtn || !activeConversationId) return;

    const sendMessage = async () => {

        const content = input.value.trim();
        if (!content) return;

        const conversationId = activeConversationId;

        const { error: insertError } = await supabase
            .from("messages")
            .insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            content
        });

        if (insertError) {
            console.error("Message insert failed:", insertError);
            return;
        }

        const { error: updateError } = await supabase
            .from("conversations")
            .update({
            last_message_at: new Date().toISOString()
        })
            .eq("id", conversationId);

        if (updateError) {
            console.error("Conversation timestamp update failed:", updateError);
        }

        input.value = "";

        await loadMessages(conversationId);
        await loadConversations();
    };

    sendBtn.onclick = sendMessage;

    input.onkeydown = async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            await sendMessage();
        }
    };
}

/* =========================
   REALTIME
========================= */

function subscribeToActiveConversation() {

    cleanupMessagesRealtime();

    if (!activeConversationId) return;

    const conversationId = activeConversationId;

    activeMessagesChannel = supabase
        .channel(`messages-${conversationId}`)
        .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`
        },
        async () => {
            if (activeConversationId !== conversationId) return;

            await loadMessages(conversationId);
            await loadConversations();
        }
    )
        .subscribe();
}

function cleanupMessagesRealtime() {

    if (activeMessagesChannel) {
        supabase.removeChannel(activeMessagesChannel);
        activeMessagesChannel = null;
    }
}

/* =========================
   TIME FORMAT
========================= */

function formatMessageTime(dateString) {

    const date = new Date(dateString);

    return date.toLocaleTimeString("el-GR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}