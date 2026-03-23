import { supabase } from "../../../core/supabase.js";
import { loadView } from "../../../core/router.js";
import { DEFAULT_AVATAR } from "../../../state/userStore.js";

let currentProject = null;
let currentMembers = [];
let currentUserId = null;

export async function initMembers(project) {
    if (!project?.id) {
        console.error("No project provided to members view.");
        return;
    }

    currentProject = project;

    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error("Failed to get current user:", userError);
        return;
    }

    currentUserId = user.id;

    await refreshMembersView();
}

async function refreshMembersView() {
    await loadMembers(currentProject.id);
    await loadInviteFriends(currentProject.id);
}

async function loadMembers(projectId) {
    const list = document.getElementById("members-list");
    if (!list) return;

    list.innerHTML = `<div class="member-empty">Loading members...</div>`;

    const { data, error } = await supabase
        .from("project_members")
        .select(`
            id,
            user_id,
            role,
            membership_status,
            membership_source,
            created_at,
            profiles (
                id,
                username,
                full_name,
                avatar_url
            )
        `)
        .eq("project_id", projectId)
        .in("membership_status", ["active", "pending"])
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error loading project members:", error);
        list.innerHTML = `
            <div class="member-empty">
                Failed to load members: ${escapeHtml(error.message)}
            </div>
        `;
        return;
    }

    currentMembers = data ?? [];

    if (!currentMembers.length) {
        list.innerHTML = `
            <div class="member-empty">
                No members found.
            </div>
        `;
        return;
    }

    const pendingRequests = currentMembers.filter(
        (member) =>
        member.membership_status === "pending" &&
        member.membership_source === "request"
    );

    const pendingInvites = currentMembers.filter(
        (member) =>
        member.membership_status === "pending" &&
        member.membership_source === "invite"
    );

    const activeMembers = currentMembers.filter(
        (member) => member.membership_status === "active"
    );

    const pendingRequestsSection = pendingRequests.length
    ? `
            <div class="members-group">
                <div class="members-group-title">Pending requests</div>
                <div class="members-group-list">
                    ${pendingRequests.map((member) => renderMemberRow(member, "request")).join("")}
                </div>
            </div>
        `
    : "";

    const pendingInvitesSection = pendingInvites.length
    ? `
            <div class="members-group">
                <div class="members-group-title">Pending invites</div>
                <div class="members-group-list">
                    ${pendingInvites.map((member) => renderMemberRow(member, "invite")).join("")}
                </div>
            </div>
        `
    : "";

    const activeMembersSection = `
        <div class="members-group">
            <div class="members-group-title">Members</div>
            <div class="members-group-list">
                ${activeMembers.map((member) => renderMemberRow(member, "active")).join("")}
            </div>
        </div>
    `;

    list.innerHTML =
    pendingRequestsSection +
    pendingInvitesSection +
    activeMembersSection;

    bindMemberActions(projectId);
    bindMemberAvatarFallbacks();
    bindMemberProfileLinks();
}

function renderMemberRow(member, sectionType) {
    const username = member.profiles?.username ?? "user";
    const fullName = member.profiles?.full_name || username || "Unknown user";
    const avatarUrl = member.profiles?.avatar_url?.trim() || DEFAULT_AVATAR;
    const isOwner = member.role === "owner";

    return `
        <div class="member-row" data-user-id="${member.user_id}">
            <div
                class="member-row-left member-profile-link"
                data-user-id="${member.user_id}"
            >
                <div class="member-avatar">
                    <img
                        src="${escapeHtml(avatarUrl)}"
                        alt="${escapeHtml(username)} avatar"
                        class="member-avatar-image"
                    />
                </div>

                <div class="member-info">
                    <div class="member-name">${escapeHtml(fullName)}</div>
                    <div class="member-username">@${escapeHtml(username)}</div>
                </div>

                <div class="member-tooltip">Προβολή προφίλ</div>
            </div>

            <div class="member-row-right">
                ${
                    sectionType === "active"
                        ? `
                            <span class="member-pill member-pill-role">
                                ${escapeHtml(member.role)}
                            </span>
                            <span class="member-pill member-pill-status">
                                active
                            </span>
                        `
                        : ""
                }

                ${
                    sectionType === "request"
                        ? `
                            <span class="member-pill member-pill-neutral">
                                request
                            </span>

                            <button
                                class="member-action-btn member-approve-btn"
                                type="button"
                                data-user-id="${member.user_id}"
                            >
                                Approve
                            </button>

                            <button
                                class="member-action-btn member-reject-btn"
                                type="button"
                                data-user-id="${member.user_id}"
                            >
                                Reject
                            </button>
                        `
                        : ""
                }

                ${
                    sectionType === "invite"
                        ? `
                            <span class="member-pill member-pill-neutral">
                                invite sent
                            </span>
                            ${
                                !isOwner
                                    ? `
                                        <span class="member-pill member-pill-status">
                                            pending
                                        </span>
                                    `
                                    : ""
                            }
                        `
                        : ""
                }
            </div>
        </div>
    `;
}

async function loadInviteFriends(projectId) {
    const container = document.getElementById("members-invite-list");
    if (!container) return;

    container.innerHTML = `<div class="member-invite-empty">Loading friends...</div>`;

    const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("requester_id, receiver_id, status")
        .eq("status", "accepted")
        .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    if (friendshipsError) {
        console.error("Failed to load friendships:", friendshipsError);
        container.innerHTML = `
            <div class="member-invite-empty">
                Failed to load friends.
            </div>
        `;
        return;
    }

    const friendIds = (friendships ?? [])
        .map((row) =>
    row.requester_id === currentUserId ? row.receiver_id : row.requester_id
    )
        .filter(Boolean);

    if (!friendIds.length) {
        container.innerHTML = `
            <div class="member-invite-empty">
                You have no accepted friends to invite yet.
            </div>
        `;
        return;
    }

    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", friendIds);

    if (profilesError) {
        console.error("Failed to load friend profiles:", profilesError);
        container.innerHTML = `
            <div class="member-invite-empty">
                Failed to load friend profiles.
            </div>
        `;
        return;
    }

    const membershipByUserId = new Map(
        currentMembers.map((member) => [member.user_id, member])
    );

    const inviteableProfiles = (profiles ?? []).filter((profile) => {
        return !membershipByUserId.has(profile.id);
    });

    const sortedProfiles = inviteableProfiles.sort((a, b) => {
        const aName = (a.full_name || a.username || "").toLowerCase();
        const bName = (b.full_name || b.username || "").toLowerCase();
        return aName.localeCompare(bName);
    });

    if (!sortedProfiles.length) {
        container.innerHTML = `
            <div class="member-invite-empty">
                No inviteable friends available.
            </div>
        `;
        return;
    }

    container.innerHTML = sortedProfiles
        .map((profile) => renderInviteFriendRow(profile))
        .join("");

    bindInviteFriendActions(projectId);
    bindMemberAvatarFallbacks();
    bindMemberProfileLinks();
}

function renderInviteFriendRow(profile) {
    const username = profile.username ?? "user";
    const fullName = profile.full_name || username || "Unknown user";
    const avatarUrl = profile.avatar_url?.trim() || DEFAULT_AVATAR;

    const rightMarkup = `
        <button
            class="member-invite-btn"
            type="button"
            data-user-id="${profile.id}"
        >
            Invite
        </button>
    `;

    return `
        <div class="member-invite-row">
            <div
                class="member-invite-row-left member-profile-link"
                data-user-id="${profile.id}"
            >
                <div class="member-avatar">
                    <img
                        src="${escapeHtml(avatarUrl)}"
                        alt="${escapeHtml(username)} avatar"
                        class="member-avatar-image"
                    />
                </div>

                <div class="member-info">
                    <div class="member-name">${escapeHtml(fullName)}</div>
                    <div class="member-username">@${escapeHtml(username)}</div>
                </div>

                <div class="member-tooltip">Προβολή προφίλ</div>
            </div>

            <div class="member-invite-row-right">
                ${rightMarkup}
            </div>
        </div>
    `;
}

function bindMemberActions(projectId) {
    const approveButtons = document.querySelectorAll(".member-approve-btn");
    const rejectButtons = document.querySelectorAll(".member-reject-btn");

    approveButtons.forEach((button) => {
        button.onclick = async () => {
            const userId = button.dataset.userId;
            if (!userId) return;

            clearFeedback();

            const { data, error } = await supabase.rpc("accept_project_request", {
                p_project_id: projectId,
                p_user_id: userId
            });

            if (error) {
                console.error("Accept request failed:", error);
                showError(error.message || "Failed to approve request.");
                return;
            }

            if (data === "accepted") {
                showSuccess("Request approved successfully.");
            }

            await refreshMembersView();
        };
    });

    rejectButtons.forEach((button) => {
        button.onclick = async () => {
            const userId = button.dataset.userId;
            if (!userId) return;

            clearFeedback();

            const { data, error } = await supabase.rpc("reject_project_request", {
                p_project_id: projectId,
                p_user_id: userId
            });

            if (error) {
                console.error("Reject request failed:", error);
                showError(error.message || "Failed to reject request.");
                return;
            }

            if (data === "rejected") {
                showSuccess("Request rejected.");
            }

            await refreshMembersView();
        };
    });
}

function bindInviteFriendActions(projectId) {
    const buttons = document.querySelectorAll(".member-invite-btn");

    buttons.forEach((button) => {
        button.onclick = async () => {
            const userId = button.dataset.userId;
            if (!userId) return;

            clearFeedback();
            button.disabled = true;
            button.textContent = "Inviting...";

            const { data, error } = await supabase.rpc("invite_user_to_project", {
                p_project_id: projectId,
                p_user_id: userId
            });

            if (error) {
                console.error("Invite failed:", error);
                showError(error.message || "Failed to send invite.");
                button.disabled = false;
                button.textContent = "Invite";
                return;
            }

            if (data === "invited") {
                showSuccess("Invite sent successfully.");
            } else if (data === "already_member") {
                showSuccess("This friend is already a member.");
            } else if (data === "already_invited") {
                showSuccess("This friend has already been invited.");
            } else if (data === "request_accepted_by_invite") {
                showSuccess("Friend had a pending request and is now an active member.");
            } else if (data === "not_friends") {
                showError("You can only invite accepted friends.");
            } else if (data === "cannot_invite_self") {
                showError("You cannot invite yourself.");
            }

            await refreshMembersView();
        };
    });
}

function bindMemberAvatarFallbacks() {
    const images = document.querySelectorAll(".member-avatar-image");

    images.forEach((img) => {
        img.onerror = () => {
            img.src = DEFAULT_AVATAR;
        };
    });
}

function bindMemberProfileLinks() {
    const profileLinks = document.querySelectorAll(".member-profile-link");

    profileLinks.forEach((el) => {
        el.addEventListener("click", async () => {
            const userId = el.dataset.userId;
            if (!userId) return;

            const {
                data: { user }
            } = await supabase.auth.getUser();

            if (user && user.id === userId) {
                loadView("profile");
            } else {
                loadView("profileOther", userId);
            }
        });

        el.addEventListener("mouseenter", () => {
            const tooltip = el.querySelector(".member-tooltip");
            tooltip?.classList.add("tooltip-visible");
        });

        el.addEventListener("mouseleave", () => {
            const tooltip = el.querySelector(".member-tooltip");
            tooltip?.classList.remove("tooltip-visible");
        });
    });
}

function showError(message) {
    const errorBox = document.getElementById("members-feedback-error");
    const successBox = document.getElementById("members-feedback-success");

    if (successBox) {
        successBox.textContent = "";
        successBox.classList.add("hidden");
    }

    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function showSuccess(message) {
    const errorBox = document.getElementById("members-feedback-error");
    const successBox = document.getElementById("members-feedback-success");

    if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
    }

    if (!successBox) return;

    successBox.textContent = message;
    successBox.classList.remove("hidden");
}

function clearFeedback() {
    const errorBox = document.getElementById("members-feedback-error");
    const successBox = document.getElementById("members-feedback-success");

    if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
    }

    if (successBox) {
        successBox.textContent = "";
        successBox.classList.add("hidden");
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}