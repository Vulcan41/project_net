import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";

let projects = [];
let currentUserId = null;

export async function initBasic() {
    await ensureSetUpProjectComponent();
    setupCreateProjectButton();

    const emptyState = document.getElementById("basic-empty-state");
    const projectsWrap = document.getElementById("basic-projects-wrap");
    const grid = document.getElementById("basic-projects-grid");

    if (emptyState) emptyState.classList.add("hidden");
    if (projectsWrap) projectsWrap.classList.remove("active");
    if (grid) grid.innerHTML = "";

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

    const { data, error } = await supabase.rpc("get_dashboard_projects");

    if (error) {
        console.error("Error loading projects:", error);
        projects = [];
        renderProjects();
        return;
    }

    projects = (data ?? []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

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
                        membership_status: "active",
                        membership_source: "invite"
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

        return `
    <article
        class="basic-project-card basic-project-open"
        data-project-id="${project.id}"
        data-project-owner-id="${project.owner_id}"
        data-project-role="${escapeHtml(project.current_user_role || "")}"
    >
        <div class="basic-project-card-members-badge">
    <span class="basic-project-card-members-count">
        ${membersCount}
    </span>
    <img
        src="assets/friends_2.png"
        alt="members"
        class="basic-project-card-members-icon"
    />
</div>

        <div class="basic-project-card-left">
            <div class="basic-project-avatar">
                ${
                    project.avatar_url
                        ? `<img src="${escapeHtml(project.avatar_url)}" alt="${escapeHtml(project.name)}" />`
                        : `<span>${escapeHtml(project.name.charAt(0).toUpperCase())}</span>`
                }
            </div>
        </div>

        <div class="basic-project-card-right">

    <h3 class="basic-project-title">${escapeHtml(project.name)}</h3>

    <p class="basic-project-subtitle">
        ${escapeHtml(project.description ?? "")}
    </p>

    <div class="basic-project-meta">
        <span class="basic-project-pill ${visibilityClass}">
            ${escapeHtml(project.visibility)}
        </span>

        <span class="basic-project-pill ${roleClass}">
            ${isOwner ? "owner" : "member"}
        </span>
    </div>

</div>
    </article>
`;
    })
        .join("");

    bindProjectCards();
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
            const currentUserRole = card.dataset.projectRole;

            if (ownerId === currentUserId) {
                loadView("project", projectId);
                return;
            }

            /* The dashboard already loaded this project for the user,
               so if a role exists we can trust they are an active member. */
            if (currentUserRole) {
                loadView("projectMember", projectId);
                return;
            }

            /* Fallback safety check only if role is missing */
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