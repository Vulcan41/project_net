import { supabase } from "./core/supabase.js";
import { initRegister } from "./register/register.js";

/* =========================================================
   LOAD REGISTER MODAL
========================================================= */

async function loadRegisterModal() {

    const res = await fetch("register/register.html");
    const html = await res.text();

    document.body.insertAdjacentHTML("beforeend", html);

}

await loadRegisterModal();

/* INIT REGISTER LOGIC */

initRegister();

/* =========================================================
   INPUT REFERENCES
========================================================= */

const email = document.getElementById("email");
const password = document.getElementById("password");

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