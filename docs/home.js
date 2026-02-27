import { supabase } from "./supabase.js";

/* ---------- SESSION CHECK ---------- */

const {
    data: { session }
} = await supabase.auth.getSession();

if (!session) {
    window.location.href = "index.html";
}

/* ---------- LOAD CREDITS ---------- */

async function loadCredits() {

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) return;

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Credits error:", error);
        return;
    }

    document.getElementById("credits-value").textContent =
    profile?.credits ?? 0;
}

loadCredits();

/* ---------- LOGOUT ---------- */

document.getElementById("logout-btn")
    .addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

/* ---------- MAIN CONTENT ---------- */

const main = document.getElementById("main-content");






const uploadInput = document.getElementById("avatar-upload");

uploadInput.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    const filePath = `${user.id}/${file.name}`;

    /* upload to storage */
    const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

    if (error) {
        console.error(error);
        return;
    }

    /* get public URL */
    const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

    const avatarUrl = data.publicUrl;

    /* save URL in profile */
    await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

    /* show preview */
    document.getElementById("avatar-preview").src = avatarUrl;
});