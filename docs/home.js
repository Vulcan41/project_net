import { supabase } from "./supabase.js";

/* ---------- SESSION CHECK ---------- */

const {
    data: { session }
} = await supabase.auth.getSession();

if (!session) {
    window.location.href = "index.html";
}

const { data: userData } = await supabase.auth.getUser();
const user = userData.user;

const { data: profile } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

document.getElementById("credits-indicator").textContent =
"Credits: " + (profile?.credits ?? 0);

/* ---------- LOGOUT ---------- */

document.getElementById("logout-btn")
    .addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});();

const main = document.getElementById("main-content");

