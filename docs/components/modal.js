let modalInitialized = false;
let confirmHandler = null;

export async function initModal() {
    if (modalInitialized) return;

    const existing = document.getElementById("app-modal");
    if (!existing) {
        const response = await fetch("components/modal.html");
        const html = await response.text();
        document.body.insertAdjacentHTML("beforeend", html);
    }

    bindModalEvents();
    modalInitialized = true;
}

function bindModalEvents() {
    const modal = document.getElementById("app-modal");
    const cancelBtn = document.getElementById("app-modal-cancel");
    const confirmBtn = document.getElementById("app-modal-confirm");

    cancelBtn?.addEventListener("click", closeModal);

    confirmBtn?.addEventListener("click", async () => {
        try {
            if (typeof confirmHandler === "function") {
                await confirmHandler();
            }
        } finally {
            closeModal();
        }
    });

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

export function openModal({
    message = "Είστε σίγουροι;",
    cancelText = "Ακύρωση",
    confirmText = "Επιβεβαίωση",
    onConfirm = null
} = {}) {
    const modal = document.getElementById("app-modal");
    const messageEl = document.getElementById("app-modal-message");
    const cancelBtn = document.getElementById("app-modal-cancel");
    const confirmBtn = document.getElementById("app-modal-confirm");

    if (!modal || !messageEl || !cancelBtn || !confirmBtn) return;

    messageEl.textContent = message;
    cancelBtn.textContent = cancelText;
    confirmBtn.textContent = confirmText;

    confirmHandler = onConfirm;
    modal.classList.remove("modal-hidden");
}

export function closeModal() {
    const modal = document.getElementById("app-modal");
    if (!modal) return;

    modal.classList.add("modal-hidden");
    confirmHandler = null;
}