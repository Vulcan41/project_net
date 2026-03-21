let modalEl = null;

export function initChangeProjectModal() {
    modalEl = document.getElementById("change-project-modal");

    const closeBtn = document.getElementById("change-project-close-btn");
    const backdrop = modalEl?.querySelector(".change-project-backdrop");

    if (closeBtn) closeBtn.onclick = closeModal;
    if (backdrop) backdrop.onclick = closeModal;
}

export function openChangeProjectModal() {
    if (!modalEl) return;
    modalEl.classList.remove("hidden");
}

export function closeModal() {
    if (!modalEl) return;
    modalEl.classList.add("hidden");
}