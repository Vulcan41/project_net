import { supabase } from "../../../core/supabase.js";

let currentProject = null;
let selectedAvatarFile = null;

export function initSettings(project) {
    if (!project?.id) {
        console.error("No project passed to settings view.");
        return;
    }

    currentProject = project;
    selectedAvatarFile = null;

    setupForm();
    fillForm();
}

function setupForm() {
    const form = document.getElementById("project-settings-form");
    const avatarBtn = document.getElementById("project-settings-avatar-btn");
    const avatarInput = document.getElementById("project-settings-avatar-input");

    if (avatarBtn && avatarInput) {
        avatarBtn.onclick = () => avatarInput.click();

        avatarInput.onchange = () => {
            const file = avatarInput.files?.[0];
            if (!file) return;

            selectedAvatarFile = file;
            renderAvatarPreview(file);
        };
    }

    if (form) {
        form.onsubmit = async (event) => {
            event.preventDefault();
            await saveSettings();
        };
    }
}

function fillForm() {
    const nameInput = document.getElementById("project-settings-name");
    const descriptionInput = document.getElementById("project-settings-description");

    if (nameInput) {
        nameInput.value = currentProject.name || "";
    }

    if (descriptionInput) {
        descriptionInput.value = currentProject.description || "";
    }

    renderAvatarPreview(currentProject.avatar_url || null);
    resetMessages();
}

function renderAvatarPreview(source) {
    const preview = document.getElementById("project-settings-avatar-preview");
    if (!preview) return;

    if (source instanceof File) {
        const reader = new FileReader();

        reader.onload = () => {
            preview.innerHTML = `<img src="${reader.result}" alt="Project avatar preview" />`;
        };

        reader.readAsDataURL(source);
        return;
    }

    if (typeof source === "string" && source.trim() !== "") {
        preview.innerHTML = `
            <img src="${escapeHtml(source)}" alt="Project avatar preview" />
        `;
        return;
    }

    preview.innerHTML = `
        <span class="project-settings-avatar-fallback">
            ${escapeHtml((currentProject.name || "P").charAt(0).toUpperCase())}
        </span>
    `;
}

async function saveSettings() {
    const nameInput = document.getElementById("project-settings-name");
    const descriptionInput = document.getElementById("project-settings-description");

    const name = nameInput?.value.trim() || "";
    const description = descriptionInput?.value.trim() || "";

    if (!name) {
        showError("Το όνομα του project είναι υποχρεωτικό.");
        return;
    }

    try {
        resetMessages();

        let nextAvatarUrl = currentProject.avatar_url || null;

        if (selectedAvatarFile) {
            const ext = selectedAvatarFile.name.split(".").pop()?.toLowerCase() || "png";
            const filePath = `${currentProject.id}/avatar.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from("project-avatars")
                .upload(filePath, selectedAvatarFile, {
                upsert: true
            });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from("project-avatars")
                .getPublicUrl(filePath);

            const publicUrl = publicData?.publicUrl;
            if (!publicUrl) {
                throw new Error("Could not get project avatar URL.");
            }

            nextAvatarUrl = `${publicUrl}?t=${Date.now()}`;
        }

        const { error: updateError } = await supabase
            .from("projects")
            .update({
            name,
            description: description || null,
            avatar_url: nextAvatarUrl
        })
            .eq("id", currentProject.id);

        if (updateError) throw updateError;

        currentProject = {
            ...currentProject,
            name,
            description: description || null,
            avatar_url: nextAvatarUrl
        };

        window.dispatchEvent(
            new CustomEvent("project-updated", {
                detail: currentProject
            })
        );

        fillForm();
        showSuccess("Οι αλλαγές αποθηκεύτηκαν.");
    } catch (error) {
        console.error("Project settings save failed:", error);
        showError("Αποτυχία αποθήκευσης αλλαγών.");
    }
}

function showError(message) {
    const errorEl = document.getElementById("project-settings-error");
    const successEl = document.getElementById("project-settings-success");

    if (successEl) {
        successEl.textContent = "";
        successEl.classList.add("hidden");
        successEl.style.display = "none";
    }

    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
    errorEl.style.display = "block";
}

function showSuccess(message) {
    const errorEl = document.getElementById("project-settings-error");
    const successEl = document.getElementById("project-settings-success");

    if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
        errorEl.style.display = "none";
    }

    if (!successEl) return;

    successEl.textContent = message;
    successEl.classList.remove("hidden");
    successEl.style.display = "block";
}

function resetMessages() {
    const errorEl = document.getElementById("project-settings-error");
    const successEl = document.getElementById("project-settings-success");

    if (errorEl) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
        errorEl.style.display = "none";
    }

    if (successEl) {
        successEl.textContent = "";
        successEl.classList.add("hidden");
        successEl.style.display = "none";
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}