import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";

let projects = [];

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
        renderProjects();
        return;
    }

    if (!user) {
        projects = [];
        renderProjects();
        return;
    }

    const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, visibility, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error loading projects:", error);
        projects = [];
        renderProjects();
        return;
    }

    projects = data ?? [];
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

                if (userError) {
                    throw userError;
                }

                if (!user) {
                    throw new Error("Δεν βρεθηκε authenticated user.");
                }

                const { error } = await supabase
                    .from("projects")
                    .insert([
                    {
                        name,
                        description: description || null,
                        owner_id: user.id,
                        visibility,
                        status: "active"
                    }
                ]);

                if (error) {
                    throw error;
                }

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
        return `
                <article
                    class="basic-project-card basic-project-open"
                    data-project-id="${project.id}"
                >
                    <div class="basic-project-card-top">
                        <div class="basic-project-card-badge">
                            ${project.name.charAt(0).toUpperCase()}
                        </div>

                        <button
                            class="basic-project-delete"
                            type="button"
                            data-project-id="${project.id}"
                        >
                            Διαγραφή
                        </button>
                    </div>

                    <div class="basic-project-main">
                        <h3 class="basic-project-title">${project.name}</h3>
                        <p class="basic-project-subtitle">
                            ${project.description ?? ""}
                        </p>
                    </div>

                    <div class="basic-project-meta">
                        <span class="basic-project-pill">${project.visibility}</span>
                        <span class="basic-project-pill">UI + DB</span>
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
        card.onclick = (event) => {
            if (event.target.closest(".basic-project-delete")) return;

            const projectId = card.dataset.projectId;
            loadView("project", projectId);
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
