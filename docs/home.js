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





