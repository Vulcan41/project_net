import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";
import { projectStore } from "../../state/projectStore.js";

let currentProject = null;

export async function initProjectMember(projectId) {
    setupBackButton();

    if (!projectId) {
        showError("Δεν βρέθηκε project id.");
        return;
    }

    const loaded = await projectStore.load(projectId);

    if (!loaded?.project) {
        showError("Αποτυχία φόρτωσης project.");
        return;
    }

    currentProject = loaded.project;

    renderSidebar();
    applyMemberMenuVisibility();
    await loadOwnerInfo();
    setupSidebar();
    finalizeSidebarVisibility();
    loadSection("overview");
}

/* =========================
   BACK BUTTON
========================= */

function setupBackButton() {
    const backBtn = document.getElementById("project-member-back-btn");
    if (!backBtn) return;

    backBtn.onclick = () => {
        loadView("basic");
    };
}

/* =========================
   SIDEBAR
========================= */

function renderSidebar() {
    const title = document.getElementById("project-member-sidebar-title");
    const subtitle = document.getElementById("project-member-sidebar-subtitle");
    const role = document.getElementById("project-member-sidebar-role");

    if (title) {
        const avatarMarkup = currentProject.avatar_url
        ? `
                <img
                    src="${currentProject.avatar_url}"
                    alt="${escapeHtml(currentProject.name)} avatar"
                    class="project-member-avatar-image"
                />
            `
        : `
                <span class="project-member-avatar-fallback">
                    ${escapeHtml(currentProject.name.charAt(0).toUpperCase())}
                </span>
            `;

        title.innerHTML = `
            <div class="project-member-title-row">
                <div class="project-member-avatar">
                    ${avatarMarkup}
                </div>

                <div class="project-member-title-block">
                    <div class="project-member-title-text">
                        ${escapeHtml(currentProject.name)}
                    </div>

                    <div class="project-member-title-meta">
                        <span class="project-member-pill ${
                            currentProject.visibility === "public"
                                ? "project-member-pill-public"
                                : "project-member-pill-private"
                        }">
                            ${escapeHtml(currentProject.visibility)}
                        </span>

                        <span class="project-member-pill project-member-pill-role-member">
                            member
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    if (subtitle) {
        subtitle.textContent = "";
    }

    if (role) {
        role.textContent = "";
    }
}

function applyMemberMenuVisibility() {
    const membersBtn = document.getElementById("project-member-members-btn");
    if (!membersBtn) return;

    const canViewMembers = currentProject?.members_can_view_members !== false;

    if (canViewMembers) {
        membersBtn.classList.remove("hidden");
    } else {
        membersBtn.classList.add("hidden");
    }
}

function setupSidebar() {
    const buttons = document.querySelectorAll(".project-member-menu-btn");

    buttons.forEach((btn) => {
        btn.onclick = () => {
            setActiveButton(btn);
            const section = btn.dataset.section;
            loadSection(section);
        };
    });
}

function setActiveButton(activeBtn) {
    document.querySelectorAll(".project-member-menu-btn").forEach((btn) => {
        btn.classList.remove("active");
    });

    activeBtn.classList.add("active");
}

async function loadOwnerInfo() {
    const avatarEl = document.querySelector(".project-member-owner-avatar");
    const usernameEl = document.querySelector(".project-member-owner-username");

    if (!avatarEl || !usernameEl || !currentProject?.owner_id) return;

    const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", currentProject.owner_id)
        .single();

    if (error) {
        console.error("Owner load error:", error);
        usernameEl.textContent = "Unknown";
        return;
    }

    const avatar = data.avatar_url
    ? `<img src="${escapeHtml(data.avatar_url)}" alt="${escapeHtml(data.username || "owner")} avatar" />`
    : `<span>${escapeHtml((data.username || "U")[0].toUpperCase())}</span>`;

    avatarEl.innerHTML = avatar;
    usernameEl.textContent = data.username || "User";
}

/* =========================
   LOAD SECTION
========================= */

async function loadSection(section) {

    if (
    section === "members" &&
    currentProject?.members_can_view_members === false
    ) {
        return;
    }

    const container = document.getElementById("project-member-body-content");
    if (!container) return;

    const htmlPath = `./views/projectMember/${section}/${section}.html`;
    const jsPath = `./${section}/${section}.js`;
    const cssPath = `./views/projectMember/${section}/${section}.css`;

    const res = await fetch(htmlPath);
    const html = await res.text();
    container.innerHTML = html;

    const oldCss = document.getElementById("project-member-section-css");
    if (oldCss) oldCss.remove();

    const link = document.createElement("link");
    link.id = "project-member-section-css";
    link.rel = "stylesheet";
    link.href = cssPath;
    document.head.appendChild(link);

    try {
        const module = await import(jsPath);

        const initFunction =
        "init" + section.charAt(0).toUpperCase() + section.slice(1);

        if (module[initFunction]) {
            module[initFunction](currentProject);
        }
    } catch (err) {
        console.error("ProjectMember section load error:", err);
    }
}

function finalizeSidebarVisibility() {
    const menu = document.getElementById("project-member-menu");
    if (!menu) return;

    menu.classList.remove("hidden");
}

function showError(message) {
    const errorBox = document.getElementById("project-member-error");
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