import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";
import { initModal, openModal } from "../../components/modal.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";
import { showInfo } from "../../components/info.js";

let currentUserId = null;
let currentRequests = [];
let currentFriends = [];

let currentFriendSort = "alpha_asc";
let currentFriendSearch = "";
let selectedFriendIds = new Set();
let pendingRequestsExpanded = false;

export async function initFriends() {
    await initModal();

    const {
        data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    currentUserId = user.id;
    await loadFriendsView();
}

async function loadFriendsView() {
    const container = document.getElementById("friends-page-content");
    if (!container) return;

    container.innerHTML = `<div class="friend-empty">Loading friends...</div>`;

    await Promise.all([
        loadRequests(currentUserId),
        loadFriends(currentUserId)
    ]);

    renderFriendsView();
}

async function loadRequests(userId) {
    const { data: requests, error } = await supabase
        .from("friendships")
        .select(`
            id,
            requester_id,
            receiver_id,
            created_at,
            updated_at,
            profiles!friendships_requester_id_fkey(
                username,
                full_name,
                avatar_url
            )
        `)
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .order("updated_at", { ascending: false });

    if (error) {
        console.error("Failed to load friend requests:", error);
        currentRequests = [];
        return;
    }

    currentRequests = requests ?? [];
}

async function loadFriends(userId) {
    const { data, error } = await supabase
        .from("friendships")
        .select(`
            id,
            requester_id,
            receiver_id,
            created_at,
            updated_at,
            requester:requester_id(
                id,
                username,
                full_name,
                avatar_url
            ),
            receiver:receiver_id(
                id,
                username,
                full_name,
                avatar_url
            )
        `)
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) {
        console.error("Failed to load friends:", error);
        currentFriends = [];
        return;
    }

    const baseFriends = (data ?? [])
        .map((friend) => {
        const isRequester = friend.requester_id === userId;
        const profile = isRequester ? friend.receiver : friend.requester;

        if (!profile?.id) return null;

        return {
            friendship_id: friend.id,
            user_id: profile.id,
            username: profile.username ?? "user",
            full_name: profile.full_name || profile.username || "User",
            avatar_url: profile.avatar_url || DEFAULT_AVATAR,
            created_at: friend.created_at,
            updated_at: friend.updated_at
        };
    })
        .filter(Boolean);

    const enrichedFriends = await Promise.all(
        baseFriends.map(async (friend) => {
            const [mutualFriendsCount, mutualProjectsCount] = await Promise.all([
                getMutualFriendsCount(userId, friend.user_id),
                getMutualProjectsCount(userId, friend.user_id)
            ]);

            return {
                ...friend,
                mutual_friends_count: mutualFriendsCount,
                mutual_projects_count: mutualProjectsCount
            };
        })
    );

    currentFriends = enrichedFriends;
}

async function getMutualFriendsCount(currentUserId, friendId) {
    if (!currentUserId || !friendId) return 0;

    const [{ data: myFriends }, { data: theirFriends }] = await Promise.all([
        supabase
            .from("friendships")
            .select("requester_id, receiver_id")
            .eq("status", "accepted")
            .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`),

        supabase
            .from("friendships")
            .select("requester_id, receiver_id")
            .eq("status", "accepted")
            .or(`requester_id.eq.${friendId},receiver_id.eq.${friendId}`)
    ]);

    const myIds = (myFriends ?? []).map((f) =>
    f.requester_id === currentUserId ? f.receiver_id : f.requester_id
    );

    const theirIds = (theirFriends ?? []).map((f) =>
    f.requester_id === friendId ? f.receiver_id : f.requester_id
    );

    return myIds.filter((id) => theirIds.includes(id)).length;
}

async function getMutualProjectsCount(currentUserId, friendId) {
    if (!currentUserId || !friendId) return 0;

    const [{ data: myProjects }, { data: theirProjects }] = await Promise.all([
        supabase
            .from("project_members")
            .select("project_id")
            .eq("user_id", currentUserId)
            .eq("membership_status", "active"),

        supabase
            .from("project_members")
            .select("project_id")
            .eq("user_id", friendId)
            .eq("membership_status", "active")
    ]);

    const myProjectIds = (myProjects ?? []).map((p) => p.project_id);
    const theirProjectIds = (theirProjects ?? []).map((p) => p.project_id);

    return myProjectIds.filter((id) => theirProjectIds.includes(id)).length;
}

function renderFriendsView() {
    const container = document.getElementById("friends-page-content");
    if (!container) return;

    const requestsSection = `<div id="friend-requests-section"></div>`;

    const filteredFriends = getFilteredFriends();

    const friendsToolbar = `
        <div class="friends-toolbar">
            <div class="friends-toolbar-left">
                <div class="friends-group-title">
                    Friends (${filteredFriends.length})
                </div>

                <select id="friends-sort-select" class="friends-sort-select">
                    <option value="alpha_asc">A → Z</option>
                    <option value="alpha_desc">Z → A</option>
                    <option value="newest_desc">Newest first</option>
                    <option value="newest_asc">Newest last</option>
                </select>

                <input
                    id="friends-search-input"
                    class="friends-search-input"
                    type="text"
                    placeholder="Search friends..."
                    value="${escapeHtml(currentFriendSearch)}"
                />

                <button
                    id="friends-select-all-btn"
                    class="friends-toolbar-btn friends-toolbar-btn-secondary"
                    type="button"
                >
                    Select all
                </button>

                <button
                    id="friends-remove-selected-btn"
                    class="friends-toolbar-btn friends-toolbar-btn-danger"
                    type="button"
                    ${selectedFriendIds.size === 0 ? "disabled" : ""}
                >
                    Remove
                </button>
            </div>
        </div>
    `;

    const friendsSection = `
        <div class="friends-group">
            ${friendsToolbar}
            <div id="friends-active-list"></div>
        </div>
    `;

    container.innerHTML = requestsSection + friendsSection;

    if (currentRequests.length === 0) {
        container.classList.add("no-requests");
    } else {
        container.classList.remove("no-requests");
    }

    renderRequestsSection();
    renderFriendsList();
    setupFriendSort();
    setupFriendSearch();
    setupFriendBulkActions();
    updateFriendsToolbarState();
}

function renderRequestsSection() {
    const container = document.getElementById("friend-requests-section");
    if (!container) return;

    const pendingRequests = [...currentRequests];

    if (!pendingRequests.length) {
        container.innerHTML = "";
        return;
    }

    const visibleRequests =
    pendingRequestsExpanded || pendingRequests.length <= 3
    ? pendingRequests
    : pendingRequests.slice(0, 2);

    const toggleButton =
    pendingRequests.length > 3
    ? `
                <button
                    id="friend-requests-toggle-btn"
                    class="friends-group-toggle-btn"
                    type="button"
                >
                    ${pendingRequestsExpanded ? "Collapse" : "Show all"}
                </button>
            `
    : "";

    container.innerHTML = `
        <div class="friends-group">
            <div class="friends-group-header">
                <div class="friends-group-title">
                    Pending requests (${pendingRequests.length})
                </div>
                ${toggleButton}
            </div>

            <div class="friends-group-list">
                ${visibleRequests.map(renderRequestRow).join("")}
            </div>
        </div>
    `;

    bindRequestActions();
    bindRequestProfileLinks();
    bindRequestAvatarFallbacks();
    setupRequestsToggle();
}

function renderFriendsList() {
    const container = document.getElementById("friends-active-list");
    if (!container) return;

    const filteredFriends = getFilteredFriends();

    if (!currentFriends.length) {
        container.innerHTML = `
            <div class="friend-empty">
                Your friends list is empty.
            </div>
        `;
        updateFriendsToolbarState();
        return;
    }

    if (!filteredFriends.length) {
        container.innerHTML = `
            <div class="friend-empty">
                No matching friends found.
            </div>
        `;
        updateFriendsToolbarState();
        return;
    }

    container.innerHTML = `
        <div class="friends-active-layout">
            <div class="friends-active-checkboxes">
                ${filteredFriends.map((friend) => `
                    <div class="friend-row-checkbox">
                        <input
                            type="checkbox"
                            class="friend-select-checkbox"
                            data-user-id="${friend.user_id}"
                            ${selectedFriendIds.has(friend.user_id) ? "checked" : ""}
                        />
                    </div>
                `).join("")}
            </div>

            <div class="friends-active-box">
                ${filteredFriends.map(renderFriendInsideBox).join("")}
            </div>
        </div>
    `;

    bindFriendSelection();
    bindFriendProfileLinks();
    bindFriendAvatarFallbacks();
    updateFriendsToolbarState();
}

function renderRequestRow(req) {
    const username = req.profiles?.username ?? "user";
    const fullName = req.profiles?.full_name || username || "User";
    const avatarUrl = req.profiles?.avatar_url || DEFAULT_AVATAR;

    const requestTime = req.updated_at || req.created_at;
    const timeString = formatRelativeTime(requestTime);

    return `
        <div class="request-row">
            <div class="request-row-left">
                <div
                    class="request-profile-link"
                    data-user-id="${req.requester_id}"
                >
                    <div class="request-avatar">
                        <img
                            src="${escapeHtml(avatarUrl)}"
                            alt="${escapeHtml(username)} avatar"
                            class="request-avatar-image"
                        />
                    </div>

                    <div class="request-info">
                        <div class="request-name">${escapeHtml(fullName)}</div>
                        <div class="request-username">@${escapeHtml(username)}</div>
                    </div>

                    <div class="request-tooltip">Προβολή προφίλ</div>
                </div>

                <div class="request-divider-vertical"></div>

                <div class="request-meta">
                    sent you a friend request
                    <span class="request-time">
                        <span class="request-dot">•</span>${escapeHtml(timeString)}
                    </span>
                </div>
            </div>

            <div class="request-row-right">
                <button
                    class="request-action-btn request-accept-btn"
                    type="button"
                    data-request-id="${req.id}"
                    data-action="accept"
                >
                    Accept
                </button>

                <button
                    class="request-action-btn request-reject-btn"
                    type="button"
                    data-request-id="${req.id}"
                    data-action="reject"
                >
                    Reject
                </button>
            </div>
        </div>
    `;
}

function renderFriendInsideBox(friend) {
    const mutualFriendsText =
    friend.mutual_friends_count === 1
    ? "1 mutual friend"
    : `${friend.mutual_friends_count ?? 0} mutual friends`;

    const mutualProjectsText =
    friend.mutual_projects_count === 1
    ? "1 mutual project"
    : `${friend.mutual_projects_count ?? 0} mutual projects`;

    return `
        <div class="friend-row friend-row-inside-box">
            <div
                class="friend-row-left friend-profile-link"
                data-user-id="${friend.user_id}"
            >
                <div class="friend-avatar">
                    <img
                        src="${escapeHtml(friend.avatar_url)}"
                        alt="${escapeHtml(friend.username)} avatar"
                        class="friend-avatar-image"
                    />
                </div>

                <div class="friend-info">
                    <div class="friend-name">${escapeHtml(friend.full_name)}</div>
                    <div class="friend-username">@${escapeHtml(friend.username)}</div>
                </div>

                <div class="friend-tooltip">Προβολή προφίλ</div>
            </div>

            <div class="friend-row-right">
                <span class="friend-pill">
                    ${escapeHtml(mutualFriendsText)}
                </span>

                <span class="friend-pill">
                    ${escapeHtml(mutualProjectsText)}
                </span>
            </div>
        </div>
    `;
}

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

function getFilteredFriends() {
    return sortFriends(
        currentFriends.filter((friend) => {
            const search = currentFriendSearch.trim().toLowerCase();
            if (!search) return true;

            const fullName = (friend.full_name || "").toLowerCase();
            const username = (friend.username || "").toLowerCase();

            return fullName.includes(search) || username.includes(search);
        })
    );
}

function sortFriends(list) {
    const sorted = [...list];

    switch (currentFriendSort) {
        case "newest_desc":
            return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        case "newest_asc":
            return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        case "alpha_desc":
            return sorted.sort((a, b) =>
            (b.full_name || b.username || "").toLowerCase()
                .localeCompare((a.full_name || a.username || "").toLowerCase())
            );

        case "alpha_asc":
        default:
            return sorted.sort((a, b) =>
            (a.full_name || a.username || "").toLowerCase()
                .localeCompare((b.full_name || b.username || "").toLowerCase())
            );
    }
}

function setupRequestsToggle() {
    const button = document.getElementById("friend-requests-toggle-btn");
    if (!button) return;

    button.onclick = () => {
        pendingRequestsExpanded = !pendingRequestsExpanded;
        renderRequestsSection();
    };
}

function setupFriendSort() {
    const select = document.getElementById("friends-sort-select");
    if (!select) return;

    select.value = currentFriendSort;

    select.onchange = () => {
        currentFriendSort = select.value;
        renderFriendsList();
    };
}

function setupFriendSearch() {
    const input = document.getElementById("friends-search-input");
    if (!input) return;

    input.value = currentFriendSearch;

    input.oninput = () => {
        currentFriendSearch = input.value;
        renderFriendsView();

        const newInput = document.getElementById("friends-search-input");
        if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(
                currentFriendSearch.length,
                currentFriendSearch.length
            );
        }
    };
}

function bindRequestActions() {
    const buttons = document.querySelectorAll(".request-action-btn");

    buttons.forEach((button) => {
        button.onclick = async () => {
            const requestId = button.dataset.requestId;
            const action = button.dataset.action;
            if (!requestId || !action) return;

            if (action === "accept") {
                const { error } = await supabase
                    .from("friendships")
                    .update({ status: "accepted" })
                    .eq("id", requestId);

                if (error) {
                    console.error("Accept request failed:", error);
                    await showInfo({
                        type: "error",
                        message: "Failed to accept friend request."
                    });
                    return;
                }

                await showInfo({
                    type: "success",
                    message: "Friend request accepted."
                });
            }

            if (action === "reject") {
                const { error } = await supabase
                    .from("friendships")
                    .delete()
                    .eq("id", requestId);

                if (error) {
                    console.error("Reject request failed:", error);
                    await showInfo({
                        type: "error",
                        message: "Failed to reject friend request."
                    });
                    return;
                }

                await showInfo({
                    type: "success",
                    message: "Friend request rejected."
                });
            }

            await loadFriendsView();
        };
    });
}

function bindFriendSelection() {
    const checkboxes = document.querySelectorAll(".friend-select-checkbox");

    checkboxes.forEach((checkbox) => {
        checkbox.onchange = () => {
            const userId = checkbox.dataset.userId;
            if (!userId) return;

            if (checkbox.checked) {
                selectedFriendIds.add(userId);
            } else {
                selectedFriendIds.delete(userId);
            }

            updateFriendsToolbarState();
        };
    });
}

function updateFriendsToolbarState() {
    const removeBtn = document.getElementById("friends-remove-selected-btn");
    const selectAllBtn = document.getElementById("friends-select-all-btn");

    if (removeBtn) {
        removeBtn.disabled = selectedFriendIds.size === 0;
    }

    if (selectAllBtn) {
        const visibleIds = getFilteredFriends().map((friend) => friend.user_id);

        const allVisibleSelected =
        visibleIds.length > 0 &&
        visibleIds.every((id) => selectedFriendIds.has(id));

        selectAllBtn.textContent = allVisibleSelected ? "Deselect all" : "Select all";
    }
}

function setupFriendBulkActions() {
    const selectAllBtn = document.getElementById("friends-select-all-btn");
    const removeBtn = document.getElementById("friends-remove-selected-btn");

    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            const visibleFriends = getFilteredFriends();
            const visibleIds = visibleFriends.map((friend) => friend.user_id);

            const allVisibleSelected =
            visibleIds.length > 0 &&
            visibleIds.every((id) => selectedFriendIds.has(id));

            if (allVisibleSelected) {
                visibleIds.forEach((id) => selectedFriendIds.delete(id));
            } else {
                visibleIds.forEach((id) => selectedFriendIds.add(id));
            }

            updateFriendsToolbarState();
            renderFriendsList();
        };
    }

    if (removeBtn) {
        removeBtn.onclick = async () => {
            if (selectedFriendIds.size === 0) return;

            openModal({
                message: `Είστε σίγουροι ότι θέλετε να αφαιρέσετε ${selectedFriendIds.size} επαφή${selectedFriendIds.size === 1 ? "" : "ές"};`,
                cancelText: "Ακύρωση",
                confirmText: "Αφαίρεση",
                onConfirm: async () => {
                    const selectedIds = [...selectedFriendIds];

                    const friendshipsToRemove = currentFriends.filter((friend) =>
                    selectedIds.includes(friend.user_id)
                    );

                    let failed = false;

                    for (const friend of friendshipsToRemove) {
                        const { error } = await supabase
                            .from("friendships")
                            .update({ status: "removed" })
                            .eq("id", friend.friendship_id);

                        if (error) {
                            console.error("Remove friend failed:", error);
                            failed = true;
                        }
                    }

                    if (failed) {
                        await showInfo({
                            type: "error",
                            message: "Some friends could not be removed."
                        });
                    } else {
                        await showInfo({
                            type: "success",
                            message: friendshipsToRemove.length === 1
                            ? "Friend removed successfully."
                            : "Selected friends removed successfully."
                        });
                    }

                    selectedFriendIds.clear();
                    await loadFriendsView();
                }
            });
        };
    }

    updateFriendsToolbarState();
}

function bindRequestProfileLinks() {
    const profileLinks = document.querySelectorAll(".request-profile-link");

    profileLinks.forEach((el) => {
        el.addEventListener("click", () => {
            const userId = el.dataset.userId;
            if (!userId) return;
            loadView("profileOther", userId);
        });

        el.addEventListener("mouseenter", () => {
            const tooltip = el.querySelector(".request-tooltip");
            tooltip?.classList.add("tooltip-visible");
        });

        el.addEventListener("mouseleave", () => {
            const tooltip = el.querySelector(".request-tooltip");
            tooltip?.classList.remove("tooltip-visible");
        });
    });
}

function bindFriendProfileLinks() {
    const profileLinks = document.querySelectorAll(".friend-profile-link");

    profileLinks.forEach((el) => {
        el.addEventListener("click", () => {
            const userId = el.dataset.userId;
            if (!userId) return;
            loadView("profileOther", userId);
        });

        el.addEventListener("mouseenter", () => {
            const tooltip = el.querySelector(".friend-tooltip");
            tooltip?.classList.add("tooltip-visible");
        });

        el.addEventListener("mouseleave", () => {
            const tooltip = el.querySelector(".friend-tooltip");
            tooltip?.classList.remove("tooltip-visible");
        });
    });
}

function bindRequestAvatarFallbacks() {
    const images = document.querySelectorAll(".request-avatar-image");

    images.forEach((img) => {
        img.onerror = () => {
            img.src = DEFAULT_AVATAR;
        };
    });
}

function bindFriendAvatarFallbacks() {
    const images = document.querySelectorAll(".friend-avatar-image");

    images.forEach((img) => {
        img.onerror = () => {
            img.src = DEFAULT_AVATAR;
        };
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}