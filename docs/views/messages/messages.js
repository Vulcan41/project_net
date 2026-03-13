import { supabase } from "../../core/supabase.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";

let renderToken = 0;
let activeConversationId = null;
let activeConversationData = null;
let activeMessagesChannel = null;

export async function initMessages() {

    const currentToken = ++renderToken;

    cleanupMessagesRealtime();

    const container = document.getElementById("conversations-list");
    const info = document.getElementById("messages-info");
    const chatPanel = document.getElementById("chat-panel");

    if (!container || !info || !chatPanel) return;

    activeConversationId = null;
    activeConversationData = null;

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

    if (currentToken !== renderToken) return;

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

    info.textContent =
    data.length === 1
    ? "1 συνομιλία"
    : `${data.length} συνομιλίες`;

    data.forEach(conversation => {

        const friendship = conversation.friendship;
        if (!friendship) return;

        const isRequester = friendship.requester_id === user.id;

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
        meta.textContent =
        `status: ${friendship.status} • conversation_id: ${conversation.id}`;

        text.appendChild(name);
        text.appendChild(username);
        text.appendChild(meta);

        row.appendChild(avatar);
        row.appendChild(text);

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
            await loadMessages(conversation.id);
            bindChatInput(user.id);
            subscribeToActiveConversation();
        });

        container.appendChild(row);

    });

}

function renderChatSkeleton(chatPanel, conversation) {

    const disabled = conversation.status !== "accepted";

    chatPanel.innerHTML = `
        <div class="chat-layout">

            <div class="chat-header">
                <img
                    class="chat-header-avatar"
                    src="${conversation.avatarUrl}"
                    alt="${conversation.fullName}"
                />

                <div class="chat-header-text">
                    <div class="chat-header-name">${conversation.fullName}</div>
                    <div class="chat-header-username">@${conversation.username}</div>
                    <div class="chat-header-status">status: ${conversation.status}</div>
                </div>
            </div>

            <div id="chat-messages-area" class="chat-messages-area">
                <div class="chat-messages-empty">Φόρτωση μηνυμάτων...</div>
            </div>

            <div class="chat-input-area">
                <input
                    id="chat-input"
                    type="text"
                    placeholder="Γράψτε μήνυμα..."
                    ${disabled ? "disabled" : ""}
                />
                <button
                    id="chat-send-btn"
                    type="button"
                    ${disabled ? "disabled" : ""}
                >
                    Αποστολή
                </button>
            </div>

            ${disabled ? `<div class="chat-disabled-note">Η συνομιλία είναι ανενεργή γιατί δεν είστε πλέον φίλοι.</div>` : ""}

        </div>
    `;

    const avatar = chatPanel.querySelector(".chat-header-avatar");
    if (avatar) {
        avatar.onerror = () => {
            avatar.src = DEFAULT_AVATAR;
        };
    }

}

async function loadMessages(conversationId) {

    const messagesArea = document.getElementById("chat-messages-area");
    if (!messagesArea) return;

    messagesArea.innerHTML = `<div class="chat-messages-empty">Φόρτωση μηνυμάτων...</div>`;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from("messages")
        .select(`
            id,
            sender_id,
            content,
            created_at
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (conversationId !== activeConversationId) return;

    if (error) {
        console.error("Failed to load messages:", error);
        messagesArea.innerHTML = `<div class="chat-messages-empty">Αποτυχία φόρτωσης μηνυμάτων</div>`;
        return;
    }

    if (!data || data.length === 0) {
        messagesArea.innerHTML = `<div class="chat-messages-empty">Δεν υπάρχουν μηνύματα ακόμη</div>`;
        return;
    }

    messagesArea.innerHTML = "";

    data.forEach(message => {
        const row = document.createElement("div");
        row.className = `message-row ${message.sender_id === user.id ? "own" : "other"}`;

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

function bindChatInput(currentUserId) {

    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send-btn");

    if (!input || !sendBtn || !activeConversationId || !activeConversationData) return;

    const sendMessage = async () => {

        const content = input.value.trim();
        if (!content) return;

        sendBtn.disabled = true;
        input.disabled = true;

        const { error } = await supabase
            .from("messages")
            .insert({
            conversation_id: activeConversationId,
            sender_id: currentUserId,
            content
        });

        if (error) {
            console.error("Failed to send message:", error);
            alert("Αποτυχία αποστολής μηνύματος");
            sendBtn.disabled = false;
            input.disabled = false;
            return;
        }

        input.value = "";
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();

        await loadMessages(activeConversationId);
    };

    sendBtn.onclick = sendMessage;

    input.onkeydown = async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            await sendMessage();
        }
    };
}

function subscribeToActiveConversation() {
    cleanupMessagesRealtime();

    if (!activeConversationId) return;

    activeMessagesChannel = supabase
        .channel(`messages-conversation-${activeConversationId}`)
        .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${activeConversationId}`
        },
        async () => {
            if (!activeConversationId) return;
            await loadMessages(activeConversationId);
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

function formatMessageTime(dateString) {
    const date = new Date(dateString);

    return date.toLocaleTimeString("el-GR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}