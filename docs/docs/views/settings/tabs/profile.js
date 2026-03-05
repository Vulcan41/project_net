import { supabase } from "supabase.js"

export async function init() {

    console.log("Profile tab loaded")

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    document.getElementById("show-name").textContent = user.email
    document.getElementById("show-username").textContent = user.email
    document.getElementById("show-bio").textContent = "Auth user loaded"
    document.getElementById("credits-value").textContent = "N/A"

}