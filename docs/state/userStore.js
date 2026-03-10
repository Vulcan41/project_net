import { supabase } from "../core/supabase.js";

export const DEFAULT_AVATAR = "assets/avatar.png";
export const DEFAULT_FULLNAME = "User";
export const DEFAULT_USERNAME = "hi";
export const DEFAULT_BIO = "New User";

export const userStore = {

    user: null,
    profile: null,

    /* ================================
       LOAD USER + PROFILE
    ================================ */

    async load() {

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return null;

        this.user = user;

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error) {
            console.error(error);
            return null;
        }

        this.profile = data;

        return this.profile;
    },

    /* ================================
       GETTERS
    ================================ */

    getUser() {
        return this.user;
    },

    getProfile() {
        return this.profile;
    },

    /* ================================
       REFRESH PROFILE
    ================================ */

    async refreshProfile() {

        if (!this.user) return;

        const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", this.user.id)
            .single();

        this.profile = data;

        return data;
    }

};

