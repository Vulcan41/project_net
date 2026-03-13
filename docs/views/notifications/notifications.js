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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from("notifications")
        .select(`
            id,
            created_at,
            sender:sender_id(
                id,
                username,
                full_name,
                avatar_url
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

    if (info) {
        info.textContent =
        data.length === 1
        ? "1 ειδοποίηση"
        : `${data.length} ειδοποιήσεις`;
    }

    data.forEach(n => {

        const row = document.createElement("div");

        const userBlock = document.createElement("div");
        userBlock.className = "notification-user";
        userBlock.style.cursor = "pointer";

        const avatar = document.createElement("img");
        avatar.className = "notification-avatar";
        avatar.src = n.sender?.avatar_url || DEFAULT_AVATAR;

        const nameContainer = document.createElement("div");
        nameContainer.className = "notification-name";

        const name = document.createElement("div");
        name.textContent =
        n.sender?.full_name ||
        n.sender?.username ||
        "User";

        const handle = document.createElement("div");
        handle.className = "notification-handle";
        handle.textContent =
        "@" + (n.sender?.username ?? "user");

        nameContainer.appendChild(name);
        nameContainer.appendChild(handle);

        userBlock.appendChild(avatar);
        userBlock.appendChild(nameContainer);

        const tooltip = document.createElement("div");
        tooltip.className = "notification-tooltip";
        tooltip.textContent = "Προβολή προφίλ";

        userBlock.appendChild(tooltip);

        userBlock.addEventListener("click", () => {
            loadView("profileOther", n.sender.id);
        });

        userBlock.addEventListener("mouseenter", () => {
            tooltip.classList.add("tooltip-visible");
        });

        userBlock.addEventListener("mouseleave", () => {
            tooltip.classList.remove("tooltip-visible");
        });

        const divider = document.createElement("div");
        divider.className = "notification-divider";

        const text = document.createElement("div");
        text.className = "notification-text";

        const displayName =
        n.sender?.full_name ||
        n.sender?.username ||
        "User";

        const timeString = n.created_at
        ? formatRelativeTime(n.created_at)
        : "";

        text.innerHTML =
        `Ο χρήστης <strong>${displayName}</strong> αποδέχθηκε το αίτημα σύνδεσης
    ${timeString ? `
    <span class="notification-time">
        <span class="notification-dot">•</span>
        ${timeString}
    </span>` : ""}`;

        /* ACTION BUTTON */

        const hideBtn = createCancelButton({
            label: "Απόκρυψη",
            className: "notification-hide"
        });

        /* DELETE NOTIFICATION */

        hideBtn.addEventListener("click", async () => {

            const { error } = await supabase
                .from("notifications")
                .delete()
                .eq("id", n.id);

            if (error) {
                console.error("Failed to delete notification:", error);
                return;
            }

            row.remove();

            const info = document.getElementById("notifications-info");
            const remaining = document.querySelectorAll("#notifications-list > div").length;

            if (remaining === 0) {
                info.textContent = "Δεν υπάρχουν ειδοποιήσεις";
            }
            else if (remaining === 1) {
                info.textContent = "1 ειδοποίηση";
            }
            else {
                info.textContent = `${remaining} ειδοποιήσεις`;
            }

        });

        row.appendChild(userBlock);
        row.appendChild(divider);
        row.appendChild(text);
        row.appendChild(hideBtn);

        container.appendChild(row);

    });

}