import { supabase } from "../../../core/supabase.js";
import { loadView } from "../../../core/router.js";
import { showInfo } from "../../../components/info.js";

const PROJECT_AVATAR_BUCKET = "project-avatars";

let currentProject = null;
let selectedAvatarFile = null;
let objectPreviewUrl = null;

export function initSettings(project) {
    if (!project) return;

    currentProject = project;
    selectedAvatarFile = null;

    fillProjectSettingsForm(project);
    setupAvatarInput();
    setupInstantOptions();
    setupFormSubmit();
    setupDeleteButton();
}

/* =========================
   INITIAL LOAD
========================= */

function fillProjectSettingsForm(project) {
    const nameInput = document.getElementById("project-settings-name");
    const descriptionInput = document.getElementById("project-settings-description");
    const membersCanViewMembersInput = document.getElementById(
        "project-settings-members-can-view-members"
    );

    if (nameInput) {
        nameInput.value = project.name ?? "";
    }

    if (descriptionInput) {
        descriptionInput.value = project.description ?? "";
    }

    if (membersCanViewMembersInput) {
        membersCanViewMembersInput.checked =
        project.members_can_view_members !== false;
    }

    const visibilityValue = project.visibility || "public";
    const visibilityInput = document.querySelector(
        `input[name="project-settings-visibility"][value="${visibilityValue}"]`
    );

    if (visibilityInput) {
        visibilityInput.checked = true;
    }

    renderAvatarPreview(project.avatar_url, project.name);
}

/* =========================
   AVATAR
========================= */

function setupAvatarInput() {
    const fileInput = document.getElementById("project-settings-avatar-input");
    const uploadLabel = document.getElementById("project-avatar-upload");

    if (!fileInput || !uploadLabel) return;

    fileInput.onchange = () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        selectedAvatarFile = file;

        if (objectPreviewUrl) {
            URL.revokeObjectURL(objectPreviewUrl);
        }

        objectPreviewUrl = URL.createObjectURL(file);
        renderAvatarPreview(objectPreviewUrl, getProjectNameInputValue());
    };
}

function setupInstantOptions() {
    const membersCanViewMembersInput = document.getElementById(
        "project-settings-members-can-view-members"
    );

    if (!membersCanViewMembersInput) return;

    membersCanViewMembersInput.onchange = async () => {
        if (!currentProject?.id) return;

        const nextValue = membersCanViewMembersInput.checked;

        membersCanViewMembersInput.disabled = true;

        try {
            const { error } = await supabase
                .from("projects")
                .update({
                members_can_view_members: nextValue
            })
                .eq("id", currentProject.id);

            if (error) {
                throw error;
            }

            currentProject = {
                ...currentProject,
                members_can_view_members: nextValue
            };

            window.dispatchEvent(
                new CustomEvent("project-updated", {
                    detail: {
                        members_can_view_members: nextValue
                    }
                })
            );

            await showInfo({
                type: "success",
                message: "Member option updated."
            });
        } catch (error) {
            console.error("Instant member option update failed:", error);

            membersCanViewMembersInput.checked = !nextValue;

            await showInfo({
                type: "error",
                message: error?.message || "Failed to update member option."
            });
        } finally {
            membersCanViewMembersInput.disabled = false;
        }
    };
}

function renderAvatarPreview(imageUrl, projectName) {
    const preview = document.getElementById("project-settings-avatar-preview");
    if (!preview) return;

    const safeLetter = escapeHtml((projectName || "P").charAt(0).toUpperCase());

    if (imageUrl) {
        preview.innerHTML = `
            <img
                src="${escapeHtml(imageUrl)}"
                alt="${escapeHtml(projectName || "project")} avatar"
            />
        `;
        return;
    }

    preview.innerHTML = `
        <span class="project-settings-avatar-fallback">${safeLetter}</span>
    `;
}

/* =========================
   SAVE
========================= */

function setupFormSubmit() {
    const form = document.getElementById("project-settings-form");
    if (!form) return;

    form.onsubmit = async (event) => {
        event.preventDefault();

        if (!currentProject?.id) return;

        setSubmitting(true);

        try {
            const name = getProjectNameInputValue();
            const description =
            document.getElementById("project-settings-description")?.value.trim() || "";
            const visibility =
            document.querySelector('input[name="project-settings-visibility"]:checked')?.value ||
            "public";

            if (!name) {
                await showInfo({
                    type: "error",
                    message: "Project name is required."
                });
                setSubmitting(false);
                return;
            }

            let avatarUrl = currentProject.avatar_url ?? null;

            if (selectedAvatarFile) {
                avatarUrl = await uploadProjectAvatar(currentProject.id, selectedAvatarFile);
            }

            const { error } = await supabase
                .from("projects")
                .update({
                name,
                description: description || null,
                visibility,
                avatar_url: avatarUrl
            })
                .eq("id", currentProject.id);

            if (error) {
                throw error;
            }

            currentProject = {
                ...currentProject,
                name,
                description,
                visibility,
                avatar_url: avatarUrl
            };

            window.dispatchEvent(
                new CustomEvent("project-updated", {
                    detail: {
                        name,
                        description,
                        visibility,
                        avatar_url: avatarUrl
                    }
                })
            );

            await showInfo({
                type: "success",
                message: "Project updated successfully."
            });
        } catch (error) {
            console.error("Project update failed:", error);
            await showInfo({
                type: "error",
                message: error?.message || "Failed to update project."
            });
        } finally {
            setSubmitting(false);
        }
    };
}

async function uploadProjectAvatar(projectId, file) {
    const extension = file.name.includes(".")
    ? file.name.split(".").pop().toLowerCase()
    : "jpg";

    const filePath = `${projectId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase
        .storage
        .from(PROJECT_AVATAR_BUCKET)
        .upload(filePath, file, {
        upsert: true
    });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase
        .storage
        .from(PROJECT_AVATAR_BUCKET)
        .getPublicUrl(filePath);

    return data?.publicUrl ?? null;
}

/* =========================
   DELETE
========================= */

function setupDeleteButton() {
    const button = document.getElementById("project-settings-delete-btn");
    if (!button) return;

    button.onclick = async () => {
        if (!currentProject?.id) return;

        const confirmed = window.confirm(
            `Delete project "${currentProject.name}"? This cannot be undone.`
        );

        if (!confirmed) return;

        button.disabled = true;

        try {
            const { error } = await supabase
                .from("projects")
                .delete()
                .eq("id", currentProject.id);

            if (error) {
                throw error;
            }

            loadView("basic");
        } catch (error) {
            console.error("Project delete failed:", error);
            await showInfo({
                type: "error",
                message: error?.message || "Failed to delete project."
            });
            button.disabled = false;
        }
    };
}

/* =========================
   HELPERS
========================= */

function getProjectNameInputValue() {
    return document.getElementById("project-settings-name")?.value.trim() || "";
}

function setSubmitting(isSubmitting) {
    const submitBtn = document.getElementById("project-settings-submit-btn");
    const deleteBtn = document.getElementById("project-settings-delete-btn");
    const avatarInput = document.getElementById("project-settings-avatar-input");

    if (submitBtn) {
        submitBtn.disabled = isSubmitting;
        submitBtn.textContent = isSubmitting ? "Saving..." : "Αποθήκευση";
    }

    if (deleteBtn) {
        deleteBtn.disabled = isSubmitting;
    }

    if (avatarInput) {
        avatarInput.disabled = isSubmitting;
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