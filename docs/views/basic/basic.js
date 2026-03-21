import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";

let projects = [];
let currentUserId = null;

export async function initBasic() {
    await ensureSetUpProjectComponent();
    setupCreateProjectButton();
    await loadProjects();
}

/* =========================
   COMPONENT SETUP
========================= */

async function ensureSetUpProjectComponent() {
    const existingModal = document.getElementById("setup-project-modal");
    if (existingModal) return;

    const htmlPath = "./components/setUpProject/setUpProject.html";
    const cssPath = "./components/setUpProject/setUpProject.css";

    const res = await fetch(htmlPath);
    const html = await res.text();

    document.body.insertAdjacentHTML("beforeend", html);

    const existingCss = document.getElementById("setup-project-component-css");
    if (!existingCss) {
        const link = document.createElement("link");
        link.id = "setup-project-component-css";
        link.rel = "stylesheet";
        link.href = cssPath;
        document.head.appendChild(link);
    }
}

/* =========================
   LOAD
========================= */

async function loadProjects() {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError) {
        console.error("Error getting user:", userError);
        projects = [];
        currentUserId = null;
        renderProjects();
        return;
    }

    if (!user) {
        projects = [];
        currentUserId = null;
        renderProjects();
        return;
    }

    currentUserId = user.id;

    const { data, error } = await supabase
        .from("project_members")
        .select(`
            role,
            membership_status,
            projects (
                id,
                name,
                description,
                visibility,
                status,
                created_at,
                owner_id,
                members_count,
                avatar_url
            )
        `)
        .eq("user_id", user.id)
        .eq("membership_status", "active");

    if (error) {
        console.error("Error loading projects:", error);
        projects = [];
        renderProjects();
        return;
    }

    projects = (data ?? [])
        .map((row) => {
        const project = row.projects;
        if (!project) return null;

        return {
            ...project,
            current_user_role: row.role
        };
    })
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    renderProjects();
}

/* =========================
   CREATE
========================= */

function setupCreateProjectButton() {
    const btn = document.getElementById("create-project-btn");
    if (!btn) return;

    btn.onclick = async () => {
        const module = await import("../../components/setUpProject/setUpProject.js");

        module.initSetUpProject({
            onSubmit: async ({ name, description, visibility }) => {
                const {
                    data: { user },
                    error: userError
                } = await supabase.auth.getUser();

                if (userError) throw userError;
                if (!user) throw new Error("Δεν βρεθηκε authenticated user.");

                const { data: projectData, error: projectError } = await supabase
                    .from("projects")
                    .insert([
                    {
                        name,
                        description: description || null,
                        owner_id: user.id,
                        visibility,
                        status: "active"
                    }
                ])
                    .select()
                    .single();

                if (projectError) throw projectError;

                const { error: memberError } = await supabase
                    .from("project_members")
                    .insert([
                    {
                        project_id: projectData.id,
                        user_id: user.id,
                        role: "owner",
                        membership_status: "active"
                    }
                ]);

                if (memberError) throw memberError;

                await loadProjects();
            }
        });
    };
}

/* =========================
   DELETE
========================= */

async function deleteProject(projectId) {
    const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

    if (error) {
        console.error("Error deleting project:", error);
        return;
    }

    await loadProjects();
}

/* =========================
   RENDER
========================= */

function renderProjects() {
    const emptyState = document.getElementById("basic-empty-state");
    const projectsWrap = document.getElementById("basic-projects-wrap");
    const grid = document.getElementById("basic-projects-grid");

    if (!emptyState || !projectsWrap || !grid) return;

    if (!projects.length) {
        emptyState.classList.remove("hidden");
        projectsWrap.classList.remove("active");
        grid.innerHTML = "";
        return;
    }

    emptyState.classList.add("hidden");
    projectsWrap.classList.add("active");

    grid.innerHTML = projects
        .map((project) => {
        const isOwner = project.owner_id === currentUserId;

        const visibilityClass =
        project.visibility === "public"
        ? "basic-project-pill-visibility-public"
        : "basic-project-pill-visibility-private";

        const roleClass =
        isOwner
        ? "basic-project-pill-role-owner"
        : "basic-project-pill-role-member";

        const membersCount = project.members_count ?? 1;
        const avatarMarkup = project.avatar_url
        ? `
                    <img
                        src="${project.avatar_url}"
                        alt="${escapeHtml(project.name)} avatar"
                        class="basic-project-avatar-image"
                    />
                `
        : `
                    <span class="basic-project-avatar-fallback">
                        ${escapeHtml(project.name.charAt(0).toUpperCase())}
                    </span>
                `;

        return `
                <article
                    class="basic-project-card basic-project-open"
                    data-project-id="${project.id}"
                    data-project-owner-id="${project.owner_id}"
                >
                    <div class="basic-project-card-top">
                        <div class="basic-project-avatar">
                            ${avatarMarkup}
                        </div>

                        ${
                            isOwner
                                ? `
                                    <button
                                        class="basic-project-delete"
                                        type="button"
                                        data-project-id="${project.id}"
                                    >
                                        Διαγραφή
                                    </button>
                                `
                                : ""
                        }
                    </div>

                    <div class="basic-project-main">
                        <h3 class="basic-project-title">${escapeHtml(project.name)}</h3>
                        <p class="basic-project-subtitle">
                            ${escapeHtml(project.description ?? "")}
                        </p>
                    </div>

                    <div class="basic-project-meta">
                        <span class="basic-project-pill ${visibilityClass}">
                            ${escapeHtml(project.visibility)}
                        </span>

                        <span class="basic-project-pill ${roleClass}">
                            ${isOwner ? "owner" : "member"}
                        </span>

                        <span class="basic-project-pill basic-project-pill-neutral">
                            ${membersCount} ${membersCount === 1 ? "member" : "members"}
                        </span>
                    </div>
                </article>
            `;
    })
        .join("");

    bindProjectCards();
    bindDeleteButtons();
}

/* =========================
   OPEN PROJECT
========================= */

function bindProjectCards() {
    const cards = document.querySelectorAll(".basic-project-open");

    cards.forEach((card) => {
        card.onclick = async (event) => {
            if (event.target.closest(".basic-project-delete")) return;

            const projectId = card.dataset.projectId;
            const ownerId = card.dataset.projectOwnerId;

            if (ownerId === currentUserId) {
                loadView("project", projectId);
                return;
            }

            const { data, error } = await supabase
                .from("project_members")
                .select("membership_status")
                .eq("project_id", projectId)
                .eq("user_id", currentUserId)
                .maybeSingle();

            if (error) {
                console.error("Error checking membership:", error);
                loadView("projectOther", projectId);
                return;
            }

            if (data && data.membership_status === "active") {
                loadView("projectMember", projectId);
            } else {
                loadView("projectOther", projectId);
            }
        };
    });
}

/* =========================
   BIND DELETE BUTTONS
========================= */

function bindDeleteButtons() {
    const buttons = document.querySelectorAll(".basic-project-delete");

    buttons.forEach((button) => {
        button.onclick = async () => {
            const projectId = button.dataset.projectId;
            await deleteProject(projectId);
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