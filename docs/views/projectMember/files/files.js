import { supabase } from "../../../core/supabase.js";

let currentProject = null;
let defaultFolderId = null;
let currentFolderId = null;
let currentFolderName = "Root Folder";
let currentSort = "name_asc";
let currentSearch = "";

export async function initFiles(project) {
    if (!project) return;

    currentProject = project;

    const ready = await loadDefaultFolder();
    if (!ready) return;

    setupBackFolderButton();
    setupSort();
    setupSearch();
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
        .select("id, name, member_can_contribute")
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
    currentFolderName = data.name || "Root Folder";
    return true;
}

async function loadFolderMeta(folderId) {
    const { data, error } = await supabase
        .from("project_folders")
        .select("id, name, parent_folder_id, member_can_contribute")
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
   SORT / SEARCH
========================= */

function setupSort() {
    const select = document.getElementById("files-sort-select");
    if (!select) return;

    select.value = currentSort;

    select.onchange = async () => {
        currentSort = select.value;
        await loadFolderContent();
    };
}

function setupSearch() {
    const input = document.getElementById("files-search-input");
    if (!input) return;

    input.value = currentSearch;

    input.oninput = async () => {
        currentSearch = input.value.trim().toLowerCase();
        await loadFolderContent();
    };
}

function matchesSearch(value) {
    if (!currentSearch) return true;
    return String(value || "").toLowerCase().includes(currentSearch);
}

function sortByCurrentRule(items, getName, getDate, getSize = () => 0) {
    const sorted = [...items];

    switch (currentSort) {
        case "name_asc":
            return sorted.sort((a, b) => getName(a).localeCompare(getName(b)));

        case "name_desc":
            return sorted.sort((a, b) => getName(b).localeCompare(getName(a)));

        case "newest_desc":
            return sorted.sort((a, b) => new Date(getDate(b)) - new Date(getDate(a)));

        case "newest_asc":
            return sorted.sort((a, b) => new Date(getDate(a)) - new Date(getDate(b)));

        case "size_desc":
            return sorted.sort((a, b) => (getSize(b) || 0) - (getSize(a) || 0));

        case "size_asc":
            return sorted.sort((a, b) => (getSize(a) || 0) - (getSize(b) || 0));

        default:
            return sorted;
    }
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
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
    ]);

    if (foldersError || filesError) {
        console.error("Folder content load error:", foldersError || filesError);
        list.innerHTML = `<div class="files-empty">Error loading files</div>`;
        if (countEl) countEl.textContent = "0 items";
        return;
    }

    let foldersWithSize = folders ?? [];

    try {
        foldersWithSize = await Promise.all(
            foldersWithSize.map(async (folder) => ({
                ...folder,
                total_size: await getFolderTotalSize(folder.id)
            }))
        );
    } catch (err) {
        console.error("Failed to load folder sizes for sorting:", err);
    }

    const safeFolders = sortByCurrentRule(
        foldersWithSize.filter((folder) => matchesSearch(folder.name)),
        (folder) => folder.name?.toLowerCase() || "",
        (folder) => folder.created_at,
        (folder) => folder.total_size
    );

    const safeFiles = sortByCurrentRule(
        (files ?? []).filter((file) => matchesSearch(file.filename)),
        (file) => file.filename?.toLowerCase() || "",
        (file) => file.created_at,
        (file) => file.size_bytes
    );

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
            currentFolderName = defaultFolder?.name || "Root Folder";
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
    sub.textContent = "Loading...";

    metaWrap.appendChild(name);
    metaWrap.appendChild(sub);

    main.appendChild(icon);
    main.appendChild(metaWrap);

    row.appendChild(main);

    loadFolderStats(folder.id, sub);

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

    row.appendChild(main);

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
    const ext = getFileExtension(name);

    if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
        return "assets/icons_img.png";
    }

    if (mime === "application/pdf" || ext === "pdf") {
        return "assets/icon_pdf.png";
    }

    if (["doc", "docx"].includes(ext)) {
        return "assets/icon_doc.png";
    }

    if (["txt"].includes(ext)) {
        return "assets/icon_txt.png";
    }

    if (["xls", "xlsx", "csv"].includes(ext)) {
        return "assets/icon_xls.png";
    }

    if (["zip", "rar", "7z"].includes(ext)) {
        return "assets/icon_zip.png";
    }

    if (mime.startsWith("video/") || ["mp4", "mov", "avi"].includes(ext)) {
        return "assets/icon_video.png";
    }

    if (mime.startsWith("audio/") || ["mp3", "wav"].includes(ext)) {
        return "assets/icon_audio.png";
    }

    return "assets/icon_file_file.png";
}

async function loadFolderStats(folderId, subEl) {
    try {
        const { data, error } = await supabase.rpc("get_folder_total_size", {
            p_folder_id: folderId
        });

        if (error) throw error;

        const sizeText = formatSize(data || 0);
        subEl.textContent = sizeText;

    } catch (err) {
        console.error("Folder size error:", err);
        subEl.textContent = "Folder";
    }
}

async function getFolderTotalSize(folderId) {
    const { data, error } = await supabase.rpc("get_folder_total_size", {
        p_folder_id: folderId
    });

    if (error) throw error;
    return Number(data || 0);
}

function getFileExtension(filename) {
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
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