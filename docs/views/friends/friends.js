import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";

function formatRelativeTime(dateString) {

    const now = new Date();
    const past = new Date(dateString);

    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return "μόλις τώρα";

    const minutes = Math.floor(diff / 60);
    if (minutes === 1) return "1 λεπτό πριν";
    if (minutes < 60) return `${minutes} λεπτά πριν`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 ώρα πριν";
    if (hours < 24) return `${hours} ώρες πριν`;

    const days = Math.floor(hours / 24);
    if (days === 1) return "χθες";

    return `${days} ημέρες πριν`;

}

export async function initFriends() {

    setupTabs();

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
            created_at,
            profiles!friendships_requester_id_fkey(
                username,
                full_name,
                avatar_url
            )
        `)
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to load friend requests:", error);
        return;
    }

    const info = document.getElementById("requests-info");

    if (info) {

        const count = requests?.length || 0;

        if (count === 0) {
            info.textContent = "Δεν υπάρχουν αιτήματα σύνδεσης";
        }
        else if (count === 1) {
            info.textContent = "1 αίτημα σύνδεσης";
        }
        else {
            info.textContent = `${count} αιτήματα σύνδεσης`;
        }

    }

    container.innerHTML = "";

    if (!requests || requests.length === 0) return;

    requests.forEach(req => {

        const row = document.createElement("div");

        /* USER INFO */

        const userInfo = document.createElement("div");
        userInfo.className = "request-user";
        userInfo.style.cursor = "pointer";

        const avatar = document.createElement("img");
        avatar.className = "request-avatar";
        avatar.src = req.profiles?.avatar_url || "assets/avatar.png";

        const nameContainer = document.createElement("div");
        nameContainer.className = "request-name";

        const fullName = document.createElement("div");
        fullName.textContent =
        req.profiles?.full_name ||
        req.profiles?.username ||
        "User";

        const handle = document.createElement("div");
        handle.className = "request-handle";
        handle.textContent = "@" + (req.profiles?.username ?? "user");

        nameContainer.appendChild(fullName);
        nameContainer.appendChild(handle);

        userInfo.appendChild(avatar);
        userInfo.appendChild(nameContainer);

        /* TOOLTIP */

        const tooltip = document.createElement("div");
        tooltip.className = "request-tooltip";
        tooltip.textContent = "Προβολή προφίλ";

        userInfo.appendChild(tooltip);

        /* PROFILE CLICK */

        const openProfile = () => {
            loadView("profileOther", req.requester_id);
        };

        userInfo.addEventListener("click", openProfile);

        userInfo.addEventListener("mouseenter", () => {
            tooltip.classList.add("tooltip-visible");
        });

        userInfo.addEventListener("mouseleave", () => {
            tooltip.classList.remove("tooltip-visible");
        });

        /* DIVIDER */

        const divider = document.createElement("div");
        divider.className = "request-divider";

        /* SENTENCE */

        const text = document.createElement("div");
        text.className = "request-text";

        const timeString = formatRelativeTime(req.created_at);

        const displayName =
        req.profiles?.full_name ||
        req.profiles?.username ||
        "User";

        text.innerHTML =
        `Ο χρήστης <strong>${displayName}</strong> σας έστειλε αίτημα σύνδεσης
        <span class="request-time">
        <span class="request-dot">•</span>
        ${timeString}
        </span>`;

        /* BUTTONS */

        const acceptBtn = document.createElement("button");
        acceptBtn.textContent = "Αποδοχή";

        const declineBtn = document.createElement("button");
        declineBtn.textContent = "Απόρριψη";

        const actions = document.createElement("div");
        actions.className = "request-actions";

        actions.appendChild(acceptBtn);
        actions.appendChild(declineBtn);

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

        /* STRUCTURE */

        row.appendChild(userInfo);
        row.appendChild(divider);
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
            requester:requester_id(
                username,
                full_name,
                avatar_url
            ),
            receiver:receiver_id(
                username,
                full_name,
                avatar_url
            )
        `)
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) {
        console.error("Failed to load friends:", error);
        return;
    }

    const info = document.getElementById("friends-info");

    if (info) {

        const count = data?.length || 0;

        if (count === 0) {
            info.textContent = "Η λίστα επαφών σας είναι κενή";
        }
        else if (count === 1) {
            info.textContent = "1 επαφή";
        }
        else {
            info.textContent = `${count} επαφές`;
        }

    }

    container.innerHTML = "";

    if (!data || data.length === 0) return;

    data.forEach(friend => {

        const isRequester = friend.requester_id === userId;

        const profile = isRequester
        ? friend.receiver
        : friend.requester;

        const username = profile?.username;
        const fullName = profile?.full_name;
        const avatarUrl = profile?.avatar_url;

        const row = document.createElement("div");

        /* USER INFO */

        const userInfo = document.createElement("div");
        userInfo.className = "friend-user";

        const avatar = document.createElement("img");
        avatar.className = "friend-avatar";
        avatar.src = avatarUrl || "assets/avatar.png";

        const nameContainer = document.createElement("div");
        nameContainer.className = "friend-name";

        const name = document.createElement("div");
        name.textContent = fullName || username || "User";

        const handle = document.createElement("div");
        handle.className = "friend-handle";
        handle.textContent = "@" + (username ?? "user");

        nameContainer.appendChild(name);
        nameContainer.appendChild(handle);

        userInfo.appendChild(avatar);
        userInfo.appendChild(nameContainer);

        /* REMOVE BUTTON */

        const removeBtn = document.createElement("button");
        removeBtn.className = "friend-remove";
        removeBtn.textContent = "Αφαίρεση";

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

        /* STRUCTURE */

        row.appendChild(userInfo);
        row.appendChild(removeBtn);

        container.appendChild(row);

    });

}

/* =========================
   TAB SYSTEM
========================= */

function setupTabs() {

    const tabRequests = document.getElementById("tab-requests");
    const tabFriends = document.getElementById("tab-friends");

    const requestsSection = document.getElementById("requests-section");
    const friendsSection = document.getElementById("friends-section");

    if (!tabRequests || !tabFriends) return;

    /* default state */

    tabFriends.classList.add("active");
    tabRequests.classList.remove("active");

    friendsSection.classList.remove("hidden");
    requestsSection.classList.add("hidden");

    tabFriends.addEventListener("click", () => {

        tabFriends.classList.add("active");
        tabRequests.classList.remove("active");

        friendsSection.classList.remove("hidden");
        requestsSection.classList.add("hidden");

    });

    tabRequests.addEventListener("click", () => {

        tabRequests.classList.add("active");
        tabFriends.classList.remove("active");

        requestsSection.classList.remove("hidden");
        friendsSection.classList.add("hidden");

    });

}

