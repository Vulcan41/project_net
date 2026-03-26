import { supabase } from "../../../core/supabase.js";

let currentProject = null;
let currentFolderId = null;
let currentFolderName = "General Files";

export async function initFiles(project) {
    if (!project) return;

    currentProject = project;

    const ready = await loadDefaultFolder();
    if (!ready) return;

    renderCurrentFolderLabel();
    setupUpload();
    setupCreateFolderButton();
    await loadFolderContent();
}

/* =========================
   DEFAULT FOLDER
========================= */

async function loadDefaultFolder() {
    const list = document.getElementById("files-list");
    const countEl = document.getElementById("files-count");

    const { data, error } = await supabase
        .from("project_folders")
        .select("id, name")
        .eq("project_id", currentProject.id)
        .eq("is_default", true)
        .single();

    if (error || !data) {
        console.error("Failed to load default folder:", error);
        if (list) {
            list.innerHTML = `<div class="files-empty">Failed to load folder</div>`;
        }
        if (countEl) {
            countEl.textContent = "0 items";
        }
        return false;
    }

    currentFolderId = data.id;
    currentFolderName = data.name || "General Files";
    return true;
}

function renderCurrentFolderLabel() {
    const el = document.getElementById("files-current-folder");
    if (!el) return;

    el.textContent = `Folder: ${currentFolderName}`;
}

/* =========================
   LOAD FOLDER CONTENT
========================= */

async function loadFolderContent() {
    const list = document.getElementById("files-list");
    const countEl = document.getElementById("files-count");

    if (!list || !currentFolderId) return;

    list.innerHTML = `<div class="files-empty">Loading files...</div>`;

    const [{ data: folders, error: foldersError }, { data: files, error: filesError }] =
    await Promise.all([
        supabase
            .from("project_folders")
            .select("*")
            .eq("project_id", currentProject.id)
            .eq("parent_folder_id", currentFolderId)
            .order("created_at", { ascending: true }),

        supabase
            .from("project_files")
            .select("*")
            .eq("project_id", currentProject.id)
            .eq("folder_id", currentFolderId)
            .eq("status", "ready")
            .order("created_at", { ascending: false })
    ]);

    if (foldersError || filesError) {
        console.error("Folder content load error:", foldersError || filesError);
        list.innerHTML = `<div class="files-empty">Error loading files</div>`;
        if (countEl) countEl.textContent = "0 items";
        return;
    }

    const safeFolders = folders ?? [];
    const safeFiles = files ?? [];
    const totalItems = safeFolders.length + safeFiles.length;

    if (countEl) {
        countEl.textContent = `${totalItems} ${totalItems === 1 ? "item" : "items"}`;
    }

    if (!totalItems) {
        list.innerHTML = `<div class="files-empty">No items in ${escapeHtml(currentFolderName)}</div>`;
        return;
    }

    list.innerHTML = "";

    safeFolders.forEach((folder) => list.appendChild(createFolderRow(folder)));
    safeFiles.forEach((file) => list.appendChild(createFileRow(file)));
}

/* =========================
   AUTH HEADERS
========================= */

async function getAuthHeaders() {
    const {
        data: { session }
    } = await supabase.auth.getSession();

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token || ""}`
    };
}

/* =========================
   CREATE FOLDER
========================= */

function setupCreateFolderButton() {
    const btn = document.getElementById("files-create-folder-btn");
    if (!btn) return;

    btn.onclick = async () => {
        if (!currentFolderId) return;

        const name = window.prompt("Folder name:");
        if (!name || !name.trim()) return;

        try {
            const {
                data: { user }
            } = await supabase.auth.getUser();

            const { error } = await supabase
                .from("project_folders")
                .insert({
                project_id: currentProject.id,
                parent_folder_id: currentFolderId,
                name: name.trim(),
                created_by: user.id,
                is_default: false
            });

            if (error) throw error;

            await loadFolderContent();
        } catch (err) {
            console.error("Create folder failed:", err);
            alert("Failed to create folder");
        }
    };
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
        if (!file || !currentFolderId) return;

        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/project-files/upload-url", {
                method: "POST",
                headers,
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

            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                body: file
            });

            if (!uploadRes.ok) {
                throw new Error("Upload to storage failed");
            }

            const {
                data: { user }
            } = await supabase.auth.getUser();

            const { error } = await supabase
                .from("project_files")
                .insert({
                id: fileId,
                project_id: currentProject.id,
                folder_id: currentFolderId,
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

            await loadFolderContent();

        } catch (err) {
            console.error("Upload failed:", err);
            alert("Upload failed");
        }

        input.value = "";
    };
}

/* =========================
   ROWS
========================= */

function createFolderRow(folder) {
    const row = document.createElement("div");
    row.className = "file-row file-row-folder";

    const main = document.createElement("div");
    main.className = "file-main";

    const icon = document.createElement("div");
    icon.className = "file-icon";

    const img = document.createElement("img");
    img.src = "assets/menu_files.png";
    img.alt = "folder";
    img.className = "file-icon-img";
    icon.appendChild(img);

    const metaWrap = document.createElement("div");
    metaWrap.className = "file-meta-wrap";

    const name = document.createElement("div");
    name.className = "file-name";
    name.textContent = folder.name;
    name.title = folder.name;

    const sub = document.createElement("div");
    sub.className = "file-sub";
    sub.textContent = "Folder";

    metaWrap.appendChild(name);
    metaWrap.appendChild(sub);

    main.appendChild(icon);
    main.appendChild(metaWrap);

    row.appendChild(main);

    return row;
}

function createFileRow(file) {
    const row = document.createElement("div");
    row.className = "file-row";

    const main = document.createElement("div");
    main.className = "file-main";

    const icon = document.createElement("div");
    icon.className = "file-icon";

    const img = document.createElement("img");
    img.src = getFileIcon(file);
    img.alt = "file";
    img.className = "file-icon-img";
    icon.appendChild(img);

    const metaWrap = document.createElement("div");
    metaWrap.className = "file-meta-wrap";

    const name = document.createElement("div");
    name.className = "file-name";
    name.textContent = file.filename;
    name.title = file.filename;

    const sub = document.createElement("div");
    sub.className = "file-sub";
    sub.textContent = `${formatSize(file.size_bytes)} • ${formatDate(file.created_at)}`;

    metaWrap.appendChild(name);
    metaWrap.appendChild(sub);

    main.appendChild(icon);
    main.appendChild(metaWrap);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "file-btn file-btn-download";
    downloadBtn.textContent = "Download";

    downloadBtn.onclick = async () => {
        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/project-files/download-url", {
                method: "POST",
                headers,
                body: JSON.stringify({ fileId: file.id })
            });

            if (!res.ok) {
                throw new Error("Failed to get download URL");
            }

            const { downloadUrl } = await res.json();
            window.open(downloadUrl, "_blank");
        } catch (err) {
            console.error("Download error:", err);
            alert("Download failed");
        }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "file-btn file-btn-delete";
    deleteBtn.textContent = "Delete";

    deleteBtn.onclick = async () => {
        if (!confirm(`Delete "${file.filename}"?`)) return;

        try {
            const headers = await getAuthHeaders();

            const res = await fetch("/api/project-files/delete-file", {
                method: "POST",
                headers,
                body: JSON.stringify({ fileId: file.id })
            });

            if (!res.ok) {
                throw new Error("Delete failed");
            }

            await loadFolderContent();
        } catch (err) {
            console.error("Delete error:", err);
            alert("Delete failed");
        }
    };

    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(main);
    row.appendChild(actions);

    return row;
}

/* =========================
   HELPERS
========================= */

function getFileIcon(file) {
    const mime = (file.mime_type || "").toLowerCase();
    const name = (file.filename || "").toLowerCase();

    if (mime.startsWith("image/")) return "assets/icon_jpg.png";
    if (mime === "application/pdf" || name.endsWith(".pdf")) return "assets/icon_pdf.png";

    if (mime.startsWith("video/")) return "assets/logo_5.png";
    if (mime.startsWith("audio/")) return "assets/logo_5.png";

    if (
    name.endsWith(".zip") ||
    name.endsWith(".rar") ||
    name.endsWith(".7z")
    ) return "assets/logo_5.png";

    if (
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt")
    ) return "assets/logo_5.png";

    return "assets/logo_5.png";
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateString) {
    if (!dateString) return "Unknown date";

    const date = new Date(dateString);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
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