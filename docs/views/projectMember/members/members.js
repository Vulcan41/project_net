import { supabase } from "../../../core/supabase.js";
import { loadView } from "../../../core/router.js";
import { DEFAULT_AVATAR } from "../../../state/userStore.js";

let currentProject = null;
let currentMembers = [];
let currentSort = "newest_desc";
let currentSearch = "";

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
                username,
                full_name,
                avatar_url
            )
        `)
        .eq("project_id", projectId)
        .eq("membership_status", "active")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error loading project members:", error);
        list.innerHTML = `
            <div class="member-empty">
                Members are not available.
            </div>
        `;
        return;
    }

    currentMembers = data ?? [];
    renderMembersView();
}

function renderMembersView() {
    const list = document.getElementById("members-list");
    if (!list) return;

    const filteredMembers = getFilteredMembers();

    const toolbar = `
        <div class="members-toolbar">
            <div class="members-toolbar-left">
                <div class="members-group-title">
                    Members (${filteredMembers.length})
                </div>

                <select id="members-sort-select" class="members-sort-select">
                    <option value="newest_desc">Newest first</option>
                    <option value="newest_asc">Newest last</option>
                    <option value="alpha_asc">A → Z</option>
                    <option value="alpha_desc">Z → A</option>
                </select>

                <input
                    id="members-search-input"
                    class="members-search-input"
                    type="text"
                    placeholder="Search members..."
                    value="${escapeHtml(currentSearch)}"
                />
            </div>
        </div>
    `;

    if (!currentMembers.length) {
        list.innerHTML = `
            ${toolbar}
            <div class="member-empty">
                No members found.
            </div>
        `;
        setupSort();
        setupSearch();
        return;
    }

    if (!filteredMembers.length) {
        list.innerHTML = `
            <div class="members-group">
                ${toolbar}
                <div class="member-empty">
                    No matching members found.
                </div>
            </div>
        `;
        setupSort();
        setupSearch();
        return;
    }

    list.innerHTML = `
        <div class="members-group">
            ${toolbar}
            <div class="members-group-list">
                ${filteredMembers.map(renderMemberRow).join("")}
            </div>
        </div>
    `;

    setupSort();
    setupSearch();
    bindMemberAvatarFallbacks();
    bindMemberProfileLinks();
}

function renderMemberRow(member) {
    const username = member.profiles?.username ?? "user";
    const fullName = member.profiles?.full_name || username || "Unknown user";
    const avatarUrl = member.profiles?.avatar_url?.trim() || DEFAULT_AVATAR;

    return `
        <div class="member-row" data-member-id="${member.id}">
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

                <div class="member-tooltip">View profile</div>
            </div>

            <div class="member-row-right">
                <span class="member-pill ${
                    member.role === "owner"
                        ? "member-pill-role-owner"
                        : "member-pill-role-member"
                }">
                    ${escapeHtml(member.role)}
                </span>
            </div>
        </div>
    `;
}

function getFilteredMembers() {
    return sortMembers(
        currentMembers.filter((member) => {
            const search = currentSearch.trim().toLowerCase();
            if (!search) return true;

            const fullName = (member.profiles?.full_name || "").toLowerCase();
            const username = (member.profiles?.username || "").toLowerCase();

            return fullName.includes(search) || username.includes(search);
        })
    );
}

function sortMembers(list) {
    const sorted = [...list];

    switch (currentSort) {
        case "newest_desc":
            return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        case "newest_asc":
            return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        case "alpha_asc":
            return sorted.sort((a, b) => {
                const aName = (a.profiles?.full_name || a.profiles?.username || "").toLowerCase();
                const bName = (b.profiles?.full_name || b.profiles?.username || "").toLowerCase();
                return aName.localeCompare(bName);
            });

        case "alpha_desc":
            return sorted.sort((a, b) => {
                const aName = (a.profiles?.full_name || a.profiles?.username || "").toLowerCase();
                const bName = (b.profiles?.full_name || b.profiles?.username || "").toLowerCase();
                return bName.localeCompare(aName);
            });

        default:
            return sorted;
    }
}

function setupSort() {
    const select = document.getElementById("members-sort-select");
    if (!select) return;

    select.value = currentSort;

    select.onchange = () => {
        currentSort = select.value;
        renderMembersView();
    };
}

function setupSearch() {
    const input = document.getElementById("members-search-input");
    if (!input) return;

    input.value = currentSearch;

    input.oninput = () => {
        const cursorPos = input.selectionStart; // save cursor
        currentSearch = input.value;

        renderMembersView();

        // restore focus AFTER re-render
        const newInput = document.getElementById("members-search-input");
        if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(cursorPos, cursorPos);
        }
    };
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

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}