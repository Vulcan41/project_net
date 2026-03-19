import { createCancelButton } from "../../components/cancelButton.js";
import { openModal, closeModal } from "../../components/modal.js";
import { showInfo } from "../../components/info.js";
import {
uploadFile,
listMyFiles,
getDownloadUrl,
deleteFile
} from "../../services/storage/storageApi.js";

export async function initCloud() {
    const fileInput = document.getElementById("fileInput");
    const fileList = document.getElementById("fileList");
    const filesCount = document.getElementById("cloudFilesCount");
    const uploadBox = document.querySelector(".cloud-upload-box");

    let selectedFile = null;

    uploadBox?.addEventListener("click", () => {
        fileInput?.click();
    });

    fileInput?.addEventListener("change", async () => {
        selectedFile = fileInput.files?.[0] || null;

        if (!selectedFile) return;

        askToUploadFile(selectedFile);
    });

    async function askToUploadFile(file) {
        openModal({
            message: `Θέλεις να ανεβάσεις το αρχείο "${file.name}";`,

            // swap labels
            cancelText: "Ανέβασμα",
            confirmText: "Ακύρωση",

            // confirm button now acts as cancel
            onConfirm: () => {}
        });

        const confirmBtn = document.getElementById("app-modal-confirm");
        const cancelBtn = document.getElementById("app-modal-cancel");

        // LEFT button (cancelBtn) → acts as upload
        cancelBtn.onclick = async () => {
            try {
                await uploadFile(file);
                console.log("Η μεταφόρτωση ολοκληρώθηκε:", file.name);

                fileInput.value = "";
                selectedFile = null;

                await refreshFiles();

                showInfo({
                    type: "success",
                    title: "Μεταφόρτωση",
                    message: `Το αρχείο ανέβηκε επιτυχώς.`
                });
            } catch (err) {
                console.error(err);
                alert(err.message);
            } finally {
                closeModal();
            }
        };
    }

    async function refreshFiles() {
        const files = await listMyFiles();

        updateStorageUsage(files);

        fileList.innerHTML = "";

        if (filesCount) {
            filesCount.textContent = `${files.length} ${files.length === 1 ? "αρχείο" : "αρχεία"}`;
        }

        if (!files.length) {
            fileList.innerHTML = `<div class="cloud-empty">Δεν υπάρχουν αρχεία ακόμη.</div>`;
            return;
        }

        for (const file of files) {
            fileList.appendChild(createFileRow(file));
        }
    }

    function updateStorageUsage(files) {
        const storageText = document.getElementById("cloudStorageText");
        const storagePercent = document.getElementById("cloudStoragePercent");
        const storageRing = document.getElementById("cloudStorageRing");

        const totalLimitBytes = 1 * 1024 * 1024 * 1024; // 1 GB

        const usedBytes = files.reduce((sum, file) => {
            return sum + (Number(file.size_bytes) || 0);
        }, 0);

        const percent = Math.min((usedBytes / totalLimitBytes) * 100, 100);
        const roundedPercent = Math.round(percent);

        if (storageText) {
            storageText.textContent = `${formatFileSize(usedBytes)} / 1 GB`;
        }

        if (storagePercent) {
            storagePercent.textContent = `${roundedPercent}%`;
        }

        if (storageRing) {
            storageRing.style.setProperty("--progress", `${percent}%`);
        }
    }

    function createFileRow(file) {
        const row = document.createElement("div");
        row.className = "cloud-file-row";

        const main = document.createElement("div");
        main.className = "cloud-file-main";

        const icon = document.createElement("div");
        icon.className = "cloud-file-icon";

        const img = document.createElement("img");
        img.src = getFileIcon(file);
        img.alt = "file";
        img.className = "cloud-file-icon-img";

        icon.appendChild(img);

        const meta = document.createElement("div");
        meta.className = "cloud-file-meta";

        const name = document.createElement("div");
        name.className = "cloud-file-name";
        name.textContent = file.filename;
        name.title = file.filename;

        name.addEventListener("click", async () => {
            try {
                const downloadUrl = await getDownloadUrl(file.id);
                window.open(downloadUrl, "_blank");
            } catch (err) {
                console.error(err);
                alert("Αποτυχία ανοίγματος αρχείου.");
            }
        });

        const sub = document.createElement("div");
        sub.className = "cloud-file-sub";
        sub.textContent = `${formatFileSize(file.size_bytes)} • ${formatDate(file.created_at)}`;

        meta.appendChild(name);
        meta.appendChild(sub);

        main.appendChild(icon);
        main.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "cloud-file-actions";

        const deleteBtn = createCancelButton({
            label: "Διαγραφή αρχείου",
            text: "×",
            onClick: async () => {
                openModal({
                    message: `Να διαγραφεί το "${file.filename}";`,
                    cancelText: "Ακύρωση",
                    confirmText: "Διαγραφή",
                    onConfirm: async () => {
                        try {
                            await deleteFile(file.id);
                            await refreshFiles();

                            showInfo({
                                type: "success",
                                title: "Διαγραφή",
                                message: `Το αρχείο διαγράφηκε επιτυχώς.`
                            });
                        } catch (err) {
                            console.error(err);
                            alert("Αποτυχία διαγραφής αρχείου.");
                        }
                    }
                });
            }
        });

        actions.appendChild(deleteBtn);

        row.appendChild(main);
        row.appendChild(actions);

        return row;
    }

    function formatFileSize(bytes) {
        if (bytes == null || isNaN(bytes)) return "Άγνωστο μέγεθος";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    function formatDate(dateString) {
        if (!dateString) return "Άγνωστη ημερομηνία";

        const date = new Date(dateString);

        return date.toLocaleDateString("el-GR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

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

    await refreshFiles();

    /* =========================
       DRAG & DROP UPLOAD
    ========================= */

    const dropZone = document.querySelector(".cloud-upload-card");

    if (dropZone) {
        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("drag-active");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("drag-active");
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("drag-active");

            const file = e.dataTransfer.files?.[0];
            if (!file) return;

            selectedFile = file;

            if (fileInput) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
            }

            askToUploadFile(file);
        });
    }
}
