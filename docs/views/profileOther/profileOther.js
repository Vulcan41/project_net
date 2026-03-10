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
    await loadFriendCount(userId);

    const friendship = await checkFriendship(userId);

    setupFriendButton(userId, friendship);

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
   LOAD FRIEND COUNT
========================= */

async function loadFriendCount(userId) {

    const { count, error } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) {
        console.error("Failed to load friend count:", error);
        return;
    }

    const el = document.getElementById("profile-friends-count");

    if (el) {
        el.textContent = count ?? 0;
    }

}

/* =========================
   ADD FRIEND BUTTON
========================= */

async function setupFriendButton(viewedUserId, friendship) {

    const btn = document.getElementById("add-friend-btn");
    if (!btn) return;

    if (friendship) {

        if (friendship.status === "pending") {

            btn.textContent = "Friend Request Sent";
            btn.disabled = true;
            btn.style.opacity = "0.6";
            btn.style.cursor = "default";

        }

        if (friendship.status === "accepted") {

            btn.textContent = "Friends";
            btn.disabled = true;
            btn.style.opacity = "0.6";
            btn.style.cursor = "default";

        }

        return;

    }

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

/* =========================
   CHECK FRIEND STATUS
========================= */

async function checkFriendship(viewedUserId) {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    /* check if YOU sent request */

    const { data: sent } = await supabase
        .from("friendships")
        .select("*")
        .eq("requester_id", user.id)
        .eq("receiver_id", viewedUserId)
        .maybeSingle();

    if (sent) return sent;

    /* check if THEY sent request */

    const { data: received } = await supabase
        .from("friendships")
        .select("*")
        .eq("requester_id", viewedUserId)
        .eq("receiver_id", user.id)
        .maybeSingle();

    if (received) return received;

    return null;

}