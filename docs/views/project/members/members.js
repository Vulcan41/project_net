export function initMembers(project) {
    if (!project) return;

    const info = document.getElementById("members-project-info");

    if (info) {
        info.textContent =
        "Project ID: " + project.id +
        " | Name: " + project.name;
    }

    console.log("Members section loaded for:", project);
}