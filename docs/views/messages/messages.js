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

    const icon = document.createElement("div");
    icon.className = "message-attachment-file-icon";
    icon.textContent = "📎";

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

    getMessageAttachmentDownloadUrl(...)
        .then(({ downloadUrl }) => {
        img.onload = () => {
            scrollMessagesToBottom();
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

    attachments.forEach((attachment) => {
        const node = isImageAttachment(attachment)
        ? createImageAttachmentCard(attachment)
        : createFileAttachmentCard(attachment);

        list.appendChild(node);
    });

    container.appendChild(list);
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

    messagesArea.innerHTML = "";

    let lastDayKey = null;

    data.forEach(message => {

        const currentDayKey = getMessageDayKey(message.created_at);

        if (currentDayKey !== lastDayKey) {
            const dividerRow = document.createElement("div");
            dividerRow.className = "chat-day-divider-row";

            const divider = document.createElement("div");
            divider.className = "chat-day-divider";
            divider.textContent = formatMessageDayLabel(message.created_at);

            dividerRow.appendChild(divider);
            messagesArea.appendChild(dividerRow);

            lastDayKey = currentDayKey;
        }

        const row = document.createElement("div");
        row.className =
        `message-row ${message.sender_id === user.id ? "own" : "other"}`;

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        if (message.content && message.content.trim()) {
            const content = document.createElement("div");
            content.className = "message-content";
            renderMessageContent(content, message.content);
            bubble.appendChild(content);
        }

        if (message.attachments && message.attachments.length > 0) {
            renderMessageAttachments(bubble, message.attachments);
        }

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = formatMessageTime(message.created_at);

        bubble.appendChild(time);
        row.appendChild(bubble);
        messagesArea.appendChild(row);
    });

    requestAnimationFrame(() => {
        scrollMessagesToBottom();

        // second pass for async stuff (images etc)
        setTimeout(() => {
            scrollMessagesToBottom();
        }, 120);
    });
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
        file
    }));

    pendingAttachments.push(...nextFiles);
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

    pendingAttachments.forEach((item) => {
        const row = document.createElement("div");
        row.className = "chat-attachment-chip";

        const name = document.createElement("div");
        name.className = "chat-attachment-chip-name";
        name.textContent = item.file.name;
        name.title = item.file.name;

        const meta = document.createElement("div");
        meta.className = "chat-attachment-chip-meta";
        meta.textContent = formatAttachmentSize(item.file.size);

        const left = document.createElement("div");
        left.className = "chat-attachment-chip-left";
        left.appendChild(name);
        left.appendChild(meta);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "chat-attachment-chip-remove";
        removeBtn.textContent = "×";
        removeBtn.onclick = () => {
            removePendingAttachment(item.id);
        };

        row.appendChild(left);
        row.appendChild(removeBtn);
        preview.appendChild(row);
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

async function uploadMessageAttachment(conversationId, file) {
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

    await uploadFileWithProgress(uploadUrl, file);

    return {
        object_key: objectKey,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size || 0
    };
}

function uploadFileWithProgress(uploadUrl, file) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("PUT", uploadUrl, true);

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
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

        if (!content && pendingAttachments.length === 0) return;

        sendBtn.disabled = true;
        input.disabled = true;

        try {
            const uploadedAttachments = [];

            for (const item of pendingAttachments) {
                const uploaded = await uploadMessageAttachment(conversationId, item.file);
                uploadedAttachments.push(uploaded);
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

            input.value = "";
            input.style.height = "42px";
            input.style.overflowY = "hidden";
            resetPendingAttachments();

            await loadMessages(conversationId);
            await loadConversations();
        } catch (err) {
            console.error("Send message failed:", err);
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