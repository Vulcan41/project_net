import { supabase } from "../../core/supabase.js";

export async function initFriends() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const requestsContainer = document.getElementById("friend-requests");
    const friendsContainer = document.getElementById("friends-list");

    if (requestsContainer) requestsContainer.innerHTML = "";
    if (friendsContainer) friendsContainer.innerHTML = "";

    await loadRequests(user.id);
    await loadFriends(user.id);

}

/* =========================
   LOAD FRIEND REQUESTS
========================= */

async function loadRequests(userId) {

    const container = document.getElementById("friend-requests");
    if (!container) return;

    const { data: requests, error } = await supabase
        .from("friendships")
        .select(`
            id,
            requester_id,
            profiles!friendships_requester_id_fkey(username)
        `)
        .eq("receiver_id", userId)
        .eq("status", "pending");

    if (error) {
        console.error("Failed to load friend requests:", error);
        return;
    }

    container.innerHTML = "";

    if (!requests || requests.length === 0) {
        container.textContent = "No friend requests.";
        return;
    }

    requests.forEach(req => {

        const row = document.createElement("div");

        const text = document.createElement("span");
        text.textContent = `Ο χρήστης ${req.profiles?.username ?? "User"} σας έστειλε αίτημα σύνδεσης`;

        const acceptBtn = document.createElement("button");
        acceptBtn.textContent = "Αποδοχή";

        const declineBtn = document.createElement("button");
        declineBtn.textContent = "Απόρριψη";

        /* ACCEPT */

        acceptBtn.addEventListener("click", async () => {

            await supabase
                .from("friendships")
                .update({ status: "accepted" })
                .eq("id", req.id);

            await initFriends();

        });

        /* DECLINE */

        declineBtn.addEventListener("click", async () => {

            await supabase
                .from("friendships")
                .delete()
                .eq("id", req.id);

            await initFriends();

        });

        const actions = document.createElement("div");
        actions.className = "request-actions";

        actions.appendChild(acceptBtn);
        actions.appendChild(declineBtn);

        row.appendChild(text);
        row.appendChild(actions);

        container.appendChild(row);

    });

}

/* =========================
   LOAD FRIENDS LIST
========================= */

async function loadFriends(userId) {

    const container = document.getElementById("friends-list");
    if (!container) return;

    const { data, error } = await supabase
        .from("friendships")
        .select(`
            id,
            requester_id,
            receiver_id,
            requester:requester_id(username),
            receiver:receiver_id(username)
        `)
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) {
        console.error("Failed to load friends:", error);
        return;
    }

    container.innerHTML = "";

    if (!data || data.length === 0) {
        container.textContent = "No friends yet.";
        return;
    }

    data.forEach(friend => {

        const isRequester = friend.requester_id === userId;

        const username = isRequester
        ? friend.receiver?.username
        : friend.requester?.username;

        const row = document.createElement("div");

        const name = document.createElement("span");
        name.textContent = username ?? "User";

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";

        /* REMOVE FRIEND */

        removeBtn.addEventListener("click", async () => {

            const { error } = await supabase
                .from("friendships")
                .delete()
                .eq("id", friend.id);

            if (error) {
                console.error("Remove friend failed:", error);
                alert("Failed to remove friend");
                return;
            }

            await initFriends();

        });

        row.appendChild(name);
        row.appendChild(removeBtn);

        container.appendChild(row);

    });

}