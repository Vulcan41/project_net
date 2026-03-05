// index.js
import { supabase } from "./supabase.js";

/* =========================================================
   INPUT REFERENCES
========================================================= */

const email = document.getElementById("email");
const password = document.getElementById("password");

/* =========================================================
   SIGN UP
========================================================= */

async function signUp(e) {

    e?.preventDefault();

    const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
    });

    if (error) {
        alert(error.message);
    } else {
        alert("Check your email for confirmation!");
    }

}

/* =========================================================
   LOGIN
========================================================= */

async function login(e) {

    e?.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
    });

    if (error) {
        alert(error.message);
        return;
    }

    window.location.href = "home.html";

}

/* =========================================================
   AUTO LOGIN CHECK
========================================================= */

const { data: { session } } = await supabase.auth.getSession();

if (session) {
    window.location.href = "home.html";
}

/* =========================================================
   BUTTON EVENTS
========================================================= */

document.getElementById("login-btn")?.addEventListener("click", login);
document.getElementById("signup-btn")?.addEventListener("click", signUp);