import { supabase } from "../../core/supabase.js";

let currentProject = null;

export async function initProject(projectId) {
    if (!projectId) {
        console.error("No project id");
        return;
    }

    await loadProject(projectId);
    setupSidebar();
    loadSection("overview"); // default
}

/* =========================
   LOAD PROJECT
========================= */

async function loadProject(projectId) {
    const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

    if (error) {
        console.error("Error loading project:", error);
        return;
    }

    currentProject = data;

    renderSidebar();
}

/* =========================
   SIDEBAR
========================= */

function renderSidebar() {
    const title = document.getElementById("project-sidebar-title");
    const subtitle = document.getElementById("project-sidebar-subtitle");
    const role = document.getElementById("project-sidebar-role");

    if (title) title.textContent = currentProject.name;

    if (subtitle) {
        subtitle.textContent =
        currentProject.visibility === "public"
        ? "Public project"
        : "Private project";
    }

    if (role) {
        role.textContent = "Owner";
    }
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
   LOAD SECTION (INTERNAL VIEW)
========================= */

async function loadSection(section) {
    const container = document.getElementById("project-body-content");
    if (!container) return;

    const htmlPath = `./views/project/${section}/${section}.html`;
    const jsPath = `./${section}/${section}.js`;
    const cssPath = `./views/project/${section}/${section}.css`;

    /* LOAD HTML */
    const res = await fetch(htmlPath);
    const html = await res.text();
    container.innerHTML = html;

    /* LOAD CSS */
    const oldCss = document.getElementById("project-section-css");
    if (oldCss) oldCss.remove();

    const link = document.createElement("link");
    link.id = "project-section-css";
    link.rel = "stylesheet";
    link.href = cssPath;
    document.head.appendChild(link);

    /* LOAD JS */
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