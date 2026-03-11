import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";

let currentConversationId = null;
let currentUserId = null;
let currentFriendId = null;
let messagesInitialized = false;


/* =========================
   INIT
========================= */

export async function initMessages() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    currentUserId = user.id;

    if (!messagesInitialized) {
        setupSendMessage();
        messagesInitialized = true;
    }

    await loadConversations();

}


/* =========================
   LOAD CONVERSATIONS
========================= */

async function loadConversations() {

    const container = document.getElementById("conversations-container");
    const empty = document.getElementById("conversations-empty");

    if (!container) return;

    container.innerHTML = "";

    const { data, error } = await supabase
        .from("conversations")
        .select(`
            id,
            user1_id,
            user2_id,
            last_message,
            last_message_at,
            user1:user1_id(username,full_name,avatar_url),
            user2:user2_id(username,full_name,avatar_url)
        `)
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order("last_message_at",{ascending:false});

    if (error) {
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";

    data.forEach(conv => {

        const isUser1 = conv.user1_id === currentUserId;
        const friend = isUser1 ? conv.user2 : conv.user1;
        const friendId = isUser1 ? conv.user2_id : conv.user1_id;

        const row = document.createElement("div");
        row.className = "conversation-row";

        const avatar = document.createElement("img");
        avatar.className = "conversation-avatar";
        avatar.src = friend?.avatar_url || DEFAULT_AVATAR;

        const text = document.createElement("div");
        text.className = "conversation-text";

        const name = document.createElement("div");
        name.className = "conversation-name";
        name.textContent = friend?.full_name || friend?.username || "User";

        const preview = document.createElement("div");
        preview.className = "conversation-preview";
        preview.textContent = conv.last_message || "";

        text.appendChild(name);
        text.appendChild(preview);

        const time = document.createElement("div");
        time.className = "conversation-time";

        if (conv.last_message_at) {
            time.textContent = formatRelativeTime(conv.last_message_at);
        }

        row.appendChild(avatar);
        row.appendChild(text);
        row.appendChild(time);

        row.addEventListener("click", () => {

            currentConversationId = conv.id;
            currentFriendId = friendId;

            openConversation(friend, friendId);

        });

        container.appendChild(row);

    });

}


/* =========================
   OPEN CONVERSATION
========================= */

async function openConversation(friend, friendId) {

    const chatEmpty = document.getElementById("chat-empty");
    const chatContainer = document.getElementById("chat-container");

    chatEmpty.style.display = "none";
    chatContainer.style.display = "flex";

    const header = document.getElementById("chat-header");
    header.innerHTML = "";

    const userBlock = document.createElement("div");
    userBlock.className = "chat-user";

    const avatar = document.createElement("img");
    avatar.className = "chat-avatar";
    avatar.src = friend?.avatar_url || DEFAULT_AVATAR;

    const name = document.createElement("div");
    name.className = "chat-name";
    name.textContent = friend?.full_name || friend?.username || "User";

    userBlock.appendChild(avatar);
    userBlock.appendChild(name);

    userBlock.addEventListener("click", () => {
        loadView("profileOther", friendId);
    });

    header.appendChild(userBlock);

    await loadMessages();

}


/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages() {

    const container = document.getElementById("chat-messages");

    container.innerHTML = "";

    const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at",{ascending:true});

    if (error) {
        console.error(error);
        return;
    }

    data.forEach(msg => {

        const bubble = document.createElement("div");

        bubble.className =
        msg.sender_id === currentUserId
        ? "message message-sent"
        : "message message-received";

        bubble.textContent = msg.content;

        container.appendChild(bubble);

    });

    container.scrollTop = container.scrollHeight;

}


/* =========================
   SEND MESSAGE
========================= */

function setupSendMessage() {

    const input = document.getElementById("chat-input");
    const button = document.getElementById("send-message");

    button?.addEventListener("click", sendMessage);
    input?.addEventListener("keypress",(e)=>{
        if(e.key==="Enter") sendMessage();
    });

}


async function sendMessage() {

    const input = document.getElementById("chat-input");

    const text = input.value.trim();

    if (!text || !currentConversationId) return;

    input.value = "";

    const { error } = await supabase
        .from("messages")
        .insert({
        conversation_id: currentConversationId,
        sender_id: currentUserId,
        content: text
    });

    if (error) {
        console.error(error);
        return;
    }

    await supabase
        .from("conversations")
        .update({
        last_message: text,
        last_message_at: new Date().toISOString()
    })
        .eq("id", currentConversationId);

    await loadMessages();
    await loadConversations();

}


/* =========================
   RELATIVE TIME
========================= */

function formatRelativeTime(dateString) {

    const now = new Date();
    const past = new Date(dateString);

    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return "μόλις τώρα";

    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes}λ`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}ω`;

    const days = Math.floor(hours / 24);
    return `${days}η`;

}