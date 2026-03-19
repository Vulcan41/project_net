let textToolsTemplate = null;

export async function initTextTools(container, textarea) {
    if (!container || !textarea) return null;

    let bar = container.querySelector(".text-tools-bar");

    if (!bar) {
        if (!textToolsTemplate) {
            const response = await fetch("components/textTools.html");

            if (!response.ok) {
                console.error("Failed to load textTools.html");
                return null;
            }

            textToolsTemplate = await response.text();
        }

        const wrapper = document.createElement("div");
        wrapper.innerHTML = textToolsTemplate.trim();

        bar = wrapper.firstElementChild;

        if (!bar) {
            console.error("textTools.html did not return a valid root element");
            return null;
        }

        container.prepend(bar);
    }

    bindTextTools(bar, textarea);

    return bar;
}

function bindTextTools(bar, textarea) {
    if (!bar || !textarea) return;

    preventToolbarFocusSteal(bar);
    bindEmojiInsert(bar, textarea);
    bindTextFormatting(bar, textarea);
}

function preventToolbarFocusSteal(bar) {
    const toolButtons = bar.querySelectorAll(".text-tool-btn, .emoji");

    toolButtons.forEach(btn => {
        btn.onmousedown = (e) => {
            e.preventDefault();
        };
    });
}

function bindEmojiInsert(bar, textarea) {
    const picker = bar.querySelector(".emoji-picker");
    if (!picker) return;

    picker.onclick = (e) => {
        const btn = e.target.closest(".emoji");
        if (!btn) return;

        const emoji = btn.textContent.trim();
        if (!emoji) return;

        insertAtSelection(textarea, emoji);
    };
}

function bindTextFormatting(bar, textarea) {
    const boldBtn = bar.querySelector(".text-tool-bold");
    const italicBtn = bar.querySelector(".text-tool-italic");

    if (boldBtn) {
        boldBtn.onclick = () => {
            applyTextFormat(textarea, "**");
        };
    }

    if (italicBtn) {
        italicBtn.onclick = () => {
            applyTextFormat(textarea, "*");
        };
    }
}

function insertAtSelection(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;

    textarea.value =
    textarea.value.slice(0, start) +
    text +
    textarea.value.slice(end);

    const newCursor = start + text.length;

    textarea.focus();
    textarea.setSelectionRange(newCursor, newCursor);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyTextFormat(textarea, wrapper) {
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;

    const selected = textarea.value.slice(start, end);
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);

    if (selected.length > 0) {
        const newText = wrapper + selected + wrapper;
        textarea.value = before + newText + after;

        const newCursor = start + newText.length;
        textarea.focus();
        textarea.setSelectionRange(newCursor, newCursor);
    } else {
        const newText = wrapper + wrapper;
        textarea.value = before + newText + after;

        const cursorInside = start + wrapper.length;
        textarea.focus();
        textarea.setSelectionRange(cursorInside, cursorInside);
    }

    textarea.dispatchEvent(new Event("input", { bubbles: true }));
}