import { supabase } from "../../core/supabase.js";
import { DEFAULT_AVATAR, DEFAULT_FULLNAME, DEFAULT_USERNAME, DEFAULT_BIO } from "../../state/userStore.js";

export async function initProfileOther(userId) {

    if (!userId) {
        console.error("profileOther loaded without userId");
        return;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (error) {
        console.error("Failed to load profile:", error);
        return;
    }

    renderProfile(profile);

}

/* =========================
   RENDER PROFILE
========================= */

function renderProfile(profile) {

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