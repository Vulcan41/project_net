import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";

let currentProject = null;
let currentUser = null;

export async function initProjectOther(projectId) {
    setupBackButton();

    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError) {
        console.error("Error getting user:", userError);
    }

    currentUser = user;

    if (!projectId) {
        showError("Δεν βρέθηκε project id.");
        return;
    }

    await loadProject(projectId);
    setupRequestButton();
    await refreshRequestState();
}

function setupBackButton() {
    const backBtn = document.getElementById("project-other-back-btn");
    if (!backBtn) return;

    backBtn.onclick = () => {
        loadView("basic");
    };
}

async function loadProject(projectId) {
    const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, owner_id, visibility, status, created_at")
        .eq("id", projectId)
        .single();

    if (error) {
        console.error("Error loading projectOther:", error);
        showError("Αποτυχία φόρτωσης project.");
        return;
    }

    if (!data) {
        showError("Το project δεν βρέθηκε.");
        return;
    }

    currentProject = data;
    renderProject(data);
}

function renderProject(project) {
    const title = document.getElementById("project-other-title");
    const description = document.getElementById("project-other-description");
    const owner = document.getElementById("project-other-owner");
    const created = document.getElementById("project-other-created");
    const visibility = document.getElementById("project-other-visibility");
    const status = document.getElementById("project-other-status");
    const meta = document.getElementById("project-other-meta");

    if (title) title.textContent = project.name ?? "Untitled project";

    if (description) {
        description.textContent = project.description || "Χωρίς περιγραφή.";
    }

    if (owner) owner.textContent = `Owner: ${project.owner_id}`;

    if (created) {
        const date = project.created_at
        ? new Date(project.created_at).toLocaleString()
        : "-";
        created.textContent = `Created: ${date}`;
    }

    if (visibility) visibility.textContent = `Visibility: ${project.visibility}`;
    if (status) status.textContent = `Status: ${project.status}`;

    if (meta) meta.classList.remove("hidden");
}

function setupRequestButton() {
    const btn = document.getElementById("project-request-btn");
    if (!btn) return;

    btn.onclick = async () => {
        if (!currentProject?.id || !currentUser?.id) return;

        btn.disabled = true;
        clearRequestMessage();

        try {
            const { data: existing, error: existingError } = await supabase
                .from("project_members")
                .select("id, membership_status")
                .eq("project_id", currentProject.id)
                .eq("user_id", currentUser.id)
                .maybeSingle();

            if (existingError) throw existingError;

            if (existing) {
                if (existing.membership_status === "active") {
                    showRequestMessage("You are already a member.");
                    await refreshRequestState();
                    return;
                }

                if (existing.membership_status === "pending") {
                    showRequestMessage("Your request is already pending.");
                    await refreshRequestState();
                    return;
                }

                if (existing.membership_status === "removed") {
                    const { error: updateError } = await supabase
                        .from("project_members")
                        .update({ membership_status: "pending" })
                        .eq("id", existing.id);

                    if (updateError) throw updateError;

                    showRequestMessage("Join request sent again.");
                    await refreshRequestState();
                    return;
                }
            }

            const { error: insertError } = await supabase
                .from("project_members")
                .insert([
                {
                    project_id: currentProject.id,
                    user_id: currentUser.id,
                    role: "member",
                    membership_status: "pending"
                }
            ]);

            if (insertError) throw insertError;

            showRequestMessage("Join request sent.");
            await refreshRequestState();
        } catch (error) {
            console.error("Request to join failed:", error);
            showRequestMessage("Failed to send request.");
            await refreshRequestState();
        }
    };
}

async function refreshRequestState() {
    const btn = document.getElementById("project-request-btn");
    if (!btn || !currentProject?.id || !currentUser?.id) return;

    const { data, error } = await supabase
        .from("project_members")
        .select("membership_status")
        .eq("project_id", currentProject.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (error) {
        console.error("Error checking request state:", error);
        btn.textContent = "Request to join";
        btn.disabled = false;
        return;
    }

    if (!data) {
        btn.textContent = "Request to join";
        btn.disabled = false;
        return;
    }

    if (data.membership_status === "pending") {
        btn.textContent = "Request pending";
        btn.disabled = true;
        return;
    }

    if (data.membership_status === "active") {
        btn.textContent = "Already a member";
        btn.disabled = true;
        return;
    }

    if (data.membership_status === "removed") {
        btn.textContent = "Request again";
        btn.disabled = false;
        return;
    }

    btn.textContent = "Request to join";
    btn.disabled = false;
}

function showRequestMessage(message) {
    const box = document.getElementById("project-request-message");
    if (!box) return;

    box.textContent = message;
    box.classList.remove("hidden");
}

function clearRequestMessage() {
    const box = document.getElementById("project-request-message");
    if (!box) return;

    box.textContent = "";
    box.classList.add("hidden");
}

function showError(message) {
    const errorBox = document.getElementById("project-other-error");
    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}