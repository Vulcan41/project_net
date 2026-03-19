import { supabase } from "../../core/supabase.js";
import { userStore } from "../../state/userStore.js";

export async function initDebug() {

    const user = userStore.getUser();
    const profile = userStore.getProfile();

    document.getElementById("debug-user").textContent =
    JSON.stringify(user, null, 2);

    document.getElementById("debug-profile").textContent =
    JSON.stringify(profile, null, 2);

    /* Example future tables */

    const { data: friends } = await supabase
        .from("friends")
        .select("*");

    document.getElementById("debug-friends").textContent =
    JSON.stringify(friends ?? [], null, 2);

}