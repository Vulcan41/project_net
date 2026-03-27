let folderModalInitialized = false;
let confirmHandler = null;
let cancelHandler = null;
let modalMode = "input";

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
        if (event.key === "Enter" && modalMode === "input") {
            event.preventDefault();
            await handleConfirm();
        }

        if (event.key === "Escape") {
            event.preventDefault();
            handleCancel();
        }
    });

    document.addEventListener("keydown", async (event) => {
        const modalEl = document.getElementById("folder-modal");
        if (!modalEl || modalEl.classList.contains("hidden")) return;

        if (event.key === "Escape") {
            event.preventDefault();
            handleCancel();
        }

        if (event.key === "Enter" && modalMode === "confirm") {
            event.preventDefault();
            await handleConfirm();
        }
    });

    modal.dataset.bound = "true";
}

async function handleConfirm() {
    const input = document.getElementById("folder-modal-input");

    if (modalMode === "input") {
        const value = input?.value?.trim() || "";
        if (!value) {
            input?.focus();
            return;
        }

        if (typeof confirmHandler === "function") {
            await confirmHandler(value);
        }

        return;
    }

    if (typeof confirmHandler === "function") {
        await confirmHandler();
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
    const messageEl = document.getElementById("folder-modal-message");
    const labelEl = document.getElementById("folder-modal-label");
    const input = document.getElementById("folder-modal-input");
    const confirmBtn = document.getElementById("folder-modal-confirm");

    if (!modal || !titleEl || !messageEl || !labelEl || !input || !confirmBtn) return;

    modalMode = "input";
    confirmHandler = onConfirm || null;
    cancelHandler = onCancel || null;

    titleEl.textContent = title;
    labelEl.textContent = label;
    confirmBtn.textContent = confirmText;
    confirmBtn.classList.remove("folder-modal-btn-danger");
    input.value = initialValue || "";

    messageEl.textContent = "";
    messageEl.classList.add("hidden");
    labelEl.classList.remove("hidden");
    input.classList.remove("hidden");

    modal.classList.remove("hidden");

    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

export function openFolderConfirmModal({
    title = "Confirm",
    message = "Are you sure?",
    confirmText = "Delete",
    danger = true,
    onConfirm,
    onCancel
}) {
    const modal = document.getElementById("folder-modal");
    const titleEl = document.getElementById("folder-modal-title");
    const messageEl = document.getElementById("folder-modal-message");
    const labelEl = document.getElementById("folder-modal-label");
    const input = document.getElementById("folder-modal-input");
    const confirmBtn = document.getElementById("folder-modal-confirm");

    if (!modal || !titleEl || !messageEl || !labelEl || !input || !confirmBtn) return;

    modalMode = "confirm";
    confirmHandler = onConfirm || null;
    cancelHandler = onCancel || null;

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;

    if (danger) {
        confirmBtn.classList.add("folder-modal-btn-danger");
    } else {
        confirmBtn.classList.remove("folder-modal-btn-danger");
    }

    messageEl.classList.remove("hidden");
    labelEl.classList.add("hidden");
    input.classList.add("hidden");
    input.value = "";

    modal.classList.remove("hidden");

    requestAnimationFrame(() => {
        confirmBtn.focus();
    });
}

export function closeFolderModal() {
    const modal = document.getElementById("folder-modal");
    const confirmBtn = document.getElementById("folder-modal-confirm");

    if (!modal) return;

    modal.classList.add("hidden");
    confirmBtn?.classList.remove("folder-modal-btn-danger");

    confirmHandler = null;
    cancelHandler = null;
    modalMode = "input";
}