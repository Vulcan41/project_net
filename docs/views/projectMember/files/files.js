import { supabase } from "../../../core/supabase.js";

let currentProject = null;

export function initFiles(project) {
    if (!project) return;

    currentProject = project;
    loadFiles();
}

async function loadFiles() {
    const list = document.getElementById("files-list");
    if (!list) return;

    list.innerHTML = `<div class="files-empty">Loading...</div>`;

    const { data, error } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", currentProject.id)
        .eq("status", "ready")
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

    if (error) {
        list.innerHTML = `<div class="files-empty">Error loading files</div>`;
        return;
    }

    if (!data.length) {
        list.innerHTML = `<div class="files-empty">No files available</div>`;
        return;
    }

    list.innerHTML = "";
    data.forEach(file => list.appendChild(createRow(file)));
}

function createRow(file) {
    const row = document.createElement("div");
    row.className = "file-row";

    const name = document.createElement("div");
    name.className = "file-name";
    name.textContent = file.filename;

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "file-btn file-btn-download";
    downloadBtn.textContent = "Download";

    downloadBtn.onclick = async () => {
        const res = await fetch("/api/project-files/download-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: file.id })
        });

        const { downloadUrl } = await res.json();
        window.open(downloadUrl, "_blank");
    };

    row.appendChild(name);
    row.appendChild(downloadBtn);

    return row;
}