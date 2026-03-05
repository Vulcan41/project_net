import { loadProfile, setupSaveProfile } from "../../user.js"

export function init() {

    console.log("Profile tab loaded")

    loadProfile()

    setupSaveProfile()

}