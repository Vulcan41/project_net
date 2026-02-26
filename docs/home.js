// home.js
import { supabase } from "./supabase.js";

const welcome = document.getElementById("welcome");

const { data: { session } } = await supabase.auth.getSession();

// Protect page
if (!session) {
    window.location.href = "index.html";
} else {
    welcome.innerText = "Welcome " + session.user.email;
}

window.logout = async function () {
    await supabase.auth.signOut();
    window.location.href = "index.html";
};





document.getElementById("save-profile")
    ?.addEventListener("click", async () => {

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
        .update({
        full_name,
        username,
        bio
    })
        .eq("id", user.id);

    if (error) {
        console.error("SAVE ERROR:", error);
        alert("Error saving");
        return;
    }

    alert("Profile saved!");

    // ⭐ THIS IS THE IMPORTANT PART
    await loadProfile();
});



async function loadProfile() {

    const { data: userData, error: userError } =
    await supabase.auth.getUser();

    if (userError || !userData.user) return;

    const user = userData.user;

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("LOAD ERROR:", error);
        return;
    }

    // update UI
    document.getElementById("show-name").textContent =
    data.full_name || "";

    document.getElementById("show-username").textContent =
    data.username || "";

    document.getElementById("show-bio").textContent =
    data.bio || "";
}

loadProfile();