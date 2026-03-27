let batchModalInitialized = false;
let batchResolveHandler = null;

export async function ensureFileConflictsBatchModal() {
    if (batchModalInitialized || document.getElementById("file-conflicts-batch-modal")) {
        batchModalInitialized = true;
        bindBatchModalEvents();
        return;
    }

    const htmlPath = "./components/fileConflictsBatchModal/fileConflictsBatchModal.html";
    const cssPath = "./components/fileConflictsBatchModal/fileConflictsBatchModal.css";

    const res = await fetch(htmlPath);
    const html = await res.text();

    document.body.insertAdjacentHTML("beforeend", html);

    if (!document.getElementById("file-conflicts-batch-modal-css")) {
        const link = document.createElement("link");
        link.id = "file-conflicts-batch-modal-css";
        link.rel = "stylesheet";
        link.href = cssPath;
        document.head.appendChild(link);
    }

    batchModalInitialized = true;
    bindBatchModalEvents();
}

function bindBatchModalEvents() {
    const modal = document.getElementById("file-conflicts-batch-modal");
    if (!modal || modal.dataset.bound === "true") return;

    const backdrop = modal.querySelector(".file-conflicts-batch-backdrop");
    const cancelBtn = document.getElementById("file-conflicts-batch-cancel");
    const continueBtn = document.getElementById("file-conflicts-batch-continue");
    const replaceAllBtn = document.getElementById("file-conflicts-batch-replace-all");
    const renameAllBtn = document.getElementById("file-conflicts-batch-rename-all");
    const skipAllBtn = document.getElementById("file-conflicts-batch-skip-all");

    backdrop?.addEventListener("click", () => {
        resolveBatchModal(null);
    });

    cancelBtn?.addEventListener("click", () => {
        resolveBatchModal(null);
    });

    continueBtn?.addEventListener("click", () => {
        const list = document.getElementById("file-conflicts-batch-list");
        const selects = list?.querySelectorAll(".file-conflict-select") || [];

        const decisions = {};

        selects.forEach((select) => {
            const filename = select.getAttribute("data-filename");
            if (!filename) return;
            decisions[filename] = select.value;
        });

        resolveBatchModal(decisions);
    });

    replaceAllBtn?.addEventListener("click", () => {
        setAllBatchSelections("replace");
    });

    renameAllBtn?.addEventListener("click", () => {
        setAllBatchSelections("rename");
    });

    skipAllBtn?.addEventListener("click", () => {
        setAllBatchSelections("skip");
    });

    document.addEventListener("keydown", (event) => {
        const modalEl = document.getElementById("file-conflicts-batch-modal");
        if (!modalEl || modalEl.classList.contains("hidden")) return;

        if (event.key === "Escape") {
            event.preventDefault();
            resolveBatchModal(null);
        }
    });

    modal.dataset.bound = "true";
}

function setAllBatchSelections(value) {
    const list = document.getElementById("file-conflicts-batch-list");
    const selects = list?.querySelectorAll(".file-conflict-select") || [];
    selects.forEach((select) => {
        select.value = value;
    });
}

function resolveBatchModal(result) {
    if (typeof batchResolveHandler === "function") {
        batchResolveHandler(result);
    }
    closeFileConflictsBatchModal();
}

function createConflictRow(conflict) {
    const row = document.createElement("div");
    row.className = "file-conflict-row";

    const left = document.createElement("div");
    left.className = "file-conflict-left";

    const iconWrap = document.createElement("div");
    iconWrap.className = "file-conflict-icon";

    const img = document.createElement("img");
    img.src = getFileIcon({ filename: conflict.filename });
    img.alt = "file";
    img.className = "file-conflict-icon-img";

    iconWrap.appendChild(img);

    const name = document.createElement("div");
    name.className = "file-conflict-name";
    name.textContent = conflict.filename;
    name.title = conflict.filename;

    left.appendChild(iconWrap);
    left.appendChild(name);

    const select = document.createElement("select");
    select.className = "file-conflict-select";
    select.setAttribute("data-filename", conflict.filename);

    select.innerHTML = `
        <option value="rename">Keep both and rename</option>
        <option value="replace">Replace existing</option>
        <option value="skip">Skip</option>
    `;

    row.appendChild(left);
    row.appendChild(select);

    return { row, select };
}

export function openFileConflictsBatchModal(conflicts = []) {
    const modal = document.getElementById("file-conflicts-batch-modal");
    const subtitle = document.getElementById("file-conflicts-batch-subtitle");
    const list = document.getElementById("file-conflicts-batch-list");

    if (!modal || !subtitle || !list) {
        return Promise.resolve(null);
    }

    subtitle.textContent =
    conflicts.length === 1
    ? "This file already exists. Choose what to do before continuing."
    : "These files already exist. Choose what to do for each one before continuing.";

    list.innerHTML = "";

    conflicts.forEach((conflict) => {
        const { row } = createConflictRow(conflict);
        list.appendChild(row);
    });

    modal.classList.remove("hidden");

    return new Promise((resolve) => {
        batchResolveHandler = resolve;
    });
}

export function closeFileConflictsBatchModal() {
    const modal = document.getElementById("file-conflicts-batch-modal");
    if (!modal) return;

    modal.classList.add("hidden");
    batchResolveHandler = null;
}

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

function getFileExtension(filename) {
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
}