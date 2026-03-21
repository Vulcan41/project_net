import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";
import { projectStore } from "../../state/projectStore.js";
import { initModal, openModal } from "../../components/modal.js";

let currentProject = null;

export async function initProject(projectId) {
    if (!projectId) {
        console.error("No project id");
        return;
    }

    await initModal();

    const loaded = await projectStore.load(projectId);

    if (!loaded?.project) {
        console.error("Error loading project store.");
        return;
    }

    currentProject = loaded.project;

    console.log("PROJECT INIT currentProject:", currentProject);
    console.log("PROJECT INIT currentProject.id:", currentProject?.id);

    renderSidebar();
    await loadOwnerInfo();
    setupSidebar();
    setupDeleteProject();
    setupAvatarUpload();
    loadSection("overview");
}




function setupDeleteProject() {
    const deleteBtn = document.getElementById("project-delete-btn");
    if (!deleteBtn || !currentProject?.id) return;

    deleteBtn.onclick = () => {
        openModal({
            message: "Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το project;",
            cancelText: "Ακύρωση",
            confirmText: "Διαγραφή",
            onConfirm: async () => {
                const { error } = await supabase
                    .from("projects")
                    .delete()
                    .eq("id", currentProject.id);

                if (error) {
                    console.error("Project delete failed:", error);
                    return;
                }

                projectStore.clear();
                loadView("basic");
            }
        });
    };
}

/* =========================
   SIDEBAR
========================= */

function renderSidebar() {
    const title = document.getElementById("project-sidebar-title");
    const subtitle = document.getElementById("project-sidebar-subtitle");
    const role = document.getElementById("project-sidebar-role");

    if (title) {
        const avatarMarkup = currentProject.avatar_url
        ? `
                <img
                    src="${currentProject.avatar_url}"
                    alt="${escapeHtml(currentProject.name)} avatar"
                    class="project-sidebar-avatar-image"
                />
            `
        : `
                <span class="project-sidebar-avatar-fallback">
                    ${escapeHtml(currentProject.name.charAt(0).toUpperCase())}
                </span>
            `;

        title.innerHTML = `
    <div class="project-sidebar-title-row">
        <div class="project-sidebar-avatar">
            ${avatarMarkup}
        </div>

        <div class="project-sidebar-title-block">
            <div class="project-sidebar-title-text">
                ${escapeHtml(currentProject.name)}
            </div>

            <div class="project-sidebar-meta">
                <span class="project-sidebar-pill ${
                    currentProject.visibility === "public"
                        ? "project-sidebar-pill-public"
                        : "project-sidebar-pill-private"
                }">
                    ${escapeHtml(currentProject.visibility)}
                </span>

                <span class="project-sidebar-pill project-sidebar-pill-owner">
                    owner
                </span>
            </div>
        </div>
    </div>

    <div class="project-sidebar-owner" id="project-sidebar-owner">
    <div class="project-sidebar-owner-label">A project by:</div>

    <div class="project-sidebar-owner-row">
        <div class="project-sidebar-owner-avatar"></div>
        <div class="project-sidebar-owner-username">Loading...</div>
    </div>
</div>
`;
    }

    if (subtitle) {
        subtitle.textContent = "";
    }

    if (role) {
        role.textContent = "";
    }
}

async function loadOwnerInfo() {
    const avatarEl = document.querySelector(".project-sidebar-owner-avatar");
    const usernameEl = document.querySelector(".project-sidebar-owner-username");

    if (!avatarEl || !usernameEl || !currentProject?.owner_id) return;

    const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", currentProject.owner_id)
        .single();

    if (error) {
        console.error("Owner load error:", error);
        usernameEl.textContent = "Unknown";
        return;
    }

    const avatar = data.avatar_url
    ? `<img src="${data.avatar_url}" />`
    : `<span>${escapeHtml((data.username || "U")[0].toUpperCase())}</span>`;

    avatarEl.innerHTML = avatar;
    usernameEl.textContent = data.username || "User";
}

function setupSidebar() {
    const buttons = document.querySelectorAll(".project-menu-btn");

    buttons.forEach((btn) => {
        btn.onclick = () => {
            setActiveButton(btn);
            const section = btn.dataset.section;
            loadSection(section);
        };
    });
}

function setActiveButton(activeBtn) {
    document.querySelectorAll(".project-menu-btn").forEach((btn) => {
        btn.classList.remove("active");
    });

    activeBtn.classList.add("active");
}

/* =========================
   AVATAR UPLOAD
========================= */

function setupAvatarUpload() {
    const uploadBtn = document.getElementById("project-upload-avatar-btn");
    const fileInput = document.getElementById("project-avatar-input");

    console.log("AVATAR SETUP uploadBtn exists:", !!uploadBtn);
    console.log("AVATAR SETUP fileInput exists:", !!fileInput);
    console.log("AVATAR SETUP currentProject:", currentProject);
    console.log("AVATAR SETUP currentProject.id:", currentProject?.id);

    if (!uploadBtn || !fileInput || !currentProject?.id) return;

    uploadBtn.onclick = () => {
        console.log("UPLOAD BUTTON clicked");
        fileInput.click();
    };

    fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        try {
            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser();

            console.log("UPLOAD AUTH user:", user);
            console.log("UPLOAD AUTH userError:", userError);

            const ext = file.name.split(".").pop()?.toLowerCase() || "png";
            const filePath = `${currentProject.id}/avatar.${ext}`;

            console.log("UPLOAD FILE name:", file.name);
            console.log("UPLOAD FILE ext:", ext);
            console.log("UPLOAD PROJECT ID:", currentProject.id);
            console.log("UPLOAD PATH:", filePath);

            const { error: uploadError, data: uploadData } = await supabase.storage
                .from("project-avatars")
                .upload(filePath, file, {
                upsert: true
            });

            console.log("UPLOAD RESULT data:", uploadData);
            console.log("UPLOAD RESULT error:", uploadError);

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from("project-avatars")
                .getPublicUrl(filePath);

            console.log("PUBLIC URL data:", publicData);

            const publicUrl = publicData?.publicUrl;
            if (!publicUrl) {
                throw new Error("Could not get public URL.");
            }

            const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

            console.log("CACHE BUSTED URL:", cacheBustedUrl);

            const { error: updateError, data: updateData } = await supabase
                .from("projects")
                .update({ avatar_url: cacheBustedUrl })
                .eq("id", currentProject.id);

            console.log("PROJECT UPDATE data:", updateData);
            console.log("PROJECT UPDATE error:", updateError);

            if (updateError) throw updateError;

            projectStore.setAvatarUrl(cacheBustedUrl);
            currentProject.avatar_url = cacheBustedUrl;
            renderSidebar();

            fileInput.value = "";
        } catch (error) {
            console.error("Project avatar upload failed:", error);
        }
    };
}

/* =========================
   LOAD SECTION (INTERNAL VIEW)
========================= */

async function loadSection(section) {
    const container = document.getElementById("project-body-content");
    if (!container) return;

    const htmlPath = `./views/project/${section}/${section}.html`;
    const jsPath = `./${section}/${section}.js`;
    const cssPath = `./views/project/${section}/${section}.css`;

    const res = await fetch(htmlPath);
    const html = await res.text();
    container.innerHTML = html;

    const oldCss = document.getElementById("project-section-css");
    if (oldCss) oldCss.remove();

    const link = document.createElement("link");
    link.id = "project-section-css";
    link.rel = "stylesheet";
    link.href = cssPath;
    document.head.appendChild(link);

    try {
        const module = await import(jsPath);

        const initFunction =
        "init" + section.charAt(0).toUpperCase() + section.slice(1);

        if (module[initFunction]) {
            module[initFunction](currentProject);
        }
    } catch (err) {
        console.error("Section load error:", err);
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}