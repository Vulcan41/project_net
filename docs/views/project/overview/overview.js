export function initOverview(project) {
    if (!project) return;

    document.getElementById("overview-title").textContent =
    project.name ?? "Untitled project";

    document.getElementById("overview-description").textContent =
    project.description || "No description";

    document.getElementById("overview-owner").textContent =
    "Owner: " + project.owner_id;

    document.getElementById("overview-visibility").textContent =
    "Visibility: " + project.visibility;

    document.getElementById("overview-status").textContent =
    "Status: " + project.status;

    const date = project.created_at
    ? new Date(project.created_at).toLocaleString()
    : "-";

    document.getElementById("overview-created").textContent =
    "Created: " + date;
}