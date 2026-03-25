import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";
import { projectStore } from "../../state/projectStore.js";
import { initModal, openModal } from "../../components/modal.js";

let currentProject = null;

export async function initProject(projectId) {
    if (!projectId) {
        console.error("No project id");
        return;
    }

    await initModal();

    const loaded = await projectStore.load(projectId);

    if (!loaded?.project) {
        console.error("Error loading project store.");
        return;
    }

    currentProject = loaded.project;

    renderSidebar();
    await loadOwnerInfo();
    setupSidebar();
    setupBackButton();
    setupProjectUpdateListener();
    loadSection("overview");
}

function setupProjectUpdateListener() {
    window.removeEventListener("project-updated", handleProjectUpdated);
    window.addEventListener("project-updated", handleProjectUpdated);
}

async function handleProjectUpdated(event) {
    if (!event?.detail) return;

    currentProject = {
        ...currentProject,
        ...event.detail
    };

    if (typeof projectStore.setProject === "function") {
        projectStore.setProject(currentProject);
    }

    renderSidebar();
    await loadOwnerInfo();
}

/* =========================
   SIDEBAR
========================= */

function renderSidebar() {
    const title = document.getElementById("project-sidebar-title");
    const subtitle = document.getElementById("project-sidebar-subtitle");
    const role = document.getElementById("project-sidebar-role");

    if (title) {
        const avatarMarkup = currentProject.avatar_url
        ? `
                <img
                    src="${currentProject.avatar_url}"
                    alt="${escapeHtml(currentProject.name)} avatar"
                    class="project-sidebar-avatar-image"
                />
            `
        : `
                <span class="project-sidebar-avatar-fallback">
                    ${escapeHtml(currentProject.name.charAt(0).toUpperCase())}
                </span>
            `;

        title.innerHTML = `
            <div class="project-sidebar-title-row">
                <div class="project-sidebar-avatar">
                    ${avatarMarkup}
                </div>

                <div class="project-sidebar-title-block">
                    <div class="project-sidebar-title-text">
                        ${escapeHtml(currentProject.name)}
                    </div>

                    <div class="project-sidebar-meta">
                        <span class="project-sidebar-pill ${
                            currentProject.visibility === "public"
                                ? "project-sidebar-pill-public"
                                : "project-sidebar-pill-private"
                        }">
                            ${escapeHtml(currentProject.visibility)}
                        </span>

                        <span class="project-sidebar-pill project-sidebar-pill-owner">
                            owner
                        </span>
                    </div>
                </div>
            </div>

            <div class="project-sidebar-owner" id="project-sidebar-owner">
                <div class="project-sidebar-owner-label">A project by:</div>

                <div class="project-sidebar-owner-row">
                    <div class="project-sidebar-owner-avatar"></div>
                    <div class="project-sidebar-owner-username">Loading...</div>
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

async function loadOwnerInfo() {
    const avatarEl = document.querySelector(".project-sidebar-owner-avatar");
    const usernameEl = document.querySelector(".project-sidebar-owner-username");

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

function setupSidebar() {
    const buttons = document.querySelectorAll(".project-menu-btn");

    buttons.forEach((btn) => {
        btn.onclick = () => {
            setActiveButton(btn);
            const section = btn.dataset.section;
            loadSection(section);
        };
    });
}

function setActiveButton(activeBtn) {
    document.querySelectorAll(".project-menu-btn").forEach((btn) => {
        btn.classList.remove("active");
    });

    activeBtn.classList.add("active");
}

/* =========================
   LOAD SECTION
========================= */

async function loadSection(section) {
    const container = document.getElementById("project-body-content");
    if (!container) return;

    const htmlPath = `./views/project/${section}/${section}.html`;
    const jsPath = `./${section}/${section}.js`;
    const cssPath = `./views/project/${section}/${section}.css`;

    const res = await fetch(htmlPath);
    const html = await res.text();
    container.innerHTML = html;

    const oldCss = document.getElementById("project-section-css");
    if (oldCss) oldCss.remove();

    const link = document.createElement("link");
    link.id = "project-section-css";
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
        console.error("Section load error:", err);
    }
}

function setupBackButton() {
    const backBtn = document.getElementById("project-back-btn");
    if (!backBtn) return;

    backBtn.onclick = () => {
        loadView("basic");
    };
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}