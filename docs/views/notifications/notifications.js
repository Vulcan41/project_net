import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";
import { createCancelButton } from "../../components/cancelButton.js";

let renderToken = 0;

function formatRelativeTime(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return "μόλις τώρα";

    const minutes = Math.floor(diff / 60);
    if (minutes === 1) return "1 λεπτό πριν";
    if (minutes < 60) return `${minutes} λεπτά πριν`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 ώρα πριν";
    if (hours < 24) return `${hours} ώρες πριν`;

    const days = Math.floor(hours / 24);
    if (days === 1) return "χθες";

    return `${days} ημέρες πριν`;
}

export async function initNotifications() {
    const currentToken = ++renderToken;

    const container = document.getElementById("notifications-list");
    const info = document.getElementById("notifications-info");

    if (!container) return;

    const {
        data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
        .from("notifications")
        .select(`
            id,
            type,
            created_at,
            project_id,
            friendship_id,
            sender:sender_id(
                id,
                username,
                full_name,
                avatar_url
            ),
            project:project_id(
                id,
                name,
                avatar_url,
                visibility
            )
        `)
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false });

    if (currentToken !== renderToken) return;

    container.innerHTML = "";

    if (error) {
        console.error("Notifications load failed:", error);
        return;
    }

    if (!data || data.length === 0) {
        if (info) {
            info.textContent = "Δεν υπάρχουν ειδοποιήσεις";
        }
        return;
    }

    updateNotificationsInfo(data.length);

    data.forEach((n) => {
        const row = document.createElement("div");

        const userBlock = createUserBlock(n);
        const divider = document.createElement("div");
        divider.className = "notification-divider";

        const text = document.createElement("div");
        text.className = "notification-text";

        const actions = document.createElement("div");
        actions.className = "notification-actions";

        const hideBtn = createCancelButton({
            label: "Απόκρυψη",
            className: "notification-hide"
        });

        const timeString = n.created_at ? formatRelativeTime(n.created_at) : "";

        if (n.type === "project_invite") {
            const displayName =
            n.sender?.full_name ||
            n.sender?.username ||
            "User";

            const projectName = n.project?.name || "project";

            text.innerHTML = `
                Ο χρήστης <strong>${escapeHtml(displayName)}</strong> σας προσκάλεσε να συμμετάσχετε στο
                <span class="notification-project-name">${escapeHtml(projectName)}</span>
                ${timeString ? `
                <span class="notification-time">
                    <span class="notification-dot">•</span>
                    ${timeString}
                </span>` : ""}
            `;

            const acceptBtn = document.createElement("button");
            acceptBtn.className = "notification-action-btn notification-accept-btn";
            acceptBtn.type = "button";
            acceptBtn.textContent = "Αποδοχή";

            const rejectBtn = document.createElement("button");
            rejectBtn.className = "notification-action-btn notification-reject-btn";
            rejectBtn.type = "button";
            rejectBtn.textContent = "Απόρριψη";

            acceptBtn.onclick = async () => {
                acceptBtn.disabled = true;
                rejectBtn.disabled = true;

                const { data, error } = await supabase.rpc("accept_project_invite", {
                    p_project_id: n.project_id
                });

                if (error) {
                    console.error("Accept project invite failed:", error);
                    acceptBtn.disabled = false;
                    rejectBtn.disabled = false;
                    return;
                }

                if (data === "accepted") {
                    await deleteNotification(n.id);
                    row.remove();
                    updateNotificationsInfoFromDom();

                    if (n.project_id) {
                        loadView("projectMember", n.project_id);
                    }
                } else {
                    acceptBtn.disabled = false;
                    rejectBtn.disabled = false;
                }
            };

            rejectBtn.onclick = async () => {
                acceptBtn.disabled = true;
                rejectBtn.disabled = true;

                const { data, error } = await supabase.rpc("decline_project_invite", {
                    p_project_id: n.project_id
                });

                if (error) {
                    console.error("Decline project invite failed:", error);
                    acceptBtn.disabled = false;
                    rejectBtn.disabled = false;
                    return;
                }

                if (data === "declined") {
                    await deleteNotification(n.id);
                    row.remove();
                    updateNotificationsInfoFromDom();
                } else {
                    acceptBtn.disabled = false;
                    rejectBtn.disabled = false;
                }
            };

            actions.appendChild(acceptBtn);
            actions.appendChild(rejectBtn);
            actions.appendChild(hideBtn);
        } else {
            const displayName =
            n.sender?.full_name ||
            n.sender?.username ||
            "User";

            text.innerHTML = `
                Ο χρήστης <strong>${escapeHtml(displayName)}</strong> αποδέχθηκε το αίτημα σύνδεσης
                ${timeString ? `
                <span class="notification-time">
                    <span class="notification-dot">•</span>
                    ${timeString}
                </span>` : ""}
            `;

            actions.appendChild(hideBtn);
        }

        hideBtn.addEventListener("click", async () => {
            const deleted = await deleteNotification(n.id);
            if (!deleted) return;

            row.remove();
            updateNotificationsInfoFromDom();
        });

        row.appendChild(userBlock);
        row.appendChild(divider);
        row.appendChild(text);
        row.appendChild(actions);

        container.appendChild(row);
    });
}

function createUserBlock(notification) {
    const userBlock = document.createElement("div");
    userBlock.className = "notification-user";

    const avatar = document.createElement("img");
    avatar.className = "notification-avatar";
    avatar.src = notification.sender?.avatar_url || DEFAULT_AVATAR;

    avatar.onerror = () => {
        avatar.src = DEFAULT_AVATAR;
    };

    const nameContainer = document.createElement("div");
    nameContainer.className = "notification-name";

    const name = document.createElement("div");
    name.textContent =
    notification.sender?.full_name ||
    notification.sender?.username ||
    "User";

    const handle = document.createElement("div");
    handle.className = "notification-handle";
    handle.textContent = "@" + (notification.sender?.username ?? "user");

    nameContainer.appendChild(name);
    nameContainer.appendChild(handle);

    userBlock.appendChild(avatar);
    userBlock.appendChild(nameContainer);

    const tooltip = document.createElement("div");
    tooltip.className = "notification-tooltip";
    tooltip.textContent = "Προβολή προφίλ";

    userBlock.appendChild(tooltip);

    if (notification.sender?.id) {
        userBlock.addEventListener("click", () => {
            loadView("profileOther", notification.sender.id);
        });
    }

    userBlock.addEventListener("mouseenter", () => {
        tooltip.classList.add("tooltip-visible");
    });

    userBlock.addEventListener("mouseleave", () => {
        tooltip.classList.remove("tooltip-visible");
    });

    return userBlock;
}

async function deleteNotification(notificationId) {
    const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

    if (error) {
        console.error("Failed to delete notification:", error);
        return false;
    }

    return true;
}

function updateNotificationsInfo(count) {
    const info = document.getElementById("notifications-info");
    if (!info) return;

    if (count === 0) {
        info.textContent = "Δεν υπάρχουν ειδοποιήσεις";
    } else if (count === 1) {
        info.textContent = "1 ειδοποίηση";
    } else {
        info.textContent = `${count} ειδοποιήσεις`;
    }
}

function updateNotificationsInfoFromDom() {
    const remaining = document.querySelectorAll("#notifications-list > div").length;
    updateNotificationsInfo(remaining);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}