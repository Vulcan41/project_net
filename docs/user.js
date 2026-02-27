import { supabase } from "./supabase.js";

/* ---------- LOAD PROFILE ---------- */

export async function loadProfile() {

    const { data: userData } =
    await supabase.auth.getUser();

    const user = userData.user;
    if (!user) return;

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    /* ---------- PROFILE PREVIEW ---------- */

    document.getElementById("show-name")?.textContent =
    data.full_name || "";

    document.getElementById("show-username")?.textContent =
    data.username || "";

    document.getElementById("show-bio")?.textContent =
    data.bio || "";

    /* ---------- FORM AUTOFILL ---------- */

    document.getElementById("test-name")?.value =
    data.full_name || "";

    document.getElementById("test-username")?.value =
    data.username || "";

    document.getElementById("test-bio")?.value =
    data.bio || "";

    /* ---------- HEADER: CREDITS ---------- */

    document.getElementById("credits-value")?.textContent =
    data.credits ?? 0;

    /* ---------- AVATAR ---------- */

    document.getElementById("avatar-preview")?.src =
    data.avatar_url || "";
}

/* ---------- SAVE PROFILE ---------- */

export async function setupSaveProfile() {

    const saveBtn = document.getElementById("save-profile");

    saveBtn?.addEventListener("click", async () => {

        const { data: userData } =
        await supabase.auth.getUser();

        const user = userData.user;
        if (!user) return;

        const full_name =
        document.getElementById("test-name").value;

        const username =
        document.getElementById("test-username").value;

        const bio =
        document.getElementById("test-bio").value;

        const { error } = await supabase
            .from("profiles")
            .upsert({
            id: user.id,
            full_name,
            username,
            bio
        });

        if (error) {
            console.error("SAVE ERROR:", error);
            alert(error.message);   // ⭐ show real message
            return;
        }

        alert("Profile saved!");

        await loadProfile();
    });
}