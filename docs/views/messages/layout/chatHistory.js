/* =========================
   PUBLIC API
========================= */

export function renderMessages({
    messagesArea,
    messages,
    currentUserId,
    createImageAttachmentCard,
    createFileAttachmentCard,
    scheduleScrollToBottom,
    onReact
}) {
    if (!messagesArea) return;

    messagesArea.innerHTML = "";

    const sortedMessages = [...messages].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    let lastDayKey = null;

    sortedMessages.forEach((message, index) => {
        const currentDayKey = getMessageDayKey(message.created_at);

        if (currentDayKey !== lastDayKey) {
            const dividerRow = document.createElement("div");
            dividerRow.className = "chat-day-divider-row";
            dividerRow.dataset.dayKey = currentDayKey;

            const divider = document.createElement("div");
            divider.className = "chat-day-divider";
            divider.textContent = formatMessageDayLabel(message.created_at);

            dividerRow.appendChild(divider);
            messagesArea.appendChild(dividerRow);

            lastDayKey = currentDayKey;
        }

        renderSingleRealMessage({
            messagesArea,
            message,
            index,
            messages: sortedMessages,
            currentUserId,
            createImageAttachmentCard,
            createFileAttachmentCard,
            onReact
        });
    });

    scheduleScrollToBottom?.(true);
}

export function renderPendingMessages({
    messagesArea,
    pendingMessages,
    activeConversationId,
    scheduleScrollToBottom
}) {
    if (!messagesArea) return;

    const pending = pendingMessages.filter(
        (msg) => msg.conversationId === activeConversationId
    );

    pending.forEach((msg) => {
        let wrapper = document.querySelector(`[data-pending-id="${msg.tempId}"]`);

        if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.dataset.pendingId = msg.tempId;
            messagesArea.appendChild(wrapper);
        }

        wrapper.innerHTML = "";

        renderSinglePendingMessage({
            container: wrapper,
            pendingMessage: msg
        });
    });

    scheduleScrollToBottom?.();
}

/* =========================
   REAL MESSAGE RENDERING
========================= */

function renderSingleRealMessage({
    messagesArea,
    message,
    index,
    messages,
    currentUserId,
    createImageAttachmentCard,
    createFileAttachmentCard,
    onReact
}) {
    const isOwn = message.sender_id === currentUserId;
    const hasText = !!String(message.content || "").trim();
    const hasAttachments =
    Array.isArray(message.attachments) &&
    message.attachments.length > 0;
    const hasLinkPreview = !!message.link_url;

    const groupPosition = getMessageGroupPosition(messages, index);
    const showTime = shouldShowTimeForMessage(messages, index);

    if (hasText || hasLinkPreview) {
        const row = document.createElement("div");
        row.className = `message-row ${isOwn ? "own" : "other"} message-row-${groupPosition}`;

        const stack = document.createElement("div");
        stack.className = "message-stack";

        let textBubble = null;

        if (hasText) {
            const bubble = document.createElement("div");
            bubble.className = `message-bubble message-bubble-${groupPosition} message-bubble-reactable`;

            const reactionPicker = createReactionPicker({
                messageId: message.id,
                reactions: message.reactions || [],
                currentUserId,
                onReact
            });

            const content = document.createElement("div");
            content.className = "message-content";
            renderMessageContent(content, message.content);

            bubble.appendChild(reactionPicker);
            bubble.appendChild(content);

            bubble.addEventListener("click", (e) => {
                e.stopPropagation();
                reactionPicker.classList.toggle("is-open");
            });

            stack.appendChild(bubble);
            textBubble = bubble;
        }

        if (hasLinkPreview) {
            const previewCard = createLinkPreviewCard(message);
            stack.appendChild(previewCard);
        }

        if (message.reactions?.length) {
            const reactionsNode = createMessageReactions(
                message.reactions,
                currentUserId
            );

            if (reactionsNode && textBubble) {
                textBubble.appendChild(reactionsNode);
                textBubble.classList.add("has-reactions");
            }
        }

        if (showTime) {
            const time = document.createElement("div");
            time.className = "message-time";
            time.textContent = formatMessageTime(message.created_at);
            stack.appendChild(time);
        }

        row.appendChild(stack);
        messagesArea.appendChild(row);
    }

    if (hasAttachments) {
        const row = document.createElement("div");
        row.className = `message-row ${isOwn ? "own" : "other"} message-row-${groupPosition}`;

        const stack = document.createElement("div");
        stack.className = "message-stack";

        const bubble = document.createElement("div");
        bubble.className = `message-bubble message-bubble-attachment-only message-bubble-${groupPosition}`;

        const contentWrap = document.createElement("div");
        contentWrap.className = "message-attachment-content";

        renderMessageAttachments({
            container: contentWrap,
            attachments: message.attachments,
            createImageAttachmentCard,
            createFileAttachmentCard
        });

        bubble.appendChild(contentWrap);
        stack.appendChild(bubble);

        if (message.reactions?.length) {
            const reactionsNode = createMessageReactions(
                message.reactions,
                currentUserId
            );

            if (reactionsNode) {
                bubble.appendChild(reactionsNode);
                bubble.classList.add("has-reactions");
            }
        }

        if (showTime) {
            const time = document.createElement("div");
            time.className = "message-time";
            time.textContent = formatMessageTime(message.created_at);
            stack.appendChild(time);
        }

        row.appendChild(stack);
        messagesArea.appendChild(row);
    }
}

/* =========================
   PENDING MESSAGE RENDERING
========================= */

function renderSinglePendingMessage({
    container,
    pendingMessage
}) {
    const hasText = !!String(pendingMessage.content || "").trim();
    const hasAttachments =
    Array.isArray(pendingMessage.attachments) &&
    pendingMessage.attachments.length > 0;

    if (hasText) {
        const row = document.createElement("div");
        row.className = "message-row own";

        const stack = document.createElement("div");
        stack.className = "message-stack";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble pending-message-bubble";

        const content = document.createElement("div");
        content.className = "message-content";
        renderMessageContent(content, pendingMessage.content);

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = getPendingMessageStatusText(pendingMessage);

        bubble.appendChild(content);
        stack.appendChild(bubble);
        stack.appendChild(time);
        row.appendChild(stack);

        container.appendChild(row);
    }

    if (hasAttachments) {
        const row = document.createElement("div");
        row.className = "message-row own";

        const stack = document.createElement("div");
        stack.className = "message-stack";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble message-bubble-attachment-only pending-message-bubble";

        renderPendingMessageAttachments({
            container: bubble,
            attachments: pendingMessage.attachments
        });

        stack.appendChild(bubble);

        const time = document.createElement("div");
        time.className = "message-time";
        time.textContent = getPendingMessageStatusText(pendingMessage);

        stack.appendChild(time);
        row.appendChild(stack);

        container.appendChild(row);
    }
}

/* =========================
   ATTACHMENTS
========================= */

function renderMessageAttachments({
    container,
    attachments,
    createImageAttachmentCard,
    createFileAttachmentCard
}) {
    if (!attachments?.length) return;

    const images = attachments.filter(isImageAttachment);
    const files = attachments.filter((a) => !isImageAttachment(a));

    if (images.length) {
        const grid = createMessageImageGrid(images, createImageAttachmentCard);
        container.appendChild(grid);
    }

    if (files.length) {
        const list = createAttachmentList();

        files.forEach((attachment) => {
            list.appendChild(createFileAttachmentCard(attachment));
        });

        container.appendChild(list);
    }
}

function renderPendingMessageAttachments({
    container,
    attachments
}) {
    if (!attachments?.length) return;

    const images = attachments.filter((a) =>
    String(a?.file?.type || "").toLowerCase().startsWith("image/")
    );

    const files = attachments.filter((a) =>
    !String(a?.file?.type || "").toLowerCase().startsWith("image/")
    );

    if (images.length) {
        const grid = document.createElement("div");
        grid.className = "message-image-grid";

        if (images.length === 1) grid.classList.add("one");
        else if (images.length === 2) grid.classList.add("two");
        else if (images.length === 3) grid.classList.add("three");
        else grid.classList.add("multi");

        images.forEach((attachment) => {
            const node = createPendingImageAttachmentCard(attachment);
            node.classList.add("message-image-grid-item");
            grid.appendChild(node);
        });

        container.appendChild(grid);
    }

    if (files.length) {
        const list = createAttachmentList();

        files.forEach((attachment) => {
            list.appendChild(createPendingFileAttachmentCard(attachment));
        });

        container.appendChild(list);
    }
}

function createAttachmentList() {
    const wrap = document.createElement("div");
    wrap.className = "message-attachments";
    return wrap;
}

function createMessageImageGrid(images, createImageAttachmentCard) {
    const grid = document.createElement("div");
    grid.className = "message-image-grid";

    if (images.length === 1) grid.classList.add("one");
    else if (images.length === 2) grid.classList.add("two");
    else if (images.length === 3) grid.classList.add("three");
    else grid.classList.add("multi");

    images.forEach((attachment, index) => {
        const node = createImageAttachmentCard(attachment, images, index);
        node.classList.add("message-image-grid-item");
        grid.appendChild(node);
    });

    return grid;
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
    img.src = attachment.previewUrl || "";

    wrap.appendChild(img);

    const ring = createCircularProgressLoader(
        attachment.progress || 0,
        attachment.uploaded ? "is-done" : ""
    );
    wrap.appendChild(ring);

    return wrap;
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

/* =========================
   MESSAGE CONTENT
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
   TIME / DAY / GROUPING
========================= */

function formatMessageTime(dateString) {
    const date = new Date(dateString);

    return date.toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit"
    });
}

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

    if (dateKey === todayKey) return "Today";
    if (dateKey === yesterdayKey) return "Yesterday";

    return date.toLocaleDateString(getLocale(), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function shouldGroupMessages(first, second) {
    if (!first || !second) return false;
    if (first.sender_id !== second.sender_id) return false;

    if (getMessageDayKey(first.created_at) !== getMessageDayKey(second.created_at)) {
        return false;
    }

    const diff = new Date(second.created_at) - new Date(first.created_at);
    return diff >= 0 && diff <= 5 * 60 * 1000;
}

function getMessageGroupPosition(messages, index) {
    const prev = messages[index - 1];
    const next = messages[index + 1];

    const prevGroup = shouldGroupMessages(prev, messages[index]);
    const nextGroup = shouldGroupMessages(messages[index], next);

    if (prevGroup && nextGroup) return "middle";
    if (prevGroup) return "end";
    if (nextGroup) return "start";
    return "single";
}

function shouldShowTimeForMessage(messages, index) {
    const current = messages[index];
    const next = messages[index + 1];

    if (!current) return false;
    if (!next) return true;

    return !shouldGroupMessages(current, next);
}

/* =========================
   MISC HELPERS
========================= */

function isImageAttachment(attachment) {
    const mime = (attachment?.mime_type || "").toLowerCase();
    return mime.startsWith("image/");
}

function getPendingMessageStatusText(message) {
    if (message.status === "failed") return "Failed";
    if (message.status === "sending") return "Sending";
    return "Uploading";
}

function formatAttachmentSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

function createLinkPreviewCard(message) {
    const card = document.createElement("a");
    card.className = "message-link-preview";
    card.href = message.link_url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const hasImage = !!message.link_image;

    if (hasImage) {
        const image = document.createElement("img");
        image.className = "message-link-preview-image";
        image.src = message.link_image;
        image.alt = message.link_title || message.link_site || "Link preview";
        image.loading = "lazy";
        card.appendChild(image);
    }

    const body = document.createElement("div");
    body.className = "message-link-preview-body";

    if (message.link_title) {
        const title = document.createElement("div");
        title.className = "message-link-preview-title";
        title.textContent = message.link_title;
        body.appendChild(title);
    }

    if (message.link_description) {
        const description = document.createElement("div");
        description.className = "message-link-preview-description";
        description.textContent = message.link_description;
        body.appendChild(description);
    }

    const site = document.createElement("div");
    site.className = "message-link-preview-site";
    site.textContent = message.link_site || message.link_url;
    body.appendChild(site);

    card.appendChild(body);

    return card;
}

function getLocale() {
    return localStorage.getItem("lang") || "en";
}

/* =========================
   REACTIONS
========================= */

function createMessageReactions(reactions = [], currentUserId) {
    const grouped = groupMessageReactions(reactions, currentUserId);

    if (!grouped.length) return null;

    const wrap = document.createElement("div");
    wrap.className = "message-reactions";

    grouped.forEach((item) => {
        const pill = document.createElement("div");
        pill.className = "message-reaction-pill";

        if (item.reactedByMe) {
            pill.classList.add("is-own-reaction");
        }

        const emoji = document.createElement("span");
        emoji.className = "message-reaction-emoji";
        emoji.textContent = item.emoji;

        pill.appendChild(emoji);
        wrap.appendChild(pill);
    });

    return wrap;
}

function groupMessageReactions(reactions = [], currentUserId) {
    const map = new Map();

    reactions.forEach((reaction) => {
        const emoji = reaction?.emoji;
        if (!emoji) return;

        if (!map.has(emoji)) {
            map.set(emoji, {
                emoji,
                count: 0,
                reactedByMe: false
            });
        }

        const item = map.get(emoji);
        item.count += 1;

        if (reaction.user_id === currentUserId) {
            item.reactedByMe = true;
        }
    });

    return Array.from(map.values());
}

function createReactionPicker({
    messageId,
    reactions = [],
    currentUserId,
    onReact
}) {
    const emojis = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

    const myReaction = reactions.find(
        (reaction) => reaction.user_id === currentUserId
    );

    const myEmoji = myReaction?.emoji || null;

    const wrap = document.createElement("div");
    wrap.className = "message-reaction-picker-wrap";

    const picker = document.createElement("div");
    picker.className = "message-reaction-picker";

    emojis.forEach((emoji) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "message-reaction-picker-btn";
        btn.textContent = emoji;

        if (emoji === myEmoji) {
            btn.classList.add("is-selected");
        }

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            wrap.classList.remove("is-open");

            onReact?.({
                messageId,
                emoji
            });
        });

        picker.appendChild(btn);
    });

    wrap.appendChild(picker);

    if (!window.__messageReactionOutsideClickBound) {
        document.addEventListener("click", () => {
            document
                .querySelectorAll(".message-reaction-picker-wrap.is-open")
                .forEach((node) => {
                node.classList.remove("is-open");
            });
        });

        window.__messageReactionOutsideClickBound = true;
    }

    return wrap;
}
