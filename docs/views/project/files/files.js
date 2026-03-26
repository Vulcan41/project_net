import { supabase } from "../../../core/supabase.js";

let currentProject = null;

export function initFiles(project) {
    if (!project) return;

    currentProject = project;

    setupUpload();
    loadFiles();
}

/* =========================
   LOAD FILES
========================= */

async function loadFiles() {
    const list = document.getElementById("files-list");
    if (!list) return;

    list.innerHTML = `<div class="files-empty">Loading...</div>`;

    const { data, error } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", currentProject.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        list.innerHTML = `<div class="files-empty">Error loading files</div>`;
        return;
    }

    if (!data.length) {
        list.innerHTML = `<div class="files-empty">No files yet</div>`;
        return;
    }

    list.innerHTML = "";
    data.forEach(file => list.appendChild(createRow(file)));
}

/* =========================
   UPLOAD
========================= */

function setupUpload() {
    const btn = document.getElementById("files-upload-btn");
    const input = document.getElementById("files-input");

    if (!btn || !input) return;

    btn.onclick = () => input.click();

    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        try {
            // 1. request upload URL
            const res = await fetch("/api/project-files/upload-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    fileName: file.name,
                    contentType: file.type
                })
            });

            if (!res.ok) {
                throw new Error("Failed to get upload URL");
            }

            const { uploadUrl, objectKey, fileId } = await res.json();

            // 2. upload file to R2
            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                body: file
            });

            if (!uploadRes.ok) {
                throw new Error("Upload to storage failed");
            }

            // 3. insert into DB
            const {
                data: { user }
            } = await supabase.auth.getUser();

            const { error } = await supabase
                .from("project_files")
                .insert({
                id: fileId,
                project_id: currentProject.id,
                uploaded_by: user.id,
                filename: file.name,
                object_key: objectKey,
                size_bytes: file.size,
                mime_type: file.type,
                status: "ready",
                visibility: "public",
                kind: "general"
            });

            if (error) throw error;

            await loadFiles();

        } catch (err) {
            console.error("Upload failed:", err);
            alert("Upload failed");
        }

        input.value = "";
    };
}

/* =========================
   ROW
========================= */

function createRow(file) {
    const row = document.createElement("div");
    row.className = "file-row";

    const left = document.createElement("div");

    const name = document.createElement("div");
    name.className = "file-name";
    name.textContent = file.filename;

    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.textContent = formatSize(file.size_bytes);

    left.appendChild(name);
    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "file-btn file-btn-download";
    downloadBtn.textContent = "Download";

    downloadBtn.onclick = async () => {
        try {
            const res = await fetch("/api/project-files/download-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId: file.id })
            });

            if (!res.ok) {
                throw new Error("Failed to get download URL");
            }

            const { downloadUrl } = await res.json();
            window.open(downloadUrl, "_blank");

        } catch (err) {
            console.error(err);
            alert("Download failed");
        }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "file-btn file-btn-delete";
    deleteBtn.textContent = "Delete";

    deleteBtn.onclick = async () => {
        if (!confirm(`Delete "${file.filename}"?`)) return;

        try {
            const res = await fetch("/api/project-files/delete-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId: file.id })
            });

            if (!res.ok) {
                throw new Error("Delete failed");
            }

            await loadFiles();

        } catch (err) {
            console.error(err);
            alert("Delete failed");
        }
    };

    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(left);
    row.appendChild(actions);

    return row;
}

/* =========================
   HELPERS
========================= */

function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}