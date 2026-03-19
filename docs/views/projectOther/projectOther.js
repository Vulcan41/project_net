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
        .select("id, name, description, owner_id, visibility, status, created_at")
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

    renderProject(data);
}

function renderProject(project) {
    const title = document.getElementById("project-other-title");
    const description = document.getElementById("project-other-description");
    const owner = document.getElementById("project-other-owner");
    const created = document.getElementById("project-other-created");
    const visibility = document.getElementById("project-other-visibility");
    const status = document.getElementById("project-other-status");
    const meta = document.getElementById("project-other-meta");

    if (title) title.textContent = project.name ?? "Untitled project";
    if (description) {
        description.textContent = project.description || "Χωρίς περιγραφή.";
    }

    if (owner) owner.textContent = `Owner: ${project.owner_id}`;

    if (created) {
        const date = project.created_at
        ? new Date(project.created_at).toLocaleString()
        : "-";
        created.textContent = `Created: ${date}`;
    }

    if (visibility) visibility.textContent = `Visibility: ${project.visibility}`;
    if (status) status.textContent = `Status: ${project.status}`;

    if (meta) meta.classList.remove("hidden");
}

function showError(message) {
    const errorBox = document.getElementById("project-other-error");
    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}