import { supabase } from "../../core/supabase.js";
import { userStore } from "../../state/userStore.js";
import { loadView } from "../../core/router.js";

export function initProfileEdit() {

    loadProfile();
    setupAvatarPreview();
    setupCancel();
    setupSave();

}

/* =========================
   LOAD EXISTING DATA
========================= */

function loadProfile() {

    const profile = userStore.getProfile();
    if (!profile) return;

    const fullname = document.getElementById("edit-fullname");
    const username = document.getElementById("edit-username");
    const bio = document.getElementById("edit-bio");

    const preview = document.getElementById("edit-avatar-preview");

    if (fullname) fullname.value = profile.full_name ?? "";
    if (username) username.value = profile.username ?? "";
    if (bio) bio.value = profile.bio ?? "";

    if (preview) {
        preview.src = profile.avatar_url || "assets/user_icon_2.jpg";
    }

}

/* =========================
   AVATAR PREVIEW
========================= */

function setupAvatarPreview() {

    const input = document.getElementById("edit-avatar-input");
    const preview = document.getElementById("edit-avatar-preview");

    if (!input || !preview) return;

    input.addEventListener("change", () => {

        const file = input.files[0];
        if (!file) return;

        preview.src = URL.createObjectURL(file);

    });

}

/* =========================
   CANCEL EDIT
========================= */

function setupCancel() {

    const btn = document.getElementById("cancel-edit");

    btn?.addEventListener("click", () => {
        loadView("profile");
    });

}

/* =========================
   SAVE PROFILE
========================= */

function setupSave() {

    const btn = document.getElementById("save-edit");

    btn?.addEventListener("click", async () => {

        const user = userStore.getUser();
        if (!user) return;

        const full_name =
        document.getElementById("edit-fullname")?.value ?? "";

        const username =
        document.getElementById("edit-username")?.value ?? "";

        const bio =
        document.getElementById("edit-bio")?.value ?? "";

        let avatarUrl = userStore.getProfile()?.avatar_url ?? null;

        const fileInput = document.getElementById("edit-avatar-input");
        const file = fileInput?.files?.[0];

        /* ---------- upload avatar ---------- */

        if (file) {

            const filePath = `${user.id}/${Date.now()}_${file.name}`;

            const { error: uploadError } = await supabase
                .storage
                .from("avatars")
                .upload(filePath, file);

            if (uploadError) {
                console.error("Upload failed:", uploadError);
                alert("Avatar upload failed");
                return;
            }

            const { data } = supabase
                .storage
                .from("avatars")
                .getPublicUrl(filePath);

            avatarUrl = data.publicUrl;

        }

        /* ---------- update profile ---------- */

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
            alert("Σφάλμα αποθήκευσης");

            return;

        }

        /* refresh store */

        await userStore.refreshProfile();

        /* go back to profile */

        loadView("profile");

    });

}