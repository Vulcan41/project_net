import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";
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
    await loadMutualFriends(userId);

    const friendship = await checkFriendship(userId);

    setupFriendButton(userId, friendship);

    /* =========================
       MESSAGE BUTTON
    ========================= */

    const messageBtn = document.getElementById("message-user-btn");

    if (!messageBtn) {
        console.log("message button not found");
        return;
    }

    console.log("message button found");

    messageBtn.addEventListener("click", () => {

        console.log("Message button clicked");

        messageUser(userId);

    });

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
   LOAD MUTUAL FRIEND COUNT
========================= */

async function loadMutualFriends(viewedUserId) {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const currentUserId = user.id;

    /* get current user's friends */

    const { data: myFriends } = await supabase
        .from("friendships")
        .select("requester_id, receiver_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    if (!myFriends) return;

    const myFriendIds = myFriends.map(f =>
    f.requester_id === currentUserId ? f.receiver_id : f.requester_id
    );

    /* get viewed user's friends */

    const { data: theirFriends } = await supabase
        .from("friendships")
        .select("requester_id, receiver_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${viewedUserId},receiver_id.eq.${viewedUserId}`);

    if (!theirFriends) return;

    const theirFriendIds = theirFriends.map(f =>
    f.requester_id === viewedUserId ? f.receiver_id : f.requester_id
    );

    /* find intersection */

    const mutual = myFriendIds.filter(id => theirFriendIds.includes(id));

    const el = document.getElementById("profile-mutual-friends");

    if (el) {
        const count = mutual.length;

        if (count === 0) {
            el.textContent = "καμία κοινή επαφή";
        } else if (count === 1) {
            el.textContent = "1 κοινή επαφή";
        } else {
            el.textContent = `${count} κοινές επαφές`;
        }
    }

}

/* =========================
   ADD FRIEND BUTTON
========================= */

async function setupFriendButton(viewedUserId, friendship) {

    const btn = document.getElementById("add-friend-btn");
    if (!btn) return;

    btn.classList.remove("pending", "accepted");

    if (friendship) {

        if (friendship.status === "pending") {

            btn.textContent = "Αναμονή Επιβεβαίωσης";
            btn.classList.add("pending");

            btn.disabled = true;
            return;

        }

        if (friendship.status === "accepted") {

            btn.textContent = "Ανήκει στις επαφές σας";
            btn.classList.add("accepted");

            btn.disabled = true;
            return;

        }

    }

    /* NOT FRIENDS */

    btn.textContent = "Προσθήκη Φίλου";

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
        btn.classList.add("pending");
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

async function messageUser(targetUserId) {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const currentUserId = user.id;

    /* =========================
       NORMALIZE USER ORDER
       (ensures A-B = B-A)
    ========================= */

    function normalizeUsers(a, b) {
        return a < b ? [a, b] : [b, a];
    }

    const [user1, user2] = normalizeUsers(currentUserId, targetUserId);

    /* =========================
       CHECK IF CONVERSATION EXISTS
    ========================= */

    const { data: existing, error: checkError } = await supabase
        .from("conversations")
        .select("id")
        .eq("user1_id", user1)
        .eq("user2_id", user2)
        .maybeSingle();

    if (checkError) {
        console.error("Conversation check failed:", checkError);
        return;
    }

    let conversationId;

    /* =========================
       CREATE IF NOT EXISTS
    ========================= */

    if (!existing) {

        const { data: newConv, error: insertError } = await supabase
            .from("conversations")
            .insert({
            user1_id: user1,
            user2_id: user2
        })
            .select()
            .single();

        if (insertError) {
            console.error("Conversation creation failed:", insertError);
            return;
        }

        conversationId = newConv.id;

    } else {

        conversationId = existing.id;

    }

    /* =========================
       OPEN MESSAGES VIEW
    ========================= */

    loadView("messages", conversationId);

}