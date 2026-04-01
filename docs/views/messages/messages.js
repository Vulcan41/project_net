import { supabase } from "../../core/supabase.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";
import { loadView } from "../../core/router.js";
import { initTextTools } from "../../components/textTools.js";

let conversationsLoadToken = 0;
let activeConversationId = null;
let activeConversationData = null;
let activeMessagesChannel = null;
let currentUserId = null;
let pendingAttachments = [];
let pendingMessages = [];
let activeConversationMessages = [];
let scrollScheduled = false;

/* =========================
   INIT
========================= */

export async function initMessages(targetUserId = null)  {

    cleanupMessagesRealtime();

    const container = document.getElementById("conversations-list");
    const info = document.getElementById("messages-info");
    const chatPanel = document.getElementById("chat-panel");

    if (!container || !info || !chatPanel) return;

    conversationsLoadToken = 0;
    activeConversationId = null;
    activeConversationData = null;
    currentUserId = null;
    activeConversationMessages = [];

    container.innerHTML = "";
    info.textContent = "Φόρτωση συνομιλιών...";

    chatPanel.innerHTML = `
    <div class="chat-empty-state">
        <div class="chat-empty-title">Δεν έχει επιλεγεί συνομιλία</div>
        <div class="chat-empty-text">Επιλέξτε μια συνομιλία από τα αριστερά</div>

        <img
            src="assets/bubbles.png"
            class="chat-empty-image"
            alt="Chat bubbles"
        >
    </div>
`;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        info.textContent = "Δεν βρέθηκε συνδεδεμένος χρήστης";
        return;
    }

    currentUserId = user.id;

    await loadConversations(targetUserId);
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

async function loadConversations(targetUserId = null) {

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
            last_read_at,
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

        const otherUserId = otherUser?.id;

        const row = document.createElement("div");
        row.dataset.conversationId = conversation.id;

        const avatar = document.createElement("img");
        avatar.className = "conversation-avatar";
        avatar.src = otherUser?.avatar_url || DEFAULT_AVATAR;
        avatar.onerror = () => avatar.src = DEFAULT_AVATAR;

        const text = document.createElement("div");
        text.className = "conversation-text";

        const name = document.createElement("div");
        name.className = "conversation-name";

        const nameText = document.createElement("span");
        nameText.className = "conversation-name-text";
        nameText.textContent =
        otherUser?.full_name ||
        otherUser?.username ||
        "User";

        const newBadge = document.createElement("span");
        newBadge.className = "conversation-new-badge";
        newBadge.textContent = "Νέο";

        name.appendChild(nameText);
        name.appendChild(newBadge);

        const username = document.createElement("div");
        username.className = "conversation-username";
        username.textContent = "@" + (otherUser?.username ?? "user");

        const meta = document.createElement("div");
        meta.className = "conversation-meta";

        const latestMessage = latestMessagesMap.get(conversation.id);

        if (latestMessage) {
            const isOwnMessage = latestMessage.sender_id === currentUserId;

            meta.textContent = getConversationPreviewText(latestMessage, isOwnMessage);

            const lastReadAt = conversation.last_read_at;

            const isUnread =
            latestMessage.sender_id !== currentUserId &&
            (!lastReadAt ||
            new Date(latestMessage.created_at) > new Date(lastReadAt));

            if (isUnread) {
                meta.classList.add("unread");
                row.classList.add("unread-conversation");
                newBadge.style.display = "inline-block";
            } else {
                meta.classList.remove("unread");
                row.classList.remove("unread-conversation");
                newBadge.style.display = "none";
            }
        } else {

            meta.textContent = "Δεν υπάρχουν μηνύματα ακόμη";
            meta.classList.remove("unread");
            row.classList.remove("unread-conversation");

        }

        applyFadeIfOverflow(meta);

        text.appendChild(name);
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

            const metaEl = row.querySelector(".conversation-meta");
            if (metaEl) metaEl.classList.remove("unread");

            row.classList.remove("unread-conversation");
            const badge = row.querySelector(".conversation-new-badge");
            if (badge) badge.style.display = "none";

            activeConversationId = conversation.id;
            activeConversationMessages = [];

            await supabase
                .from("conversations")
                .update({
                last_read_at: new Date().toISOString()
            })
                .eq("id", conversation.id);

            activeConversationData = {
                conversationId: conversation.id,
                userId: otherUser?.id,
                status: friendship.status,
                fullName:
                otherUser?.full_name ||
                otherUser?.username ||
                "User",
                username: otherUser?.username || "user",
                avatarUrl:
                otherUser?.avatar_url || DEFAULT_AVATAR
            };

            renderChatSkeleton(chatPanel, activeConversationData);

            const inputArea = chatPanel.querySelector("#chat-input-area");
            const input = chatPanel.querySelector("#chat-input");

            if (inputArea && input) {
                await initTextTools(inputArea, input);
                bindAttachmentInputs();
                resetPendingAttachments();
            }

            await loadMessages(conversation.id, true);
            bindChatInput(currentUserId);
            subscribeToActiveConversation();

        });

        container.appendChild(row);

        if (targetUserId && otherUserId === targetUserId) {
            setTimeout(() => row.click(), 0);
        }

    });
}

function getConversationPreviewText(message, isOwnMessage) {
    const content = String(message?.content || "").trim();
    const attachments = message?.attachments || [];

    if (content) {
        return isOwnMessage ? `Εσείς: ${content}` : content;
    }

    if (!attachments.length) {
        return isOwnMessage ? "Εσείς:" : "Δεν υπάρχουν μηνύματα ακόμη";
    }

    const imageCount = attachments.filter((a) =>
    String(a?.mime_type || "").toLowerCase().startsWith("image/")
    ).length;

    const totalCount = attachments.length;

    if (totalCount === 1) {
        if (imageCount === 1) {
            return isOwnMessage
            ? "Εσείς: Σας έστειλα μια εικόνα"
            : "Σας έστειλε μια εικόνα";
        }

        return isOwnMessage
        ? "Εσείς: Σας έστειλα ένα αρχείο"
        : "Σας έστειλε ένα αρχείο";
    }

    if (imageCount === totalCount) {
        return isOwnMessage
        ? `Εσείς: Σας έστειλα ${totalCount} εικόνες`
        : `Σας έστειλε ${totalCount} εικόνες`;
    }

    return isOwnMessage
    ? `Εσείς: Σας έστειλα ${totalCount} αρχεία`
    : `Σας έστειλε ${totalCount} αρχεία`;
}

async function loadLatestMessagesMap(conversationIds) {
    const map = new Map();

    if (!conversationIds || conversationIds.length === 0) {
        return map;
    }

    const { data, error } = await supabase
        .from("messages")
        .select(`
            conversation_id,
            sender_id,
            content,
            created_at,
            attachments:message_attachments (
                id,
                mime_type,
                file_name
            )
        `)
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
                <div class="chat-user-link">
                    <img class="chat-header-avatar"
                         src="${conversation.avatarUrl}" />

                    <div class="chat-header-text">
                        <div class="chat-header-name">${conversation.fullName}</div>
                        <div class="chat-header-username">@${conversation.username}</div>
                    </div>

                    <div class="chat-user-tooltip">Προβολή προφίλ</div>
                </div>
            </div>

            <div id="chat-messages-area" class="chat-messages-area"></div>

            <div class="chat-input-area" id="chat-input-area">

    <div id="chat-attachments-preview" class="chat-attachments-preview hidden"></div>

    <div class="chat-input-row">
        <textarea
            id="chat-input"
            rows="1"
            placeholder="Γράψτε μήνυμα..."
            ${disabled ? "disabled" : ""}
        ></textarea>

        <button id="chat-send-btn" ${disabled ? "disabled" : ""}>
            Αποστολή
        </button>
    </div>

    <input id="chat-attach-input" type="file" hidden multiple />
<input id="chat-image-input" type="file" hidden accept="image/*" multiple />

    ${disabled
        ? `<div class="chat-disabled-note">
               Η συνομιλία είναι ανενεργή γιατί δεν είστε πλέον φίλοι.
           </div>`
        : ""}

</div>

        </div>
    `;

    const avatar = chatPanel.querySelector(".chat-header-avatar");
    if (avatar) {
        avatar.onerror = () => {
            avatar.src = DEFAULT_AVATAR;
        };
    }

    const userLink = chatPanel.querySelector(".chat-user-link");
    const tooltip = chatPanel.querySelector(".chat-user-tooltip");

    if (userLink && tooltip) {
        userLink.addEventListener("mouseenter", () => {
            tooltip.classList.add("tooltip-visible");
        });

        userLink.addEventListener("mouseleave", () => {
            tooltip.classList.remove("tooltip-visible");
        });
    }

    if (userLink && conversation.userId) {
        userLink.addEventListener("click", () => {
            loadView("profileOther", conversation.userId);
        });
    }
}

/* =========================
   HELPER FUNCTION FOR LINKS
========================= */

function renderMessageContent(container, text) {
    const urlRegex = /(?:https?:\/\/|www\.)[^\s]+/g;

    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
        const url = match[0];
        const start = match.index;

        if (start > lastIndex) {
            appendFormattedText(container, text.slice(lastIndex, start));
        }

        const link = document.createElement("a");
        link.href = url.startsWith("http") ? url : `https://${url}`;
        link.textContent = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        container.appendChild(link);

        lastIndex = start + url.length;
    }

    if (lastIndex < text.length) {
        appendFormattedText(container, text.slice(lastIndex));
    }
}

function appendFormattedText(container, text) {
    const formatRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;

    let lastIndex = 0;
    let match;

    while ((match = formatRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const start = match.index;

        if (start > lastIndex) {
            container.appendChild(
                document.createTextNode(text.slice(lastIndex, start))
            );
        }

        if (match[2] !== undefined) {
            const strong = document.createElement("strong");
            strong.textContent = match[2];
            container.appendChild(strong);
        } else if (match[3] !== undefined) {
            const em = document.createElement("em");
            em.textContent = match[3];
            container.appendChild(em);
        }

        lastIndex = start + fullMatch.length;
    }

    if (lastIndex < text.length) {
        container.appendChild(
            document.createTextNode(text.slice(lastIndex))
        );
    }
}

/* =========================
   HELPER FUNCTION FOR DAY DIVIDERS
========================= */

function getMessageDayKey(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatMessageDayLabel(dateString) {
    const date = new Date(dateString);

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const dateKey = getMessageDayKey(dateString);
    const todayKey = getMessageDayKey(today.toISOString());
    const yesterdayKey = getMessageDayKey(yesterday.toISOString());

    if (dateKey === todayKey) return "Σήμερα";
    if (dateKey === yesterdayKey) return "Χθες";

    return date.toLocaleDateString("el-GR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function isImageAttachment(attachment) {
    const mime = (attachment?.mime_type || "").toLowerCase();
    return mime.startsWith("image/");
}

async function getMessageAttachmentDownloadUrl(objectKey, fileName) {
    const headers = await getMessagesAuthHeaders();

    const res = await fetch("/api/messages/download-attachment-url", {
        method: "POST",
        headers,
        body: JSON.stringify({
            conversationId: activeConversationId,
            objectKey,
            fileName
        })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to get attachment URL");
    }

    return res.json();
}

function createAttachmentList() {
    const wrap = document.createElement("div");
    wrap.className = "message-attachments";
    return wrap;
}

function createFileAttachmentCard(attachment) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "message-attachment-file";

    const left = document.createElement("div");
    left.className = "message-attachment-file-left";

    const icon = document.createElement("img");
    icon.className = "message-attachment-file-icon";
    icon.src = getMessageFileIcon(attachment.file_name);
    icon.alt = "file";

    const meta = document.createElement("div");
    meta.className = "message-attachment-file-meta";

    const name = document.createElement("div");
    name.className = "message-attachment-file-name";
    name.textContent = attachment.file_name;
    name.title = attachment.file_name;

    const info = document.createElement("div");
    info.className = "message-attachment-file-info";
    info.textContent = formatAttachmentSize(attachment.size_bytes || 0);

    meta.appendChild(name);
    meta.appendChild(info);

    left.appendChild(icon);
    left.appendChild(meta);
    card.appendChild(left);

    card.onclick = async () => {
        try {
            const { downloadUrl } = await getMessageAttachmentDownloadUrl(
                attachment.object_key,
                attachment.file_name
            );

            window.open(downloadUrl, "_blank");
        } catch (err) {
            console.error("Attachment download failed:", err);
        }
    };

    return card;
}

function createImageAttachmentCard(attachment) {
    const wrap = document.createElement("button");
    wrap.type = "button";
    wrap.className = "message-attachment-image";

    const img = document.createElement("img");
    img.alt = attachment.file_name;
    img.loading = "lazy";

    wrap.appendChild(img);

    wrap.onclick = async () => {
        try {
            const { downloadUrl } = await getMessageAttachmentDownloadUrl(
                attachment.object_key,
                attachment.file_name
            );

            window.open(downloadUrl, "_blank");
        } catch (err) {
            console.error("Image attachment open failed:", err);
        }
    };

    getMessageAttachmentDownloadUrl(
        attachment.object_key,
        attachment.file_name
    )
        .then(({ downloadUrl }) => {
        img.onload = () => {
            scheduleScrollToBottom();
        };
        img.src = downloadUrl;
    })
        .catch((err) => {
        console.error("Image attachment preview failed:", err);
    });

    return wrap;
}

function renderMessageAttachments(container, attachments = []) {
    if (!attachments.length) return;

    const list = createAttachmentList();

    groupMessageAttachments(attachments).forEach((attachment) => {
        const node = isImageAttachment(attachment)
        ? createImageAttachmentCard(attachment)
        : createFileAttachmentCard(attachment);

        list.appendChild(node);
    });

    container.appendChild(list);
}

function renderActiveConversationWithPending() {
    const messagesArea = document.getElementById("chat-messages-area");
    if (!messagesArea) return;

    messagesArea.innerHTML = "";

    const realMessages = (activeConversationMessages || []).map((message) => ({
        type: "real",
        sortDate: message.created_at,
        data: message
    }));

    const pending = getPendingMessagesForActiveConversation().map((message) => ({
        type: "pending",
        sortDate: message.createdAt,
        data: message
    }));

    const allItems = [...realMessages, ...pending]
        .sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate));

    let lastDayKey = null;

    allItems.forEach((item) => {
        const dateString = item.type === "real"
        ? item.data.created_at
        : item.data.createdAt;

        const currentDayKey = getMessageDayKey(dateString);

        if (currentDayKey !== lastDayKey) {
            const dividerRow = document.createElement("div");
            dividerRow.className = "chat-day-divider-row";

            const divider = document.createElement("div");
            divider.className = "chat-day-divider";
            divider.textContent = formatMessageDayLabel(dateString);

            dividerRow.appendChild(divider);
            messagesArea.appendChild(dividerRow);

            lastDayKey = currentDayKey;
        }

        if (item.type === "real") {
            renderSingleRealMessage(messagesArea, item.data);
        } else {
            renderSinglePendingMessage(messagesArea, item.data);
        }
    });

    scheduleScrollToBottom();
}

function renderSingleRealMessage(messagesArea, message) {
    const isOwn = message.sender_id === currentUserId;
    const hasText = message.content && message.content.trim();
    const hasAttachments = message.attachments && message.attachments.length > 0;

    if (hasText) {
        const row = document.createElement("div");
        row.className = `message-row ${isOwn ? "own" : "other"}`;

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        const content = document.createElement("div");
        content.className = "message-content";
        renderMessageContent(content, message.content);

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = formatMessageTime(message.created_at);

        bubble.appendChild(content);
        bubble.appendChild(time);
        row.appendChild(bubble);

        messagesArea.appendChild(row);
    }

    if (hasAttachments) {
        const row = document.createElement("div");
        row.className = `message-row ${isOwn ? "own" : "other"}`;

        const bubble = document.createElement("div");
        bubble.className = "message-bubble message-bubble-attachment-only";

        renderMessageAttachments(bubble, message.attachments);

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = formatMessageTime(message.created_at);

        bubble.appendChild(time);
        row.appendChild(bubble);

        messagesArea.appendChild(row);
    }
}

function renderSinglePendingMessage(messagesArea, pendingMessage) {
    const hasText = pendingMessage.content && pendingMessage.content.trim();
    const hasAttachments = pendingMessage.attachments && pendingMessage.attachments.length > 0;

    if (hasText) {
        const row = document.createElement("div");
        row.className = "message-row own";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble pending-message-bubble";

        const content = document.createElement("div");
        content.className = "message-content";
        renderMessageContent(content, pendingMessage.content);

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = getPendingMessageStatusText(pendingMessage);

        bubble.appendChild(content);
        bubble.appendChild(time);
        row.appendChild(bubble);

        messagesArea.appendChild(row);
    }

    if (hasAttachments) {
        const row = document.createElement("div");
        row.className = "message-row own";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble message-bubble-attachment-only pending-message-bubble";

        renderPendingMessageAttachments(bubble, pendingMessage.attachments);

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = getPendingMessageStatusText(pendingMessage);

        bubble.appendChild(time);
        row.appendChild(bubble);

        messagesArea.appendChild(row);
    }
}

function getPendingMessageStatusText(message) {
    if (message.status === "failed") return "Αποτυχία αποστολής";
    if (message.status === "sending") return "Αποστολή...";
    return "Μεταφόρτωση...";
}

function renderPendingMessageAttachments(container, attachments = []) {
    if (!attachments.length) return;

    const list = createAttachmentList();

    const images = attachments.filter((a) =>
    String(a?.file?.type || "").toLowerCase().startsWith("image/")
    );
    const files = attachments.filter((a) =>
    !String(a?.file?.type || "").toLowerCase().startsWith("image/")
    );

    [...images, ...files].forEach((attachment) => {
        const isImage = String(attachment?.file?.type || "").toLowerCase().startsWith("image/");
        const node = isImage
        ? createPendingImageAttachmentCard(attachment)
        : createPendingFileAttachmentCard(attachment);

        list.appendChild(node);
    });

    container.appendChild(list);
}

function createPendingFileAttachmentCard(attachment) {
    const card = document.createElement("div");
    card.className = "message-attachment-file pending-attachment-file";

    const left = document.createElement("div");
    left.className = "message-attachment-file-left";

    const icon = document.createElement("img");
    icon.className = "message-attachment-file-icon";
    icon.src = getMessageFileIcon(attachment.file.name);
    icon.alt = "file";

    const meta = document.createElement("div");
    meta.className = "message-attachment-file-meta";

    const name = document.createElement("div");
    name.className = "message-attachment-file-name";
    name.textContent = attachment.file.name;

    const info = document.createElement("div");
    info.className = "message-attachment-file-info";
    info.textContent = `${formatAttachmentSize(attachment.file.size)} • ${attachment.progress || 0}%`;

    meta.appendChild(name);
    meta.appendChild(info);
    left.appendChild(icon);
    left.appendChild(meta);
    card.appendChild(left);

    const progress = document.createElement("div");
    progress.className = "pending-attachment-progress";

    const bar = document.createElement("div");
    bar.className = "pending-attachment-progress-bar";
    bar.style.width = `${attachment.progress || 0}%`;

    progress.appendChild(bar);
    card.appendChild(progress);

    return card;
}

function createPendingImageAttachmentCard(attachment) {
    const wrap = document.createElement("div");
    wrap.className = "message-attachment-image pending-attachment-image";

    const img = document.createElement("img");
    img.alt = attachment.file.name;

    const objectUrl = URL.createObjectURL(attachment.file);
    img.src = objectUrl;
    img.onload = () => URL.revokeObjectURL(objectUrl);

    wrap.appendChild(img);

    const progress = document.createElement("div");
    progress.className = "pending-attachment-progress pending-image-progress";

    const bar = document.createElement("div");
    bar.className = "pending-attachment-progress-bar";
    bar.style.width = `${attachment.progress || 0}%`;

    progress.appendChild(bar);
    wrap.appendChild(progress);

    return wrap;
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
        .select(`
            id,
            sender_id,
            content,
            created_at,
            attachments:message_attachments (
                id,
                object_key,
                file_name,
                mime_type,
                size_bytes,
                created_at
            )
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (conversationId !== activeConversationId) return;
    if (!messagesArea.isConnected) return;

    if (error) {
        console.error("Failed to load messages:", error);
        return;
    }

    activeConversationMessages = data || [];
    renderActiveConversationWithPending();
    scheduleScrollToBottom();
}

/* =========================
   HELPER FUNCTION FOR AUTO RESIZE THE TEXT AREA
========================= */

function setupAutoResizeTextarea(textarea) {
    if (!textarea) return;

    const resize = () => {
        textarea.style.height = "42px";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 82)}px`;

        if (textarea.scrollHeight > 82) {
            textarea.style.overflowY = "auto";
        } else {
            textarea.style.overflowY = "hidden";
        }
    };

    textarea.addEventListener("input", resize);
    resize();
}

/* =========================
   HELPER FUNCTION FOR TOOLBAR
========================= */

function setupChatInputExpand() {
    const inputArea = document.getElementById("chat-input-area");
    const input = document.getElementById("chat-input");
    const messagesArea = document.getElementById("chat-messages-area");

    if (!inputArea || !input || !messagesArea) return;

    const scrollToBottom = () => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    };

    inputArea.addEventListener("focusin", () => {
        inputArea.classList.add("expanded");

        requestAnimationFrame(() => {
            scrollToBottom();
        });
    });

    inputArea.addEventListener("transitionend", (e) => {
        if (e.propertyName === "padding-top" || e.propertyName === "min-height") {
            scrollToBottom();
        }
    });

    document.addEventListener("click", (e) => {
        if (!inputArea.contains(e.target)) {
            inputArea.classList.remove("expanded");
        }
    });
}

/* =========================
   SEND MESSAGE
========================= */

function resetPendingAttachments() {
    pendingAttachments = [];
    renderAttachmentPreview();
}

function addPendingAttachments(files) {
    if (!files?.length) return;

    const nextFiles = [...files].map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        uploading: false,
        uploaded: false,
        error: false
    }));

    pendingAttachments.push(...nextFiles);
    renderAttachmentPreview();
}

function updatePendingAttachmentState(attachmentId, patch) {
    pendingAttachments = pendingAttachments.map((item) =>
    item.id === attachmentId
    ? { ...item, ...patch }
    : item
    );

    renderAttachmentPreview();
}

function removePendingAttachment(attachmentId) {
    pendingAttachments = pendingAttachments.filter((item) => item.id !== attachmentId);
    renderAttachmentPreview();
}

function renderAttachmentPreview() {
    const preview = document.getElementById("chat-attachments-preview");
    if (!preview) return;

    if (!pendingAttachments.length) {
        preview.classList.add("hidden");
        preview.innerHTML = "";
        return;
    }

    preview.classList.remove("hidden");
    preview.innerHTML = "";

    getGroupedPendingAttachments().forEach((item) => {
        const file = item.file;
        const isImage = String(file?.type || "").toLowerCase().startsWith("image/");

        const chip = document.createElement("div");
        chip.className = `chat-attachment-chip${isImage ? " is-image" : ""}`;

        if (isImage) {
            const thumbWrap = document.createElement("div");
            thumbWrap.className = "chat-attachment-chip-thumb";

            const thumb = document.createElement("img");
            thumb.className = "chat-attachment-chip-thumb-img";
            thumb.alt = file.name;

            const objectUrl = URL.createObjectURL(file);
            thumb.src = objectUrl;
            thumb.onload = () => {
                URL.revokeObjectURL(objectUrl);
            };

            thumbWrap.appendChild(thumb);
            chip.appendChild(thumbWrap);

            const name = document.createElement("div");
            name.className = "chat-attachment-chip-name image-name";
            name.textContent = file.name;
            name.title = file.name;

            const meta = document.createElement("div");
            meta.className = "chat-attachment-chip-meta image-meta";
            meta.textContent = formatAttachmentSize(file.size);

            chip.appendChild(name);
            chip.appendChild(meta);
        } else {
            const left = document.createElement("div");
            left.className = "chat-attachment-chip-left";

            const icon = document.createElement("img");
            icon.className = "chat-attachment-chip-file-icon";
            icon.src = getMessageFileIcon(file.name);
            icon.alt = "file";

            const metaWrap = document.createElement("div");
            metaWrap.className = "chat-attachment-chip-meta-wrap";

            const name = document.createElement("div");
            name.className = "chat-attachment-chip-name";
            name.textContent = file.name;
            name.title = file.name;

            const meta = document.createElement("div");
            meta.className = "chat-attachment-chip-meta";
            meta.textContent = formatAttachmentSize(file.size);

            metaWrap.appendChild(name);
            metaWrap.appendChild(meta);

            left.appendChild(icon);
            left.appendChild(metaWrap);
            chip.appendChild(left);
        }

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "chat-attachment-chip-remove";
        removeBtn.textContent = "×";
        removeBtn.onclick = () => {
            removePendingAttachment(item.id);
        };

        if (item.uploading || item.uploaded) {
            const progressWrap = document.createElement("div");
            progressWrap.className = `chat-attachment-progress${item.uploaded ? " is-done" : ""}`;

            const progressBar = document.createElement("div");
            progressBar.className = "chat-attachment-progress-bar";
            progressBar.style.width = `${item.progress || 0}%`;

            progressWrap.appendChild(progressBar);
            chip.appendChild(progressWrap);
        }

        if (item.error) {
            const errorBadge = document.createElement("div");
            errorBadge.className = "chat-attachment-error";
            errorBadge.textContent = "Upload failed";
            chip.appendChild(errorBadge);
        }

        chip.appendChild(removeBtn);
        preview.appendChild(chip);
    });
}

function formatAttachmentSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

async function getMessagesAuthHeaders() {
    const {
        data: { session }
    } = await supabase.auth.getSession();

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token || ""}`
    };
}

async function uploadMessageAttachment(conversationId, pendingItem) {
    const file = pendingItem.file;
    const headers = await getMessagesAuthHeaders();

    const res = await fetch("/api/messages/upload-attachment-url", {
        method: "POST",
        headers,
        body: JSON.stringify({
            conversationId,
            fileName: file.name,
            contentType: file.type
        })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to get attachment upload URL");
    }

    const { uploadUrl, objectKey } = await res.json();

    updatePendingAttachmentState(pendingItem.id, {
        uploading: true,
        progress: 0,
        error: false
    });

    await uploadFileWithProgress(uploadUrl, file, (progress) => {
        updatePendingAttachmentState(pendingItem.id, {
            progress,
            uploading: progress < 100,
            uploaded: progress >= 100
        });
    });

    return {
        object_key: objectKey,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size || 0
    };
}

async function uploadMessageAttachmentForPendingMessage(conversationId, tempMessageId, tempAttachment) {
    const file = tempAttachment.file;
    const headers = await getMessagesAuthHeaders();

    const res = await fetch("/api/messages/upload-attachment-url", {
        method: "POST",
        headers,
        body: JSON.stringify({
            conversationId,
            fileName: file.name,
            contentType: file.type
        })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to get attachment upload URL");
    }

    const { uploadUrl, objectKey } = await res.json();

    await uploadFileWithProgress(uploadUrl, file, (progress) => {
        updatePendingMessageAttachment(tempMessageId, tempAttachment.id, {
            progress,
            uploading: progress < 100,
            uploaded: progress >= 100
        });
    });

    return {
        object_key: objectKey,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size || 0
    };
}

function uploadFileWithProgress(uploadUrl, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("PUT", uploadUrl, true);

        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;

            const progress = Math.round((event.loaded / event.total) * 100);

            if (typeof onProgress === "function") {
                onProgress(progress);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                if (typeof onProgress === "function") {
                    onProgress(100);
                }
                resolve();
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error("Upload failed"));
        };

        xhr.send(file);
    });
}

function bindAttachmentInputs() {
    const attachBtn = document.querySelector(".text-tool-attach");
    const imageBtn = document.querySelector(".text-tool-image");
    const attachInput = document.getElementById("chat-attach-input");
    const imageInput = document.getElementById("chat-image-input");
    const inputArea = document.getElementById("chat-input-area");

    if (attachBtn && attachInput) {
        attachBtn.onclick = () => {
            attachInput.click();
        };
    }

    if (imageBtn && imageInput) {
        imageBtn.onclick = () => {
            imageInput.click();
        };
    }

    if (attachInput) {
        attachInput.onchange = () => {
            addPendingAttachments(attachInput.files);
            attachInput.value = "";
        };
    }

    if (imageInput) {
        imageInput.onchange = () => {
            addPendingAttachments(imageInput.files);
            imageInput.value = "";
        };
    }

    if (!inputArea) return;

    let dragCounter = 0;

    const hasFilesInDragEvent = (e) => {
        return Array.from(e.dataTransfer?.types || []).includes("Files");
    };

    const clearDragState = () => {
        dragCounter = 0;
        inputArea.classList.remove("drag-over");
    };

    inputArea.addEventListener("dragenter", (e) => {
        if (!hasFilesInDragEvent(e)) return;

        e.preventDefault();
        dragCounter += 1;
        inputArea.classList.add("drag-over");
    });

    inputArea.addEventListener("dragover", (e) => {
        if (!hasFilesInDragEvent(e)) return;

        e.preventDefault();
        inputArea.classList.add("drag-over");
    });

    inputArea.addEventListener("dragleave", (e) => {
        if (!hasFilesInDragEvent(e)) return;

        e.preventDefault();
        dragCounter -= 1;

        if (dragCounter <= 0) {
            clearDragState();
        }
    });

    inputArea.addEventListener("drop", (e) => {
        if (!hasFilesInDragEvent(e)) return;

        e.preventDefault();
        clearDragState();

        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;

        addPendingAttachments(files);
    });
}

function bindChatInput(currentUserId) {
    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send-btn");

    setupChatInputExpand();

    if (!input || !sendBtn || !activeConversationId) return;

    setupAutoResizeTextarea(input);

    const sendMessage = async () => {
        const content = input.value.trim();
        const conversationId = activeConversationId;
        const hasAttachments = pendingAttachments.length > 0;

        if (!content && !hasAttachments) return;

        sendBtn.disabled = true;
        input.disabled = true;

        const shouldUsePendingBubble = hasAttachments;

        let tempMessageId = null;
        let tempAttachments = [];

        if (shouldUsePendingBubble) {
            tempMessageId = crypto.randomUUID();

            tempAttachments = getGroupedPendingAttachments().map((item) => ({
                id: item.id,
                file: item.file,
                progress: 0,
                uploading: true,
                uploaded: false,
                error: false
            }));

            addPendingMessage({
                tempId: tempMessageId,
                conversationId,
                senderId: currentUserId,
                content,
                createdAt: new Date().toISOString(),
                status: "uploading",
                attachments: tempAttachments
            });

            input.value = "";
            input.style.height = "42px";
            input.style.overflowY = "hidden";
            resetPendingAttachments();
        }

        try {
            const uploadedAttachments = [];

            if (shouldUsePendingBubble) {
                for (const tempAttachment of tempAttachments) {
                    const uploaded = await uploadMessageAttachmentForPendingMessage(
                        conversationId,
                        tempMessageId,
                        tempAttachment
                    );
                    uploadedAttachments.push(uploaded);
                }

                updatePendingMessage(tempMessageId, { status: "sending" });
            } else {
                for (const item of getGroupedPendingAttachments()) {
                    const uploaded = await uploadMessageAttachment(conversationId, item);
                    uploadedAttachments.push(uploaded);
                }
            }

            const { data: insertedMessage, error: insertError } = await supabase
                .from("messages")
                .insert({
                conversation_id: conversationId,
                sender_id: currentUserId,
                content: content || ""
            })
                .select("id")
                .single();

            if (insertError || !insertedMessage) {
                throw insertError || new Error("Failed to create message");
            }

            if (uploadedAttachments.length > 0) {
                const attachmentRows = uploadedAttachments.map((attachment) => ({
                    message_id: insertedMessage.id,
                    conversation_id: conversationId,
                    sender_id: currentUserId,
                    object_key: attachment.object_key,
                    file_name: attachment.file_name,
                    mime_type: attachment.mime_type,
                    size_bytes: attachment.size_bytes
                }));

                const { error: attachmentError } = await supabase
                    .from("message_attachments")
                    .insert(attachmentRows);

                if (attachmentError) {
                    throw attachmentError;
                }
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

            if (shouldUsePendingBubble) {
                removePendingMessage(tempMessageId);
            } else {
                input.value = "";
                input.style.height = "42px";
                input.style.overflowY = "hidden";
                resetPendingAttachments();
            }

            await loadMessages(conversationId);
            await loadConversations();
        } catch (err) {
            console.error("Send message failed:", err);

            if (shouldUsePendingBubble && tempMessageId) {
                updatePendingMessage(tempMessageId, { status: "failed" });
            }
        } finally {
            sendBtn.disabled = false;
            input.disabled = false;
        }
    };

    sendBtn.onclick = sendMessage;

    input.onkeydown = async (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
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

function scrollMessagesToBottom() {
    const messagesArea = document.getElementById("chat-messages-area");
    if (!messagesArea) return;

    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function getMessageFileIcon(fileName = "") {
    const ext = String(fileName).split(".").pop()?.toLowerCase() || "";

    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
        return "assets/icons_img.png";
    }

    if (ext === "pdf") {
        return "assets/icon_pdf.png";
    }

    if (["doc", "docx"].includes(ext)) {
        return "assets/icon_doc.png";
    }

    if (["txt"].includes(ext)) {
        return "assets/icon_txt.png";
    }

    if (["xls", "xlsx", "csv"].includes(ext)) {
        return "assets/icon_xls.png";
    }

    if (["zip", "rar", "7z"].includes(ext)) {
        return "assets/icon_zip.png";
    }

    if (["mp4", "mov", "avi"].includes(ext)) {
        return "assets/icon_video.png";
    }

    if (["mp3", "wav"].includes(ext)) {
        return "assets/icon_audio.png";
    }

    return "assets/icon_file_file.png";
}

function isPendingImage(item) {
    return String(item?.file?.type || "").toLowerCase().startsWith("image/");
}

function getGroupedPendingAttachments() {
    const images = pendingAttachments.filter(isPendingImage);
    const files = pendingAttachments.filter((item) => !isPendingImage(item));
    return [...images, ...files];
}

function groupMessageAttachments(attachments = []) {
    const images = attachments.filter(isImageAttachment);
    const files = attachments.filter((a) => !isImageAttachment(a));
    return [...images, ...files];
}

function addPendingMessage(message) {
    pendingMessages.push(message);
    renderActiveConversationWithPending();
}

function updatePendingMessage(tempId, patch) {
    pendingMessages = pendingMessages.map((msg) =>
    msg.tempId === tempId ? { ...msg, ...patch } : msg
    );
    renderActiveConversationWithPending();
}

function updatePendingMessageAttachment(tempId, attachmentId, patch) {
    pendingMessages = pendingMessages.map((msg) => {
        if (msg.tempId !== tempId) return msg;

        return {
            ...msg,
            attachments: msg.attachments.map((att) =>
            att.id === attachmentId ? { ...att, ...patch } : att
            )
        };
    });

    renderActiveConversationWithPending();
}

function removePendingMessage(tempId) {
    pendingMessages = pendingMessages.filter((msg) => msg.tempId !== tempId);
    renderActiveConversationWithPending();
}

function getPendingMessagesForActiveConversation() {
    return pendingMessages.filter(
        (msg) => msg.conversationId === activeConversationId
    );
}



function scheduleScrollToBottom() {
    if (scrollScheduled) return;

    scrollScheduled = true;

    requestAnimationFrame(() => {
        const messagesArea = document.getElementById("chat-messages-area");
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        scrollScheduled = false;
    });
}