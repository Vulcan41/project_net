import { supabase } from "../../../core/supabase.js";

let currentProject = null;
let defaultFolderId = null;
let currentFolderId = null;
let currentFolderName = "General Files";

export async function initFiles(project) {
    if (!project) return;

    currentProject = project;

    const ready = await loadDefaultFolder();
    if (!ready) return;

    setupUpload();
    setupCreateFolderButton();
    setupBackFolderButton();
    setupGlobalMenuCloser();
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

    defaultFolderId = data.id;
    currentFolderId = data.id;
    currentFolderName = data.name || "General Files";
    return true;
}

async function loadFolderMeta(folderId) {
    const { data, error } = await supabase
        .from("project_folders")
        .select("id, name, parent_folder_id, is_default")
        .eq("id", folderId)
        .eq("project_id", currentProject.id)
        .single();

    if (error || !data) {
        console.error("Failed to load folder meta:", error);
        return null;
    }

    return data;
}

async function buildBreadcrumbPath(folderId) {
    const path = [];
    let cursor = folderId;

    while (cursor) {
        const folder = await loadFolderMeta(cursor);
        if (!folder) break;

        path.unshift(folder);

        if (!folder.parent_folder_id) break;
        cursor = folder.parent_folder_id;
    }

    return path;
}

async function renderBreadcrumbs() {
    const container = document.getElementById("files-breadcrumbs");
    if (!container || !currentFolderId) return;

    const path = await buildBreadcrumbPath(currentFolderId);

    container.innerHTML = "";

    path.forEach((folder, index) => {
        const isLast = index === path.length - 1;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `files-breadcrumb-btn${isLast ? " active" : ""}`;
        btn.textContent = folder.name;

        if (!isLast) {
            btn.onclick = async () => {
                currentFolderId = folder.id;
                currentFolderName = folder.name;
                await loadFolderContent();
            };
        }

        container.appendChild(btn);

        if (!isLast) {
            const sep = document.createElement("span");
            sep.className = "files-breadcrumb-separator";
            sep.textContent = "/";
            container.appendChild(sep);
        }
    });
}

function updateBackButtonVisibility() {
    const btn = document.getElementById("files-back-folder-btn");
    if (!btn) return;

    btn.classList.toggle("hidden", currentFolderId === defaultFolderId);
}

/* =========================
   LOAD FOLDER CONTENT
========================= */

async function loadFolderContent() {
    const list = document.getElementById("files-list");
    const countEl = document.getElementById("files-count");

    if (!list || !currentFolderId) return;

    await renderBreadcrumbs();
    updateBackButtonVisibility();

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
   NAVIGATION
========================= */

function setupBackFolderButton() {
    const btn = document.getElementById("files-back-folder-btn");
    if (!btn) return;

    btn.onclick = async () => {
        if (!currentFolderId || currentFolderId === defaultFolderId) return;

        const currentFolder = await loadFolderMeta(currentFolderId);
        if (!currentFolder) return;

        if (!currentFolder.parent_folder_id) {
            currentFolderId = defaultFolderId;
            const defaultFolder = await loadFolderMeta(defaultFolderId);
            currentFolderName = defaultFolder?.name || "General Files";
            await loadFolderContent();
            return;
        }

        const parentFolder = await loadFolderMeta(currentFolder.parent_folder_id);
        if (!parentFolder) return;

        currentFolderId = parentFolder.id;
        currentFolderName = parentFolder.name;
        await loadFolderContent();
    };
}

/* =========================
   CREATE / RENAME / DELETE FOLDER
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

async function renameFolder(folder) {
    const nextName = window.prompt("Rename folder:", folder.name);
    if (!nextName || !nextName.trim()) return;

    try {
        const { error } = await supabase
            .from("project_folders")
            .update({
            name: nextName.trim()
        })
            .eq("id", folder.id);

        if (error) throw error;

        if (folder.id === currentFolderId) {
            currentFolderName = nextName.trim();
        }

        await loadFolderContent();
    } catch (err) {
        console.error("Rename folder failed:", err);
        alert("Failed to rename folder");
    }
}

async function deleteFolder(folder) {
    if (folder.is_default) {
        alert("Default folder cannot be deleted");
        return;
    }

    const confirmed = window.confirm(
        `Delete folder "${folder.name}" and everything inside it?`
    );

    if (!confirmed) return;

    try {
        const headers = await getAuthHeaders();

        const res = await fetch("/api/project-files/delete-folder", {
            method: "POST",
            headers,
            body: JSON.stringify({ folderId: folder.id })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || "Delete failed");
        }

        await loadFolderContent();
    } catch (err) {
        console.error("Delete folder failed:", err);
        alert(err.message || "Failed to delete folder");
    }
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
   MENUS
========================= */

function setupGlobalMenuCloser() {
    document.addEventListener("click", closeAllMenus);
}

function closeAllMenus() {
    document.querySelectorAll(".file-menu-dropdown.open").forEach((menu) => {
        menu.classList.remove("open");
    });
}

function createActionMenu(items) {
    const wrapper = document.createElement("div");
    wrapper.className = "file-actions-menu";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "file-menu-trigger";
    trigger.textContent = "⋯";

    const dropdown = document.createElement("div");
    dropdown.className = "file-menu-dropdown";

    items.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `file-menu-item${item.danger ? " file-menu-item-danger" : ""}`;
        btn.textContent = item.label;

        btn.onclick = async (event) => {
            event.stopPropagation();
            dropdown.classList.remove("open");
            await item.onClick();
        };

        dropdown.appendChild(btn);
    });

    trigger.onclick = (event) => {
        event.stopPropagation();
        const isOpen = dropdown.classList.contains("open");
        closeAllMenus();
        if (!isOpen) {
            dropdown.classList.add("open");
        }
    };

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    return wrapper;
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
    img.src = "assets/folder.png";
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
    sub.textContent = folder.is_default ? "Default folder" : "Folder";

    metaWrap.appendChild(name);
    metaWrap.appendChild(sub);

    main.appendChild(icon);
    main.appendChild(metaWrap);

    const actions = createActionMenu([
        {
            label: "Rename",
            onClick: async () => {
                await renameFolder(folder);
            }
        },
        ...(!folder.is_default ? [{
            label: "Delete",
            danger: true,
            onClick: async () => {
                await deleteFolder(folder);
            }
        }] : [])
    ]);

    row.appendChild(main);
    row.appendChild(actions);

    row.onclick = async () => {
        currentFolderId = folder.id;
        currentFolderName = folder.name;
        await loadFolderContent();
    };

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

    const actions = createActionMenu([
        {
            label: "Delete",
            danger: true,
            onClick: async () => {
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
            }
        }
    ]);

    row.appendChild(main);
    row.appendChild(actions);

    row.onclick = async () => {
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
