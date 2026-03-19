export function initSetUpProject({ onSubmit }) {
    const modal = document.getElementById("setup-project-modal");
    const backdrop = document.getElementById("setup-project-backdrop");
    const closeBtn = document.getElementById("setup-project-close-btn");
    const cancelBtn = document.getElementById("setup-project-cancel-btn");
    const submitBtn = document.getElementById("setup-project-submit-btn");

    const nameInput = document.getElementById("setup-project-name");
    const descriptionInput = document.getElementById("setup-project-description");
    const visibilityInput = document.getElementById("setup-project-visibility");
    const errorBox = document.getElementById("setup-project-error");

    if (!modal) return;

    function clearError() {
        if (!errorBox) return;
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
    }

    function showError(message) {
        if (!errorBox) return;
        errorBox.textContent = message;
        errorBox.classList.remove("hidden");
    }

    function closeModal() {
        clearError();
        modal.classList.add("hidden");

        if (nameInput) nameInput.value = "";
        if (descriptionInput) descriptionInput.value = "";
        if (visibilityInput) visibilityInput.value = "private";
    }

    async function handleSubmit() {
        clearError();

        const payload = {
            name: nameInput?.value?.trim() ?? "",
            description: descriptionInput?.value?.trim() ?? "",
            visibility: visibilityInput?.value ?? "private"
        };

        if (!payload.name) {
            showError("Το ονομα του project ειναι υποχρεωτικο.");
            return;
        }

        submitBtn.disabled = true;

        try {
            if (onSubmit) {
                await onSubmit(payload);
            }
            closeModal();
        } catch (error) {
            console.error("Project modal submit error:", error);
            showError(error?.message || "Αποτυχια δημιουργιας project.");
        } finally {
            submitBtn.disabled = false;
        }
    }

    backdrop.onclick = closeModal;
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    submitBtn.onclick = handleSubmit;

    nameInput?.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            await handleSubmit();
        }
    });

    modal.classList.remove("hidden");
    clearError();

    setTimeout(() => {
        nameInput?.focus();
    }, 0);
}