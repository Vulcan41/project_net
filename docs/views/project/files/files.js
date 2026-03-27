import { supabase } from "../../../core/supabase.js";
import { showInfo } from "../../../components/info.js";
import {
ensureFolderModal,
openFolderModal,
openFolderConfirmModal,
closeFolderModal
} from "../../../components/folderModal/folderModal.js";
import {
ensureFileConflictModal,
openFileConflictModal
} from "../../../components/fileConflictModal/fileConflictModal.js";

let currentProject = null;
let defaultFolderId = null;
let currentFolderId = null;
let currentFolderName = "Root Folder";
let currentSort = "name_asc";
let currentSearch = "";

/* =========================
   INIT
========================= */

export async function initFiles(project) {
    if (!project) return;

    currentProject = project;

    const ready = await loadDefaultFolder();
    if (!ready) return;

    await ensureFolderModal();
    await ensureFileConflictModal();

    setupUpload();
    setupCreateFolderButton();
    setupBackFolderButton();
    setupGlobalMenuCloser();
    setupSort();
    setupSearch();
    setupContainerDragAndDrop();

    await loadFolderContent();
}

/* =========================
   DEFAULT FOLDER
========================= */

async function loadDefaultFolder() {
    const { data, error } = await supabase
        .from("project_folders")
        .select("id, name")
        .eq("project_id", currentProject.id)
        .eq("is_default", true)
        .single();

    if (error || !data) return false;

    defaultFolderId = data.id;
    currentFolderId = data.id;
    currentFolderName = data.name || "Root Folder";

    return true;
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
            return sorted.sort((a, b) => getSize(b) - getSize(a));
        case "size_asc":
            return sorted.sort((a, b) => getSize(a) - getSize(b));
        default:
            return sorted;
    }
}

/* =========================
   LOAD CONTENT
========================= */

async function loadFolderContent() {
    const list = document.getElementById("files-list");
    const countEl = document.getElementById("files-count");

    list.innerHTML = "Loading...";

    const [{ data: folders }, { data: files }] = await Promise.all([
        supabase.from("project_folders").select("*")
            .eq("project_id", currentProject.id)
            .eq("parent_folder_id", currentFolderId),

        supabase.from("project_files").select("*")
            .eq("project_id", currentProject.id)
            .eq("folder_id", currentFolderId)
    ]);

    const safeFolders = sortByCurrentRule(
        (folders || []).filter(f => matchesSearch(f.name)),
        f => f.name,
        f => f.created_at
    );

    const safeFiles = sortByCurrentRule(
        (files || []).filter(f => matchesSearch(f.filename)),
        f => f.filename,
        f => f.created_at,
        f => f.size_bytes
    );

    const total = safeFolders.length + safeFiles.length;
    if (countEl) countEl.textContent = `${total} items`;

    list.innerHTML = "";

    safeFolders.forEach(f => list.appendChild(createFolderRow(f)));
    safeFiles.forEach(f => list.appendChild(createFileRow(f)));
}

function setupCreateFolderButton() {
    const btn = document.getElementById("files-create-folder-btn");
    if (!btn) return;

    btn.onclick = async () => {
        if (!currentFolderId) return;

        openFolderModal({
            title: "New folder",
            label: "Folder name:",
            confirmText: "Create",
            initialValue: "",
            onConfirm: async (value) => {
                try {
                    const {
                        data: { user }
                    } = await supabase.auth.getUser();

                    const { error } = await supabase
                        .from("project_folders")
                        .insert({
                        project_id: currentProject.id,
                        parent_folder_id: currentFolderId,
                        name: value,
                        created_by: user.id,
                        is_default: false
                    });

                    if (error) throw error;

                    closeFolderModal();

                    await showInfo({
                        type: "success",
                        message: "Folder created successfully."
                    });

                    await loadFolderContent();
                } catch (err) {
                    console.error("Create folder failed:", err);

                    await showInfo({
                        type: "error",
                        message: "Failed to create folder"
                    });
                }
            },
            onCancel: () => {
                closeFolderModal();
            }
        });
    };
}

/* =========================
   UPLOAD FLOW (CORE)
========================= */

function setupUpload() {
    const input = document.getElementById("files-input");
    const btn = document.getElementById("files-upload-btn");

    if (!input || !btn) return;

    btn.onclick = () => input.click();

    input.onchange = async () => {
        const files = [...input.files];

        try {
            const plans = await resolveUploadPlans(files, currentFolderId);

            for (const plan of plans) {
                if (plan.replaceExistingFileId) {
                    await deleteExistingFileById(plan.replaceExistingFileId);
                }

                await uploadSingleFileToFolder(
                    plan.file,
                    plan.folderId,
                    plan.finalFilename
                );
            }

            await loadFolderContent();
        } catch (err) {
            if (err.message !== "Upload cancelled") {
                await showInfo({ type: "error", message: err.message });
            }
        } finally {
            input.value = "";
        }
    };
}

/* =========================
   DRAG & DROP
========================= */

function setupContainerDragAndDrop() {
    const list = document.getElementById("files-list");
    if (!list) return;

    list.addEventListener("drop", async (event) => {
        if (!hasDraggedFiles(event)) return;

        event.preventDefault();

        const files = [...event.dataTransfer.files];

        try {
            const plans = await resolveUploadPlans(files, currentFolderId);

            for (const plan of plans) {
                if (plan.replaceExistingFileId) {
                    await deleteExistingFileById(plan.replaceExistingFileId);
                }

                await uploadSingleFileToFolder(
                    plan.file,
                    plan.folderId,
                    plan.finalFilename
                );
            }

            await loadFolderContent();
        } catch (err) {}
    });
}

/* =========================
   ROWS
========================= */

function createFolderRow(folder) {
    const row = document.createElement("div");
    row.textContent = folder.name;

    row.addEventListener("drop", async (event) => {
        if (!hasDraggedFiles(event)) return;

        event.preventDefault();

        const files = [...event.dataTransfer.files];

        try {
            const plans = await resolveUploadPlans(files, folder.id);

            for (const plan of plans) {
                if (plan.replaceExistingFileId) {
                    await deleteExistingFileById(plan.replaceExistingFileId);
                }

                await uploadSingleFileToFolder(
                    plan.file,
                    plan.folderId,
                    plan.finalFilename
                );
            }

            await loadFolderContent();
        } catch (err) {}
    });

    return row;
}

function createFileRow(file) {
    const row = document.createElement("div");
    row.textContent = file.filename;
    return row;
}

/* =========================
   CONFLICT LOGIC
========================= */

async function checkFileConflicts(folderId, filenames) {
    const res = await fetch("/api/project-files/check-conflicts", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
            projectId: currentProject.id,
            folderId,
            filenames
        })
    });

    const data = await res.json();
    return data.conflicts || [];
}

async function resolveUploadPlans(files, folderId) {
    const conflicts = await checkFileConflicts(folderId, files.map(f => f.name));

    const map = new Map(conflicts.map(c => [c.filename, c]));

    const plans = [];

    for (const file of files) {
        const conflict = map.get(file.name);

        if (!conflict) {
            plans.push({
                file,
                folderId,
                finalFilename: file.name,
                replaceExistingFileId: null
            });
            continue;
        }

        const choice = await openFileConflictModal({ filename: file.name });

        if (choice === "cancel") throw new Error("Upload cancelled");

        if (choice === "replace") {
            plans.push({
                file,
                folderId,
                finalFilename: file.name,
                replaceExistingFileId: conflict.existingFileId
            });
        } else {
            const renamed = file.name + " (1)";
            plans.push({
                file,
                folderId,
                finalFilename: renamed,
                replaceExistingFileId: null
            });
        }
    }

    return plans;
}

/* =========================
   UPLOAD
========================= */

async function uploadSingleFileToFolder(file, folderId, name) {
    const res = await fetch("/api/project-files/upload-url", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
            projectId: currentProject.id,
            fileName: name,
            contentType: file.type
        })
    });

    const { uploadUrl } = await res.json();

    await fetch(uploadUrl, {
        method: "PUT",
        body: file
    });
}

/* =========================
   HELPERS
========================= */

async function deleteExistingFileById(fileId) {
    await fetch("/api/project-files/delete-file", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ fileId })
    });
}

function hasDraggedFiles(event) {
    return [...(event.dataTransfer?.types || [])].includes("Files");
}

async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token || ""}`
    };
}