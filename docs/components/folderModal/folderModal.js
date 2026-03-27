let folderModalInitialized = false;
let confirmHandler = null;
let cancelHandler = null;

export async function ensureFolderModal() {
    if (folderModalInitialized || document.getElementById("folder-modal")) {
        folderModalInitialized = true;
        bindFolderModalEvents();
        return;
    }

    const htmlPath = "./components/folderModal/folderModal.html";
    const cssPath = "./components/folderModal/folderModal.css";

    const res = await fetch(htmlPath);
    const html = await res.text();

    document.body.insertAdjacentHTML("beforeend", html);

    if (!document.getElementById("folder-modal-css")) {
        const link = document.createElement("link");
        link.id = "folder-modal-css";
        link.rel = "stylesheet";
        link.href = cssPath;
        document.head.appendChild(link);
    }

    folderModalInitialized = true;
    bindFolderModalEvents();
}

function bindFolderModalEvents() {
    const modal = document.getElementById("folder-modal");
    if (!modal || modal.dataset.bound === "true") return;

    const backdrop = modal.querySelector(".folder-modal-backdrop");
    const confirmBtn = document.getElementById("folder-modal-confirm");
    const cancelBtn = document.getElementById("folder-modal-cancel");
    const input = document.getElementById("folder-modal-input");

    backdrop?.addEventListener("click", () => {
        handleCancel();
    });

    cancelBtn?.addEventListener("click", () => {
        handleCancel();
    });

    confirmBtn?.addEventListener("click", async () => {
        await handleConfirm();
    });

    input?.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            await handleConfirm();
        }

        if (event.key === "Escape") {
            event.preventDefault();
            handleCancel();
        }
    });

    modal.dataset.bound = "true";
}

async function handleConfirm() {
    const input = document.getElementById("folder-modal-input");
    const value = input?.value?.trim() || "";

    if (!value) {
        input?.focus();
        return;
    }

    if (typeof confirmHandler === "function") {
        await confirmHandler(value);
    }
}

function handleCancel() {
    if (typeof cancelHandler === "function") {
        cancelHandler();
    }

    closeFolderModal();
}

export function openFolderModal({
    title = "Folder",
    label = "Folder name",
    confirmText = "Save",
    initialValue = "",
    onConfirm,
    onCancel
}) {
    const modal = document.getElementById("folder-modal");
    const titleEl = document.getElementById("folder-modal-title");
    const labelEl = document.getElementById("folder-modal-label");
    const input = document.getElementById("folder-modal-input");
    const confirmBtn = document.getElementById("folder-modal-confirm");

    if (!modal || !titleEl || !labelEl || !input || !confirmBtn) return;

    confirmHandler = onConfirm || null;
    cancelHandler = onCancel || null;

    titleEl.textContent = title;
    labelEl.textContent = label;
    confirmBtn.textContent = confirmText;
    input.value = initialValue || "";

    modal.classList.remove("hidden");

    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

export function closeFolderModal() {
    const modal = document.getElementById("folder-modal");
    if (!modal) return;

    modal.classList.add("hidden");
    confirmHandler = null;
    cancelHandler = null;
}