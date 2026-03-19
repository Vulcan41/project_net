// register/register.js

import { supabase } from "../core/supabase.js";

/* =========================================================
   INIT REGISTER MODAL
========================================================= */

export function initRegister() {

    setupAvatarPreview();
    setupButtons();
    setupPasswordToggle();

}

/* =========================================================
   AVATAR PREVIEW
========================================================= */

function setupAvatarPreview() {

    const avatarInput = document.getElementById("register-avatar-input");
    const avatarPreview = document.getElementById("register-avatar-preview");

    avatarInput?.addEventListener("change", () => {

        const file = avatarInput.files[0];
        if (!file) return;

        avatarPreview.src = URL.createObjectURL(file);

    });

}

/* =========================================================
   INPUT REFERENCES
========================================================= */

function getInputs() {

    return {
        registerEmail: document.getElementById("register-email"),
        registerPassword: document.getElementById("register-password"),
        registerUsername: document.getElementById("register-username"),
        registerFullname: document.getElementById("register-fullname"),
        registerBio: document.getElementById("register-bio"),
        avatarInput: document.getElementById("register-avatar-input"),
        registerOverlay: document.getElementById("register-overlay")
    };

}

/* =========================================================
   USERNAME CHECK
========================================================= */

async function usernameExists(username) {

    const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

    return !!data;

}

/* =========================================================
   SIGN UP
========================================================= */

async function signUp(e) {

    e?.preventDefault();

    const {
        registerEmail,
        registerPassword,
        registerUsername,
        registerFullname,
        registerBio,
        avatarInput
    } = getInputs();

    const emailValue = registerEmail.value.trim();
    const passwordValue = registerPassword.value.trim();
    const username = registerUsername.value.trim();
    const fullname = registerFullname.value.trim();
    const bio = registerBio.value.trim();

    if (!emailValue || !passwordValue) {
        alert("Email and password required");
        return;
    }

    if (!username) {
        alert("Username required");
        return;
    }

    if (await usernameExists(username)) {
        alert("Username already exists");
        return;
    }

    /* CREATE AUTH USER */

    const { data: signupData, error: signupError } =
    await supabase.auth.signUp({
        email: emailValue,
        password: passwordValue
    });

    if (signupError) {
        alert(signupError.message);
        return;
    }

    const user = signupData.user;

    if (!user) {
        alert("User creation failed");
        return;
    }

    /* AVATAR UPLOAD */

    let avatarUrl = "/assets/avatar.png";

    const file = avatarInput?.files?.[0];

    if (file) {

        const filePath = `${user.id}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase
            .storage
            .from("avatars")
            .upload(filePath, file);

        if (!uploadError) {

            const { data } = supabase
                .storage
                .from("avatars")
                .getPublicUrl(filePath);

            avatarUrl = data.publicUrl;

        }

    }

    /* CREATE PROFILE */

    const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
        id: user.id,
        username: username,
        full_name: fullname,
        bio: bio,
        avatar_url: avatarUrl
    });

    if (profileError) {

        console.error("PROFILE ERROR:", profileError);
        alert(profileError.message);
        return;

    }

    window.location.href = "home.html";

}

/* =========================================================
   BUTTON EVENTS
========================================================= */

function setupButtons() {

    const { registerOverlay } = getInputs();

    document.getElementById("signup-btn")?.addEventListener("click", () => {

        registerOverlay.style.display = "flex";

        document.getElementById("register-username").value = "";
        document.getElementById("register-fullname").value = "";
        document.getElementById("register-bio").value = "";
        document.getElementById("register-email").value = "";
        document.getElementById("register-password").value = "";

    });

    document.getElementById("register-submit")
        ?.addEventListener("click", signUp);

    document.getElementById("register-cancel")
        ?.addEventListener("click", () => {

        registerOverlay.style.display = "none";

    });

}

/* =========================================================
   PASSWORD TOGGLE
========================================================= */

function setupPasswordToggle() {

    const togglePassword = document.getElementById("toggle-password");
    const passwordInput = document.getElementById("register-password");
    const passwordIcon = document.getElementById("password-icon");

    togglePassword?.addEventListener("click", () => {

        if (passwordInput.type === "password") {

            passwordInput.type = "text";
            passwordIcon.src = "assets/view.png";

        } else {

            passwordInput.type = "password";
            passwordIcon.src = "assets/no_view.png";

        }

    });

}