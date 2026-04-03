import { DEFAULT_AVATAR } from "../../../state/userStore.js";

export function renderConversationsPanel({
    container,
    conversations,
    currentUserId,
    selectedConversationId,
    labels,
    onConversationClick
}) {
    if (!container) return;

    container.innerHTML = "";

    const items = buildConversationItems({
        conversations,
        currentUserId,
        selectedConversationId,
        labels
    });

    items.forEach((item) => {
        const row = createConversationRow(item, onConversationClick);
        container.appendChild(row);
    });

    return items;
}

export function clearConversationSelection(container) {
    if (!container) return;

    container
        .querySelectorAll("#conversations-list > div")
        .forEach((el) => el.classList.remove("selected-conversation"));
}

export function getConversationItemByOtherUserId(items = [], otherUserId) {
    return items.find((item) => item.otherUserId === otherUserId) || null;
}

function buildConversationItems({
    conversations = [],
    currentUserId,
    selectedConversationId,
    labels = {}
}) {
    return conversations
        .map((conversation) => {
        const friendship = conversation.friendship;
        if (!friendship) return null;

        const isRequester = friendship.requester_id === currentUserId;
        const otherUser = isRequester ? friendship.receiver : friendship.requester;
        const latestMessage = conversation.latestMessage || null;

        return {
            conversationId: conversation.id,
            otherUserId: otherUser?.id || null,
            status: friendship.status,
            fullName:
            otherUser?.full_name ||
            otherUser?.username ||
            labels.userFallback ||
            "User",
            username: otherUser?.username || "user",
            avatarUrl: otherUser?.avatar_url || DEFAULT_AVATAR,
            previewText: getConversationPreviewText({
                message: latestMessage,
                currentUserId,
                labels
            }),
            isUnread: isConversationUnread({
                conversation,
                latestMessage,
                currentUserId
            }),
            isSelected: conversation.id === selectedConversationId,
            newBadgeText: labels.newBadge || "New"
        };
    })
        .filter(Boolean);
}

function createConversationRow(item, onConversationClick) {
    const row = document.createElement("div");
    row.dataset.conversationId = item.conversationId;

    if (item.isSelected) {
        row.classList.add("selected-conversation");
    }

    if (item.isUnread) {
        row.classList.add("unread-conversation");
    }

    const avatar = document.createElement("img");
    avatar.className = "conversation-avatar";
    avatar.src = item.avatarUrl || DEFAULT_AVATAR;
    avatar.onerror = () => {
        avatar.src = DEFAULT_AVATAR;
    };

    const text = document.createElement("div");
    text.className = "conversation-text";

    const name = document.createElement("div");
    name.className = "conversation-name";

    const nameText = document.createElement("span");
    nameText.className = "conversation-name-text";
    nameText.textContent = item.fullName || "User";

    const newBadge = document.createElement("span");
    newBadge.className = "conversation-new-badge";
    newBadge.textContent = item.newBadgeText || "New";
    newBadge.style.display = item.isUnread ? "inline-block" : "none";

    name.appendChild(nameText);
    name.appendChild(newBadge);

    const meta = document.createElement("div");
    meta.className = "conversation-meta";
    meta.textContent = item.previewText || "";

    if (item.isUnread) {
        meta.classList.add("unread");
    }

    applyFadeIfOverflow(meta);

    text.appendChild(name);
    text.appendChild(meta);

    row.appendChild(avatar);
    row.appendChild(text);

    row.addEventListener("click", async () => {
        updateRowVisualState(row);
        await onConversationClick?.(item, row);
    });

    return row;
}

function updateRowVisualState(row) {
    if (!row) return;

    const container = row.parentElement;
    if (container) {
        clearConversationSelection(container);
    }

    row.classList.add("selected-conversation");
    row.classList.remove("unread-conversation");

    const metaEl = row.querySelector(".conversation-meta");
    if (metaEl) {
        metaEl.classList.remove("unread");
    }

    const badge = row.querySelector(".conversation-new-badge");
    if (badge) {
        badge.style.display = "none";
    }
}

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

function isConversationUnread({
    conversation,
    latestMessage,
    currentUserId
}) {
    if (!latestMessage) return false;
    if (latestMessage.sender_id === currentUserId) return false;

    const lastReadAt = conversation.last_read_at;

    return !lastReadAt ||
    new Date(latestMessage.created_at) > new Date(lastReadAt);
}

function getConversationPreviewText({
    message,
    currentUserId,
    labels = {}
}) {
    if (!message) {
        return labels.noMessagesYet || "No messages yet";
    }

    const content = String(message?.content || "").trim();
    const attachments = message?.attachments || [];
    const isOwnMessage = message.sender_id === currentUserId;

    if (content) {
        return isOwnMessage
        ? `${labels.you || "You"}: ${content}`
        : content;
    }

    if (!attachments.length) {
        return isOwnMessage
        ? `${labels.you || "You"}:`
        : labels.noMessagesYet || "No messages yet";
    }

    const imageCount = attachments.filter((a) =>
    String(a?.mime_type || "").toLowerCase().startsWith("image/")
    ).length;

    const totalCount = attachments.length;

    if (totalCount === 1) {
        if (imageCount === 1) {
            return isOwnMessage
            ? `${labels.you || "You"}: ${labels.sentImage || "Sent an image"}`
            : labels.sentImage || "Sent an image";
        }

        return isOwnMessage
        ? `${labels.you || "You"}: ${labels.sentFile || "Sent a file"}`
        : labels.sentFile || "Sent a file";
    }

    if (imageCount === totalCount) {
        const text = interpolateCount(
            labels.sentImages || "Sent {count} images",
            totalCount
        );

        return isOwnMessage
        ? `${labels.you || "You"}: ${text}`
        : text;
    }

    const text = interpolateCount(
        labels.sentFiles || "Sent {count} files",
        totalCount
    );

    return isOwnMessage
    ? `${labels.you || "You"}: ${text}`
    : text;
}

function interpolateCount(template, count) {
    return String(template).replace("{count}", String(count));
}

/* =========================
   INCREMENTAL UPDATES
========================= */

export function getConversationRow(container, conversationId) {
    if (!container) return null;
    return container.querySelector(`[data-conversation-id="${conversationId}"]`);
}

export function updateConversationRow({
    container,
    conversationId,
    latestMessage,
    currentUserId,
    lastReadAt,
    labels = {}
}) {
    const row = getConversationRow(container, conversationId);
    if (!row) return;

    const previewEl = row.querySelector(".conversation-meta");
    const badgeEl = row.querySelector(".conversation-new-badge");

    if (!previewEl) return;

    // =========================
    // PREVIEW TEXT
    // =========================
    const previewText = getConversationPreviewText({
        message: latestMessage,
        currentUserId,
        labels
    });

    previewEl.textContent = previewText;

    // =========================
    // UNREAD STATE
    // =========================
    const isUnread =
    latestMessage &&
    latestMessage.sender_id !== currentUserId &&
    (!lastReadAt || new Date(latestMessage.created_at) > new Date(lastReadAt));

    // row styling
    row.classList.toggle("unread-conversation", !!isUnread);

    // text bolding (preview)
    previewEl.classList.toggle("unread", !!isUnread);

    // badge visibility
    if (badgeEl) {
        badgeEl.style.display = isUnread ? "inline-block" : "none";
    }
}

export function moveConversationRowToTop({
    container,
    conversationId
}) {
    const row = getConversationRow(container, conversationId);
    if (!row || !container) return;

    const first = container.firstElementChild;

    if (first === row) return;

    container.insertBefore(row, first);
}

