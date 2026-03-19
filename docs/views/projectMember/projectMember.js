import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";

export async function initProjectMember(projectId) {
    setupBackButton();

    if (!projectId) {
        showError("Δεν βρέθηκε project id.");
        return;
    }

    await loadProject(projectId);
}

function setupBackButton() {
    const backBtn = document.getElementById("project-member-back-btn");
    if (!backBtn) return;

    backBtn.onclick = () => {
        loadView("basic");
    };
}

async function loadProject(projectId) {
    const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, visibility, status")
        .eq("id", projectId)
        .single();

    if (error) {
        console.error("Error loading projectMember:", error);
        showError("Αποτυχία φόρτωσης project.");
        return;
    }

    if (!data) {
        showError("Το project δεν βρέθηκε.");
        return;
    }

    renderProject(data);
}

function renderProject(project) {
    const title = document.getElementById("project-member-title");
    const description = document.getElementById("project-member-description");
    const role = document.getElementById("project-member-role");
    const visibility = document.getElementById("project-member-visibility");
    const status = document.getElementById("project-member-status");
    const meta = document.getElementById("project-member-meta");

    if (title) title.textContent = project.name ?? "Untitled project";
    if (description) description.textContent = project.description || "Χωρίς περιγραφή.";

    if (role) role.textContent = "Member";
    if (visibility) visibility.textContent = `Visibility: ${project.visibility}`;
    if (status) status.textContent = `Status: ${project.status}`;

    if (meta) meta.classList.remove("hidden");
}

function showError(message) {
    const errorBox = document.getElementById("project-member-error");
    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}