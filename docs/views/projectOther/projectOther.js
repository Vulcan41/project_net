import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";

export async function initProjectOther(projectId) {
    setupBackButton();

    if (!projectId) {
        showError("Δεν βρέθηκε project id.");
        return;
    }

    await loadProject(projectId);
}

function setupBackButton() {
    const backBtn = document.getElementById("project-other-back-btn");
    if (!backBtn) return;

    backBtn.onclick = () => {
        loadView("basic");
    };
}

async function loadProject(projectId) {
    const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, visibility, status, owner_id, created_at, avatar_url")
        .eq("id", projectId)
        .single();

    if (error) {
        console.error("Error loading projectOther:", error);
        showError("Αποτυχία φόρτωσης project.");
        return;
    }

    if (!data) {
        showError("Το project δεν βρέθηκε.");
        return;
    }

    await renderProject(data);
    await renderFriendMembersPreview(data.id);
    await setupRequestButton(data.id, data.visibility);
}

async function renderProject(project) {
    const title = document.getElementById("project-other-title");
    const description = document.getElementById("project-other-description");
    const meta = document.getElementById("project-other-meta");
    const avatar = document.getElementById("project-other-avatar");

    const ownerBlock = document.getElementById("project-other-owner-block");
    const ownerName = document.getElementById("project-other-owner-name");
    const ownerUsername = document.getElementById("project-other-owner-username");
    const ownerAvatar = document.getElementById("project-other-owner-avatar");

    if (title) {
        title.textContent = project.name ?? "Untitled project";
    }

    if (description) {
        description.textContent = project.description || "Χωρίς περιγραφή.";
    }

    if (avatar) {
        avatar.innerHTML = project.avatar_url
        ? `<img src="${escapeHtml(project.avatar_url)}" alt="${escapeHtml(project.name || "Project")} avatar" />`
        : `<span class="project-other-avatar-fallback">${escapeHtml((project.name || "P").charAt(0).toUpperCase())}</span>`;
    }

    if (project.owner_id && ownerName && ownerUsername && ownerAvatar) {
        const { data: ownerProfile, error: ownerError } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", project.owner_id)
            .single();

        if (ownerError) {
            console.error("Owner load error:", ownerError);
            ownerName.textContent = "Unknown user";
            ownerUsername.textContent = "@unknown";
            ownerAvatar.src = "assets/avatar.png";
        } else {
            ownerName.textContent =
            ownerProfile.full_name || ownerProfile.username || "User";

            ownerUsername.textContent =
            "@" + (ownerProfile.username || "user");

            ownerAvatar.src =
            ownerProfile.avatar_url || "assets/avatar.png";
        }

        if (ownerBlock) {
            ownerBlock.onclick = () => {
                loadView("profileOther", project.owner_id);
            };
        }
    }

    if (meta) {
        meta.classList.remove("hidden");
    }
}

async function renderFriendMembersPreview(projectId) {
    const wrapper = document.getElementById("project-other-friends-members");
    const avatarsEl = document.getElementById("project-other-friends-members-avatars");
    const textEl = document.getElementById("project-other-friends-members-text");
    const divider = document.getElementById("project-other-friends-divider");

    if (!wrapper || !avatarsEl || !textEl) return;

    const {
        data: { user }
    } = await supabase.auth.getUser();

    const hidePreview = () => {
        wrapper.classList.add("hidden");
        if (divider) divider.classList.add("hidden");
    };

    if (!user) {
        hidePreview();
        return;
    }

    const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select(`
            requester_id,
            receiver_id,
            status
        `)
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (friendshipsError) {
        console.error("Failed to load friendships:", friendshipsError);
        hidePreview();
        return;
    }

    const friendIds = (friendships ?? [])
        .map((row) => row.requester_id === user.id ? row.receiver_id : row.requester_id)
        .filter(Boolean);

    if (!friendIds.length) {
        hidePreview();
        return;
    }

    const { data: memberRows, error: membersError } = await supabase
        .from("project_members")
        .select(`
            user_id,
            profiles (
                username,
                full_name,
                avatar_url
            )
        `)
        .eq("project_id", projectId)
        .eq("membership_status", "active")
        .in("user_id", friendIds);

    if (membersError) {
        console.error("Failed to load project member friends:", membersError);
        hidePreview();
        return;
    }

    const friendMembers = memberRows ?? [];

    if (!friendMembers.length) {
        hidePreview();
        return;
    }

    const previewMembers = friendMembers.slice(0, 5);

    avatarsEl.innerHTML = previewMembers.map((member, index) => {
        const profile = member.profiles || {};
        const avatarUrl = profile.avatar_url?.trim();
        const fallbackLetter = escapeHtml(
            (profile.full_name || profile.username || "U").charAt(0).toUpperCase()
        );

        return `
            <div
                class="project-other-friend-member-avatar"
                style="z-index: ${previewMembers.length - index};"
                title="${escapeHtml(profile.full_name || profile.username || "User")}"
            >
                ${
                    avatarUrl
                        ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(profile.username || "member")} avatar" />`
                        : `<div class="project-other-friend-member-avatar-fallback">${fallbackLetter}</div>`
                }
            </div>
        `;
    }).join("");

    textEl.textContent = `${friendMembers.length} members including`;

    wrapper.classList.remove("hidden");
    if (divider) divider.classList.remove("hidden");
}

async function setupRequestButton(projectId, projectVisibility) {
    const button = document.getElementById("project-request-btn");
    const message = document.getElementById("project-request-message");

    if (!button || !message) return;

    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError) {
        console.error("Error getting user:", userError);
        button.disabled = true;
        message.textContent = "Αποτυχία φόρτωσης χρήστη.";
        message.classList.remove("hidden");
        return;
    }

    if (!user) {
        button.disabled = true;
        message.textContent = "Πρέπει να συνδεθείτε για να ζητήσετε συμμετοχή.";
        message.classList.remove("hidden");
        return;
    }

    if (projectVisibility !== "public") {
        button.disabled = true;
        button.textContent = "Private project";
        message.textContent = "Δεν μπορείτε να ζητήσετε συμμετοχή σε private project.";
        message.classList.remove("hidden");
        return;
    }

    button.disabled = false;
    button.textContent = "Request to join";
    message.classList.add("hidden");
    message.textContent = "";

    button.onclick = async () => {
        button.disabled = true;
        message.classList.add("hidden");
        message.textContent = "";

        const { data, error } = await supabase.rpc("request_to_join_project", {
            p_project_id: projectId
        });

        if (error) {
            console.error("Request to join failed:", error);
            button.disabled = false;
            message.textContent = error.message || "Αποτυχία αποστολής αιτήματος.";
            message.classList.remove("hidden");
            return;
        }

        if (data === "owner") {
            button.disabled = true;
            button.textContent = "Owner";
            message.textContent = "Είστε ο owner αυτού του project.";
            message.classList.remove("hidden");
            return;
        }

        if (data === "already_member") {
            button.disabled = true;
            button.textContent = "Already a member";
            message.textContent = "Είστε ήδη μέλος αυτού του project.";
            message.classList.remove("hidden");
            return;
        }

        if (data === "already_pending") {
            button.disabled = true;
            button.textContent = "Request pending";
            message.textContent = "Το αίτημά σας εκκρεμεί.";
            message.classList.remove("hidden");
            return;
        }

        if (data === "requested") {
            button.disabled = true;
            button.textContent = "Request pending";
            message.textContent = "Το αίτημά σας στάλθηκε.";
            message.classList.remove("hidden");
            return;
        }

        button.disabled = false;
        message.textContent = "Απρόβλεπτη απάντηση από τον server.";
        message.classList.remove("hidden");
    };
}

function showError(message) {
    const errorBox = document.getElementById("project-other-error");
    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}