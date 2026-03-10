import { supabase } from "../../core/supabase.js";

export async function initFriends() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const container = document.getElementById("friend-requests");
    if (!container) return;

    /* load pending requests */

    const { data: requests, error } = await supabase
        .from("friendships")
        .select(`
        id,
        requester_id,
        profiles!friendships_requester_id_fkey(username)
    `)
        .eq("receiver_id", user.id)
        .eq("status", "pending");

    if (error) {
        console.error("Failed to load friend requests:", error);
        return;
    }

    container.innerHTML = "";

    if (!requests || requests.length === 0) {
        container.textContent = "No friend requests.";
        return;
    }

    requests.forEach(req => {

        const row = document.createElement("div");

        const text = document.createElement("span");
        text.textContent = `${req.profiles.username} θέλει να γίνει φίλος`;

        const acceptBtn = document.createElement("button");
        acceptBtn.textContent = "Αποδοχή";

        const declineBtn = document.createElement("button");
        declineBtn.textContent = "Απόρριψη";

        /* accept */

        acceptBtn.addEventListener("click", async () => {

            await supabase
                .from("friendships")
                .update({ status: "accepted" })
                .eq("id", req.id);

            row.remove();

        });

        /* decline */

        declineBtn.addEventListener("click", async () => {

            await supabase
                .from("friendships")
                .delete()
                .eq("id", req.id);

            row.remove();

        });

        row.appendChild(text);
        row.appendChild(acceptBtn);
        row.appendChild(declineBtn);

        container.appendChild(row);

    });

}