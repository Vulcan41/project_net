let initialized = false;
let resolveHandler = null;

export async function ensureFileConflictModal() {
    if (initialized || document.getElementById("file-conflict-modal")) {
        initialized = true;
        bindEvents();
        return;
    }

    const htmlPath = "./components/fileConflictModal/fileConflictModal.html";
    const cssPath = "./components/fileConflictModal/fileConflictModal.css";

    const res = await fetch(htmlPath);
    const html = await res.text();

    document.body.insertAdjacentHTML("beforeend", html);

    if (!document.getElementById("file-conflict-modal-css")) {
        const link = document.createElement("link");
        link.id = "file-conflict-modal-css";
        link.rel = "stylesheet";
        link.href = cssPath;
        document.head.appendChild(link);
    }

    initialized = true;
    bindEvents();
}

function bindEvents() {
    const modal = document.getElementById("file-conflict-modal");
    if (!modal || modal.dataset.bound === "true") return;

    const backdrop = modal.querySelector(".file-conflict-modal-backdrop");
    const cancelBtn = document.getElementById("file-conflict-modal-cancel");
    const renameBtn = document.getElementById("file-conflict-modal-rename");
    const replaceBtn = document.getElementById("file-conflict-modal-replace");

    backdrop?.addEventListener("click", () => resolveChoice("cancel"));
    cancelBtn?.addEventListener("click", () => resolveChoice("cancel"));
    renameBtn?.addEventListener("click", () => resolveChoice("rename"));
    replaceBtn?.addEventListener("click", () => resolveChoice("replace"));

    document.addEventListener("keydown", (event) => {
        if (modal.classList.contains("hidden")) return;

        if (event.key === "Escape") {
            event.preventDefault();
            resolveChoice("cancel");
        }
    });

    modal.dataset.bound = "true";
}

function resolveChoice(choice) {
    if (typeof resolveHandler === "function") {
        resolveHandler(choice);
    }
    closeFileConflictModal();
}

export function openFileConflictModal({ filename }) {
    const modal = document.getElementById("file-conflict-modal");
    const message = document.getElementById("file-conflict-modal-message");

    if (!modal || !message) {
        return Promise.resolve("cancel");
    }

    message.textContent =
    `A file named "${filename}" already exists in this folder. ` +
    `You can replace the existing file or keep both by renaming the new one.`;

    modal.classList.remove("hidden");

    return new Promise((resolve) => {
        resolveHandler = resolve;
    });
}

export function closeFileConflictModal() {
    const modal = document.getElementById("file-conflict-modal");
    if (!modal) return;

    modal.classList.add("hidden");
    resolveHandler = null;
}