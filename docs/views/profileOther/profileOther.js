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
    setupFriendButton(userId);

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

/* =========================
   ADD FRIEND BUTTON
========================= */

async function setupFriendButton(viewedUserId) {

    const btn = document.getElementById("add-friend-btn");
    if (!btn) return;

    btn.addEventListener("click", async () => {

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            alert("Not logged in");
            return;
        }

        const requesterId = user.id;
        const receiverId = viewedUserId;

        const { error } = await supabase
            .from("friendships")
            .insert({
            requester_id: requesterId,
            receiver_id: receiverId,
            status: "pending"
        });

        if (error) {
            console.error("Friend request failed:", error);
            alert("Friend request failed");
            return;
        }

        btn.textContent = "Αίτημα στάλθηκε";
        btn.disabled = true;

    });

}