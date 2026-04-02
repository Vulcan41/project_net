import { supabase } from "../../core/supabase.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";
import { loadView } from "../../core/router.js";
import { t, getLocale } from "../../core/i18n.js";
import { initLightboxModal, openLightboxGallery } from "../../components/lightboxModal/lightboxModal.js";
import { initComposer } from "./layout/composer.js";
import { renderMessages, renderPendingMessages } from "./layout/chatHistory.js";

let conversationsLoadToken = 0;
let activeConversationId = null;
let activeConversationData = null;
let activeMessagesChannel = null;
let currentUserId = null;
let pendingAttachments = [];
let pendingMessages = [];
let activeConversationMessages = [];
let scrollScheduled = false;
let renderedMessageIds = new Set();

const attachmentUrlCache = new Map();

// switch to English
localStorage.setItem("lang", "en");

/* =========================
   INIT
========================= */

export async function initMessages(targetUserId = null) {
    cleanupMessagesRealtime();
    initLightboxModal();

    const container = document.getElementById("conversations-list");
    const info = document.getElementById("messages-info");
    const chatPanel = document.getElementById("chat-panel");

    if (!container || !info || !chatPanel) return;

    conversationsLoadToken = 0;
    activeConversationId = null;
    activeConversationData = null;
    currentUserId = null;
    activeConversationMessages = [];
    renderedMessageIds.clear();

    container.innerHTML = "";
    info.textContent = t("messages.loading_conversations");

    chatPanel.innerHTML = `
        <div class="chat-empty-state">
            <div class="chat-empty-title">${t("messages.no_conversation_selected")}</div>
            <div class="chat-empty-text">${t("messages.select_conversation")}</div>

            <img
                src="assets/bubbles.png"
                class="chat-empty-image"
                alt="Chat bubbles"
            >
        </div>
    `;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        info.textContent = t("messages.no_authenticated_user");
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
        info.textContent = t("messages.failed_to_load_conversations");
        return;
    }

    if (!data || data.length === 0) {
        info.textContent = t("messages.no_conversations");
        return;
    }

    const latestMessagesMap = await loadLatestMessagesMap(data.map((c) => c.id));

    if (localLoadToken !== conversationsLoadToken) return;
    if (!container.isConnected || !info.isConnected) return;

    container.innerHTML = "";

    info.textContent =
    data.length === 1
    ? t("messages.conversation_count_one", { count: 1 })
    : t("messages.conversation_count_other", { count: data.length });

    data.forEach((conversation) => {
        const friendship = conversation.friendship;
        if (!friendship) return;

        const isRequester = friendship.requester_id === currentUserId;
        const otherUser = isRequester ? friendship.receiver : friendship.requester;
        const otherUserId = otherUser?.id;

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

        const nameText = document.createElement("span");
        nameText.className = "conversation-name-text";
        nameText.textContent =
        otherUser?.full_name ||
        otherUser?.username ||
        t("messages.user_fallback");

        const newBadge = document.createElement("span");
        newBadge.className = "conversation-new-badge";
        newBadge.textContent = t("messages.new_badge");

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
            meta.textContent = t("messages.no_messages_yet");
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
                .forEach((el) => el.classList.remove("selected-conversation"));

            row.classList.add("selected-conversation");

            const metaEl = row.querySelector(".conversation-meta");
            if (metaEl) metaEl.classList.remove("unread");

            row.classList.remove("unread-conversation");
            const badge = row.querySelector(".conversation-new-badge");
            if (badge) badge.style.display = "none";

            activeConversationId = conversation.id;
            activeConversationMessages = [];
            renderedMessageIds.clear();

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
                t("messages.user_fallback"),
                username: otherUser?.username || "user",
                avatarUrl: otherUser?.avatar_url || DEFAULT_AVATAR
            };

            renderChatSkeleton(chatPanel, activeConversationData);

            const inputArea = chatPanel.querySelector("#chat-input-area");
            const input = chatPanel.querySelector("#chat-input");

            if (inputArea && input) {
                resetPendingAttachments();

                initComposer({
                    onSend: async (text) => {
                        return await handleSendMessage(text);
                    },
                    onFilesSelected: (files) => {
                        addPendingAttachments(files);
                    }
                });
            }

            await loadMessages(conversation.id, true);
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
        return isOwnMessage ? t("messages.you") + ": " + content : content;
    }

    if (!attachments.length) {
        return isOwnMessage
        ? t("messages.you") + ":"
        : t("messages.no_messages_yet");
    }

    const imageCount = attachments.filter((a) =>
    String(a?.mime_type || "").toLowerCase().startsWith("image/")
    ).length;

    const totalCount = attachments.length;

    if (totalCount === 1) {
        if (imageCount === 1) {
            return isOwnMessage
            ? t("messages.you") + ": " + t("messages.sent_image")
            : t("messages.sent_image");
        }

        return isOwnMessage
        ? t("messages.you") + ": " + t("messages.sent_file")
        : t("messages.sent_file");
    }

    if (imageCount === totalCount) {
        return isOwnMessage
        ? t("messages.you") + ": " + t("messages.sent_images", { count: totalCount })
        : t("messages.sent_images", { count: totalCount });
    }

    return isOwnMessage
    ? t("messages.you") + ": " + t("messages.sent_files", { count: totalCount })
    : t("messages.sent_files", { count: totalCount });
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

    data.forEach((message) => {
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

                    <div class="chat-user-tooltip">${t("messages.view_profile")}</div>
                </div>
            </div>

            <div id="chat-messages-area" class="chat-messages-area"></div>

            <div class="chat-input-area" id="chat-input-area" data-i18n-drop="${t("messages.drop_files")}">

                <div id="chat-attachments-preview" class="chat-attachments-preview hidden"></div>

                <div class="chat-composer-row">
                    <div class="chat-composer-instagram">
                        <div class="chat-composer-input-wrap">
                            <textarea
                                id="chat-input"
                                rows="1"
                                placeholder="${t("messages.type_message")}"
                                ${disabled ? "disabled" : ""}
                            ></textarea>
                        </div>

                        <div class="chat-composer-tools">
                            <button
                                type="button"
                                class="chat-composer-tool text-tool-attach"
                                aria-label="Attach file"
                                title="Attach file"
                                ${disabled ? "disabled" : ""}
                            >
                                <img src="assets/icon_attach_2.png" alt="Attach">
                            </button>

                            <button
                                type="button"
                                class="chat-composer-tool text-tool-image"
                                aria-label="Send image"
                                title="Send image"
                                ${disabled ? "disabled" : ""}
                            >
                                <img src="assets/icons_img.png" alt="Image">
                            </button>

                            <button
                                type="button"
                                class="chat-composer-tool text-tool-emoji"
                                aria-label="Emoji"
                                title="Emoji"
                                ${disabled ? "disabled" : ""}
                            >
                                <img src="assets/icon_emoji_2.png" alt="Emoji">
                            </button>
                        </div>
                    </div>

                    <button
                        id="chat-send-btn"
                        type="button"
                        class="chat-composer-send-outside"
                        ${disabled ? "disabled" : ""}
                    >
                        ${t("messages.send")}
                    </button>
                </div>

                <input id="chat-attach-input" type="file" hidden multiple />
                <input id="chat-image-input" type="file" hidden accept="image/*" multiple />

                ${disabled
                    ? `<div class="chat-disabled-note">
                           ${t("messages.inactive_chat")}
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

    if (dateKey === todayKey) return t("messages.today");
    if (dateKey === yesterdayKey) return t("messages.yesterday");

    return date.toLocaleDateString(getLocale(), {
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
    if (!objectKey) return null;

    if (attachmentUrlCache.has(objectKey)) {
        return {
            downloadUrl: attachmentUrlCache.get(objectKey)
        };
    }

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

    const data = await res.json();

    if (data?.downloadUrl) {
        attachmentUrlCache.set(objectKey, data.downloadUrl);
    }

    return data;
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

function createImageAttachmentCard(attachment, imageItems = [], imageIndex = 0) {
    const wrap = document.createElement("button");
    wrap.type = "button";
    wrap.className = "message-attachment-image";

    const img = document.createElement("img");
    img.alt = attachment.file_name;
    img.loading = "lazy";

    wrap.appendChild(img);

    wrap.onclick = async () => {
        try {
            const galleryItems = await Promise.all(
                imageItems.map(async (item) => {
                    const { downloadUrl } = await getMessageAttachmentDownloadUrl(
                        item.object_key,
                        item.file_name
                    );

                    return {
                        src: downloadUrl,
                        alt: item.file_name || ""
                    };
                })
            );

            openLightboxGallery(galleryItems, imageIndex);
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
        if (img.src !== downloadUrl) {
            img.src = downloadUrl;
        }
    })
        .catch((err) => {
        console.error("Image attachment preview failed:", err);
    });

    return wrap;
}

function renderActiveConversationWithPending() {
    const messagesArea = document.getElementById("chat-messages-area");
    if (!messagesArea) return;

    // Full rerender with real messages + pending messages appended after
    renderMessages({
        messagesArea,
        messages: activeConversationMessages,
        currentUserId,
        renderMessageContent,
        formatMessageTime,
        getMessageDayKey,
        formatMessageDayLabel,
        isImageAttachment,
        createImageAttachmentCard,
        createFileAttachmentCard,
        scheduleScrollToBottom
    });

    renderPendingMessages({
        messagesArea,
        pendingMessages,
        activeConversationId,
        renderMessageContent,
        getPendingMessageStatusText,
        getMessageFileIcon,
        formatAttachmentSize,
        scheduleScrollToBottom
    });
}

function getPendingMessageStatusText(message) {
    if (message.status === "failed") return t("messages.failed");
    if (message.status === "sending") return t("messages.sending");
    return t("messages.uploading");
}

/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages(conversationId, showLoading = false) {
    const messagesArea = document.getElementById("chat-messages-area");
    if (!messagesArea) return;

    if (showLoading) {
        messagesArea.innerHTML =
        `<div class="chat-messages-empty">${t("messages.loading_messages")}</div>`;
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
    link_url,
    link_title,
    link_description,
    link_image,
    link_site,
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
    renderedMessageIds.clear();

    renderMessages({
        messagesArea,
        messages: activeConversationMessages,
        currentUserId,
        renderMessageContent,
        formatMessageTime,
        getMessageDayKey,
        formatMessageDayLabel,
        isImageAttachment,
        createImageAttachmentCard,
        createFileAttachmentCard,
        scheduleScrollToBottom
    });

    renderPendingMessages({
        messagesArea,
        pendingMessages,
        activeConversationId,
        renderMessageContent,
        getPendingMessageStatusText,
        getMessageFileIcon,
        formatAttachmentSize,
        scheduleScrollToBottom
    });
}

/* =========================
   SEND MESSAGE
========================= */

function resetPendingAttachments() {
    pendingAttachments.forEach((item) => {
        if (item?.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
        }
    });

    pendingAttachments = [];
    renderAttachmentPreview();
}

function addPendingAttachments(files) {
    if (!files?.length) return;

    const nextFiles = [...files].map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: String(file?.type || "").toLowerCase().startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
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
    const item = pendingAttachments.find((x) => x.id === attachmentId);

    if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
    }

    pendingAttachments = pendingAttachments.filter((x) => x.id !== attachmentId);
    renderAttachmentPreview();
}

function createCircularProgressLoader(progress = 0, className = "") {
    const clamped = Math.max(0, Math.min(100, Number(progress) || 0));
    const degrees = (clamped / 100) * 360;

    const wrap = document.createElement("div");
    wrap.className = `image-progress-ring${className ? ` ${className}` : ""}`;
    wrap.style.setProperty("--progress-deg", `${degrees}deg`);

    const inner = document.createElement("div");
    inner.className = "image-progress-ring-inner";
    inner.textContent = `${clamped}%`;

    wrap.appendChild(inner);
    return wrap;
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
            thumb.src = item.previewUrl || "";

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
            if (isImage) {
                const ring = createCircularProgressLoader(
                    item.progress || 0,
                    item.uploaded ? "is-done" : ""
                );
                chip.appendChild(ring);
            } else {
                const progressWrap = document.createElement("div");
                progressWrap.className = `chat-attachment-progress${item.uploaded ? " is-done" : ""}`;

                const progressBar = document.createElement("div");
                progressBar.className = "chat-attachment-progress-bar";
                progressBar.style.width = `${item.progress || 0}%`;

                progressWrap.appendChild(progressBar);
                chip.appendChild(progressWrap);
            }
        }

        if (item.error) {
            const errorBadge = document.createElement("div");
            errorBadge.className = "chat-attachment-error";
            errorBadge.textContent = t("messages.upload_failed");
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

function extractFirstUrl(text = "") {
    const match = String(text).match(/(?:https?:\/\/|www\.)[^\s]+/i);
    return match ? match[0] : null;
}

async function fetchLinkPreview(url) {
    const res = await fetch("/api/messages/link-preview", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to fetch link preview");
    }

    return res.json();
}

async function handleSendMessage(content) {
    const conversationId = activeConversationId;
    const hasAttachments = pendingAttachments.length > 0;

    if (!content && !hasAttachments) return false;

    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send-btn");

    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    const shouldUsePendingBubble = hasAttachments;

    let tempMessageId = null;
    let tempAttachments = [];

    if (shouldUsePendingBubble) {
        const wasNearBottom = isUserNearBottom();

        tempMessageId = crypto.randomUUID();

        tempAttachments = getGroupedPendingAttachments().map((item) => ({
            id: item.id,
            file: item.file,
            previewUrl: item.previewUrl || null,
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

        scheduleScrollToBottom(wasNearBottom);
        resetPendingAttachments();
    }

    try {
        let preview = null;
        const firstUrl = extractFirstUrl(content);

        if (firstUrl) {
            try {
                preview = await fetchLinkPreview(firstUrl);
            } catch (previewError) {
                console.warn("Link preview failed, sending message without preview:", previewError);
            }
        }

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

        const { data: insertedMessage, error } = await supabase
            .from("messages")
            .insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: content || "",
            link_url: preview?.url || null,
            link_title: preview?.title || null,
            link_description: preview?.description || null,
            link_image: preview?.image || null,
            link_site: preview?.site || null
        })
            .select("id")
            .single();

        if (error || !insertedMessage) throw error;

        if (uploadedAttachments.length > 0) {
            const rows = uploadedAttachments.map((a) => ({
                message_id: insertedMessage.id,
                conversation_id: conversationId,
                sender_id: currentUserId,
                object_key: a.object_key,
                file_name: a.file_name,
                mime_type: a.mime_type,
                size_bytes: a.size_bytes
            }));

            await supabase.from("message_attachments").insert(rows);
        }

        await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);

        if (shouldUsePendingBubble && tempMessageId) {
            removePendingMessage(tempMessageId);
        }

        await loadMessages(conversationId);
        await loadConversations();

        return true;
    } catch (err) {
        console.error("Send failed:", err);

        if (shouldUsePendingBubble && tempMessageId) {
            updatePendingMessage(tempMessageId, { status: "failed" });
        }

        return false;
    } finally {
        if (input) input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
    }
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
        async (payload) => {
            if (activeConversationId !== conversationId) return;

            const messageId = payload.new.id;

            const { data, error } = await supabase
                .from("messages")
                .select(`
    id,
    sender_id,
    content,
    created_at,
    link_url,
    link_title,
    link_description,
    link_image,
    link_site,
    attachments:message_attachments (
        id,
        object_key,
        file_name,
        mime_type,
        size_bytes,
        created_at
    )
`)
                .eq("id", messageId)
                .single();

            if (error || !data) return;

            const alreadyExists = activeConversationMessages.some(
                (msg) => msg.id === data.id
            );
            if (alreadyExists) return;

            activeConversationMessages.push(data);
            activeConversationMessages.sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );

            renderMessages({
                messagesArea: document.getElementById("chat-messages-area"),
                messages: activeConversationMessages,
                currentUserId,
                renderMessageContent,
                formatMessageTime,
                getMessageDayKey,
                formatMessageDayLabel,
                isImageAttachment,
                createImageAttachmentCard,
                createFileAttachmentCard,
                scheduleScrollToBottom
            });

            renderPendingMessages({
                messagesArea: document.getElementById("chat-messages-area"),
                pendingMessages,
                activeConversationId,
                renderMessageContent,
                getPendingMessageStatusText,
                getMessageFileIcon,
                formatAttachmentSize,
                scheduleScrollToBottom
            });

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

    return date.toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit"
    });
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

    const el = document.querySelector(`[data-pending-id="${tempId}"]`);
    if (el) el.remove();
}

function getPendingMessagesForActiveConversation() {
    return pendingMessages.filter(
        (msg) => msg.conversationId === activeConversationId
    );
}

function isUserNearBottom() {
    const el = document.getElementById("chat-messages-area");
    if (!el) return true;

    const threshold = 80;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

function scheduleScrollToBottom(force = false) {
    if (scrollScheduled) return;

    const messagesArea = document.getElementById("chat-messages-area");
    if (!messagesArea) return;

    if (!force && !isUserNearBottom()) return;

    scrollScheduled = true;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            messagesArea.scrollTop = messagesArea.scrollHeight;
            scrollScheduled = false;
        });
    });
}