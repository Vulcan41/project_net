import { supabase } from "../../core/supabase.js";
import { userStore } from "../../state/userStore.js";
import { loadView } from "../../core/router.js";
import { DEFAULT_AVATAR, DEFAULT_FULLNAME, DEFAULT_USERNAME, DEFAULT_BIO } from "../../state/userStore.js";


export function initProfile() {

    loadProfile();
    setupEditButton();

}

/* =========================
   LOAD PROFILE DATA
========================= */

function loadProfile() {

    const profile = userStore.getProfile();
    if (!profile) return;

    const avatar = document.getElementById("profile-avatar");

    avatar.src =
    profile.avatar_url && profile.avatar_url.trim() !== ""
    ? profile.avatar_url
    : DEFAULT_AVATAR;

    avatar.onerror = () => {
        avatar.src = DEFAULT_AVATAR;
    };

    document.getElementById("profile-fullname").textContent =
    profile.full_name ?? DEFAULT_FULLNAME;

    document.getElementById("profile-username").textContent =
    "@" + (profile.username ?? DEFAULT_USERNAME);

    document.getElementById("profile-bio").textContent =
    profile.bio ?? DEFAULT_BIO;

}

/* =========================
   EDIT PROFILE
========================= */

function setupEditButton() {

    const btn = document.getElementById("profile-edit-btn");

    btn?.addEventListener("click", () => {

        loadView("profileEdit");

    });

}
