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





const saveBtn = document.getElementById("save-profile");

saveBtn?.addEventListener("click", async () => {

    // get logged in user
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
        alert("No user logged in");
        return;
    }

    // read form values
    const full_name = document.getElementById("test-name").value;
    const username = document.getElementById("test-username").value;
    const bio = document.getElementById("test-bio").value;

    // update profile
    const { error } = await supabase
        .from("profiles")
        .update({
        full_name,
        username,
        bio
    })
        .eq("id", user.id);

    if (error) {
        console.error(error);
        alert("Error saving profile");
    } else {
        alert("Profile saved!");
        loadProfile();
    }
});



async function loadProfile() {

    const { data: userData } = await supabase.auth.getUser();
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

    document.getElementById("show-name").textContent =
    data.full_name || "";

    document.getElementById("show-username").textContent =
    data.username || "";

    document.getElementById("show-bio").textContent =
    data.bio || "";
}

loadProfile();