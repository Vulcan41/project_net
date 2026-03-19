import { uploadFile, listMyFiles, getDownloadUrl, deleteFile } from "../../services/storage/storageApi.js";

export async function initTestCloud() {
    const fileInput = document.getElementById("fileInput");
    const uploadBtn = document.getElementById("uploadBtn");
    const fileList = document.getElementById("fileList");

    uploadBtn.addEventListener("click", async () => {
        try {
            const file = fileInput.files[0];

            if (!file) {
                alert("Please select a file first.");
                return;
            }

            uploadBtn.disabled = true;
            uploadBtn.textContent = "Uploading...";

            const result = await uploadFile(file);
            console.log("Upload complete:", result);

            fileInput.value = "";
            await refreshFiles();
        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = "Upload File";
        }
    });

    async function refreshFiles() {
        const files = await listMyFiles();

        fileList.innerHTML = "";

        if (!files.length) {
            fileList.innerHTML = "<p>No files yet.</p>";
            return;
        }

        for (const file of files) {

            const div = document.createElement("div");
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";

            const name = document.createElement("span");
            name.style.cursor = "pointer";
            name.textContent = `${file.filename} (${file.size_bytes} bytes)`;

            name.addEventListener("click", async () => {
                try {
                    const downloadUrl = await getDownloadUrl(file.id);
                    window.open(downloadUrl, "_blank");
                } catch (err) {
                    console.error(err);
                    alert("Failed to open file.");
                }
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";

            deleteBtn.addEventListener("click", async () => {

                if (!confirm("Delete this file?")) return;

                try {

                    await deleteFile(file.id);
                    await refreshFiles();

                } catch (err) {

                    console.error(err);
                    alert("Failed to delete file");

                }

            });

            div.appendChild(name);
            div.appendChild(deleteBtn);

            fileList.appendChild(div);
        }
    }

    await refreshFiles();
}