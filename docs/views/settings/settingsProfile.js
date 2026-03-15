import { supabase } from "../../core/supabase.js";
import { userStore } from "../../state/userStore.js";
import { showInfo } from "../../components/info.js";
import {
DEFAULT_AVATAR,
DEFAULT_FULLNAME,
DEFAULT_USERNAME,
DEFAULT_BIO
} from "../../state/userStore.js";

export function initSettingsProfilePanel() {
    loadProfileToSettings();
    setupAvatarPreviewInSettings();
    setupCancelInSettings();
    setupSaveInSettings();
}

/* =========================
   LOAD EXISTING DATA
========================= */

function loadProfileToSettings() {
    const profile = userStore.getProfile();
    if (!profile) return;

    const fullname = document.getElementById("edit-fullname");
    const username = document.getElementById("edit-username");
    const bio = document.getElementById("edit-bio");
    const preview = document.getElementById("edit-avatar-preview");

    if (fullname) fullname.value = profile.full_name ?? DEFAULT_FULLNAME;
    if (username) username.value = profile.username ?? DEFAULT_USERNAME;
    if (bio) bio.value = profile.bio ?? DEFAULT_BIO;

    if (preview) {
        preview.src = profile.avatar_url || DEFAULT_AVATAR;
        preview.onerror = () => {
            preview.src = DEFAULT_AVATAR;
        };
    }
}

/* =========================
   AVATAR PREVIEW
========================= */

function setupAvatarPreviewInSettings() {
    const input = document.getElementById("edit-avatar-input");
    const preview = document.getElementById("edit-avatar-preview");

    if (!input || !preview) return;

    input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;

        preview.src = URL.createObjectURL(file);
    };
}

/* =========================
   CANCEL
========================= */

function setupCancelInSettings() {
    const btn = document.getElementById("cancel-edit");
    if (!btn) return;

    btn.onclick = () => {
        loadProfileToSettings();

        const fileInput = document.getElementById("edit-avatar-input");
        if (fileInput) {
            fileInput.value = "";
        }
    };
}

/* =========================
   SAVE
========================= */

function setupSaveInSettings() {
    const btn = document.getElementById("save-edit");
    if (!btn) return;

    btn.onclick = async () => {
        const user = userStore.getUser();
        if (!user) return;

        const full_name =
        document.getElementById("edit-fullname")?.value ?? DEFAULT_FULLNAME;

        const username =
        document.getElementById("edit-username")?.value ?? DEFAULT_USERNAME;

        const bio =
        document.getElementById("edit-bio")?.value ?? DEFAULT_BIO;

        let avatarUrl = userStore.getProfile()?.avatar_url ?? null;

        const fileInput = document.getElementById("edit-avatar-input");
        const file = fileInput?.files?.[0];

        /* upload avatar */

        if (file) {
            const filePath = `${user.id}/${Date.now()}_${file.name}`;

            const { error: uploadError } = await supabase
                .storage
                .from("avatars")
                .upload(filePath, file);

            if (uploadError) {
                console.error("Upload failed:", uploadError);
                showInfo({
                    message: "Η μεταφόρτωση της εικόνας απέτυχε",
                    type: "error"
                });
                return;
            }

            const { data } = supabase
                .storage
                .from("avatars")
                .getPublicUrl(filePath);

            avatarUrl = data.publicUrl;
        }

        /* update profile */

        const { error } = await supabase
            .from("profiles")
            .update({
            full_name,
            username,
            bio,
            avatar_url: avatarUrl
        })
            .eq("id", user.id);

        if (error) {
            console.error("Profile update failed:", error);
            showInfo({
                message: "Σφάλμα αποθήκευσης",
                type: "error"
            });
            return;
        }

        /* refresh store */

        await userStore.refreshProfile();

        /* update header UI */

        const headerAvatar = document.querySelector("#user-btn img");
        if (headerAvatar && avatarUrl) {
            headerAvatar.src = avatarUrl;
        }

        const headerUsername = document.getElementById("user-name");
        if (headerUsername) {
            headerUsername.textContent = username || full_name || DEFAULT_USERNAME;
        }

        showInfo({
            message: "Οι αλλαγές αποθηκεύτηκαν",
            type: "success"
        });
    };
}