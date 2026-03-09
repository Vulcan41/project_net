import { supabase } from "../../core/supabase.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";

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
    profile.full_name ?? "";

    document.getElementById("profile-username").textContent =
    "@" + (profile.username ?? "");

    document.getElementById("profile-bio").textContent =
    profile.bio ?? "";

}