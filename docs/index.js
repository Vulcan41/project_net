// index.js
import { supabase } from "./supabase.js";

const email = document.getElementById("email");
const password = document.getElementById("password");

window.signUp = async function () {
    const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
    });

    if (error) alert(error.message);
    else alert("Check your email for confirmation!");
};

window.login = async function () {
    const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
    });

    if (error) {
        alert(error.message);
    } else {
        window.location.href = "home.html";
    }
};

// If already logged in → skip auth page
const { data: { session } } = await supabase.auth.getSession();

if (session) {
    window.location.href = "home.html";
}

