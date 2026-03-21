import { supabase } from "../../../core/supabase.js";

let currentProject = null;

export async function initMembers(project) {
    if (!project?.id) {
        console.error("No project provided to members view.");
        return;
    }

    currentProject = project;
    await loadMembers(project.id);
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
            created_at,
            profiles (
                id,
                username
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

    if (!data || data.length === 0) {
        list.innerHTML = `
            <div class="member-empty">
                No members found.
            </div>
        `;
        return;
    }

    list.innerHTML = data
        .map((member) => {
        const username = member.profiles?.username ?? "Unknown user";
        const isPending = member.membership_status === "pending";
        const isOwner = member.role === "owner";
        const canRemove = member.membership_status === "active" && !isOwner;

        return `
                <div class="member-row" data-member-id="${member.id}">
                    <div class="member-row-left">
                        <div class="member-name">${escapeHtml(username)}</div>
                    </div>

                    <div class="member-row-right">
                        <span class="member-pill">${escapeHtml(member.role)}</span>
                        <span class="member-pill">${escapeHtml(member.membership_status)}</span>

                        ${
                            isPending
                                ? `
                                    <button
                                        class="member-action-btn member-approve-btn"
                                        type="button"
                                        data-member-id="${member.id}"
                                    >
                                        Approve
                                    </button>

                                    <button
                                        class="member-action-btn member-reject-btn"
                                        type="button"
                                        data-member-id="${member.id}"
                                    >
                                        Reject
                                    </button>
                                `
                                : ""
                        }

                        ${
                            canRemove
                                ? `
                                    <button
                                        class="member-action-btn member-remove-btn"
                                        type="button"
                                        data-member-id="${member.id}"
                                    >
                                        Remove
                                    </button>
                                `
                                : ""
                        }
                    </div>
                </div>
            `;
    })
        .join("");

    bindMemberActions(projectId);
}

function bindMemberActions(projectId) {
    const approveButtons = document.querySelectorAll(".member-approve-btn");
    const rejectButtons = document.querySelectorAll(".member-reject-btn");
    const removeButtons = document.querySelectorAll(".member-remove-btn");

    approveButtons.forEach((button) => {
        button.onclick = async () => {
            const memberId = button.dataset.memberId;
            await updateMembershipStatus(memberId, "active", projectId);
        };
    });

    rejectButtons.forEach((button) => {
        button.onclick = async () => {
            const memberId = button.dataset.memberId;
            await updateMembershipStatus(memberId, "removed", projectId);
        };
    });

    removeButtons.forEach((button) => {
        button.onclick = async () => {
            const memberId = button.dataset.memberId;
            await updateMembershipStatus(memberId, "removed", projectId);
        };
    });
}

async function updateMembershipStatus(memberId, newStatus, projectId) {
    const { error } = await supabase
        .from("project_members")
        .update({ membership_status: newStatus })
        .eq("id", memberId);

    if (error) {
        console.error(`Failed to update membership to ${newStatus}:`, error);
        return;
    }

    await loadMembers(projectId);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}