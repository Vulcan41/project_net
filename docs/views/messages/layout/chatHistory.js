/* =========================
   PUBLIC API
========================= */

export function renderMessages({
    messagesArea,
    messages,
    currentUserId,
    renderMessageContent,
    formatMessageTime,
    getMessageDayKey,
    formatMessageDayLabel,
    isImageAttachment,
    createImageAttachmentCard,
    createFileAttachmentCard,
    scheduleScrollToBottom
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
            renderMessageContent,
            formatMessageTime,
            isImageAttachment,
            createImageAttachmentCard,
            createFileAttachmentCard,
            getMessageDayKey
        });
    });

    scheduleScrollToBottom(true);
}

export function renderPendingMessages({
    messagesArea,
    pendingMessages,
    activeConversationId,
    renderMessageContent,
    getPendingMessageStatusText,
    getMessageFileIcon,
    formatAttachmentSize,
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
            pendingMessage: msg,
            renderMessageContent,
            getPendingMessageStatusText,
            getMessageFileIcon,
            formatAttachmentSize
        });
    });

    scheduleScrollToBottom();
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
    renderMessageContent,
    formatMessageTime,
    isImageAttachment,
    createImageAttachmentCard,
    createFileAttachmentCard,
    getMessageDayKey
}) {
    const isOwn = message.sender_id === currentUserId;
    const hasText = message.content && message.content.trim();
    const hasAttachments = message.attachments && message.attachments.length > 0;

    const groupPosition = getMessageGroupPosition(messages, index, getMessageDayKey);
    const showTime = shouldShowTimeForMessage(messages, index, getMessageDayKey);

    if (hasText) {
        const row = document.createElement("div");
        row.className = `message-row ${isOwn ? "own" : "other"} message-row-${groupPosition}`;

        const stack = document.createElement("div");
        stack.className = "message-stack";

        const bubble = document.createElement("div");
        bubble.className = `message-bubble message-bubble-${groupPosition}`;

        const content = document.createElement("div");
        content.className = "message-content";
        renderMessageContent(content, message.content);

        bubble.appendChild(content);
        stack.appendChild(bubble);

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

        renderMessageAttachments(
            contentWrap,
            message.attachments,
            isImageAttachment,
            createImageAttachmentCard,
            createFileAttachmentCard
        );

        bubble.appendChild(contentWrap);
        stack.appendChild(bubble);

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
    pendingMessage,
    renderMessageContent,
    getPendingMessageStatusText,
    getMessageFileIcon,
    formatAttachmentSize
}) {
    const hasText = pendingMessage.content && pendingMessage.content.trim();
    const hasAttachments = pendingMessage.attachments && pendingMessage.attachments.length > 0;

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
            attachments: pendingMessage.attachments,
            getMessageFileIcon,
            formatAttachmentSize
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

function renderMessageAttachments(
container,
attachments,
isImageAttachment,
createImageAttachmentCard,
createFileAttachmentCard
) {
    if (!attachments.length) return;

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
    attachments,
    getMessageFileIcon,
    formatAttachmentSize
}) {
    if (!attachments.length) return;

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
            list.appendChild(
                createPendingFileAttachmentCard(
                    attachment,
                    getMessageFileIcon,
                    formatAttachmentSize
                )
            );
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

function createPendingFileAttachmentCard(
attachment,
getMessageFileIcon,
formatAttachmentSize
) {
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
   GROUPING + TIME
========================= */

function shouldGroupMessages(first, second, getMessageDayKey) {
    if (!first || !second) return false;
    if (first.sender_id !== second.sender_id) return false;

    if (
    getMessageDayKey(first.created_at) !==
    getMessageDayKey(second.created_at)
    ) return false;

    const diff = new Date(second.created_at) - new Date(first.created_at);
    return diff >= 0 && diff <= 5 * 60 * 1000;
}

function getMessageGroupPosition(messages, index, getMessageDayKey) {
    const prev = messages[index - 1];
    const next = messages[index + 1];

    const prevGroup = shouldGroupMessages(prev, messages[index], getMessageDayKey);
    const nextGroup = shouldGroupMessages(messages[index], next, getMessageDayKey);

    if (prevGroup && nextGroup) return "middle";
    if (prevGroup) return "end";
    if (nextGroup) return "start";
    return "single";
}

function shouldShowTimeForMessage(messages, index, getMessageDayKey) {
    const current = messages[index];
    const next = messages[index + 1];

    if (!current) return false;
    if (!next) return true;

    return !shouldGroupMessages(current, next, getMessageDayKey);
}