import { supabase } from "../core/supabase.js";

export const projectStore = {
    project: null,
    membership: null,

    async load(projectId) {
        if (!projectId) return null;

        const {
            data: { user }
        } = await supabase.auth.getUser();

        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .single();

        if (projectError) {
            console.error(projectError);
            this.project = null;
            this.membership = null;
            return null;
        }

        this.project = project;

        if (!user) {
            this.membership = null;
            return { project: this.project, membership: null };
        }

        const { data: membership, error: membershipError } = await supabase
            .from("project_members")
            .select("*")
            .eq("project_id", projectId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (membershipError) {
            console.error(membershipError);
            this.membership = null;
        } else {
            this.membership = membership;
        }

        return {
            project: this.project,
            membership: this.membership
        };
    },

    clear() {
        this.project = null;
        this.membership = null;
    },

    getProject() {
        return this.project;
    },

    getMembership() {
        return this.membership;
    },

    getAvatarUrl() {
        return this.project?.avatar_url ?? null;
    },

    setAvatarUrl(url) {
        if (!this.project) return;
        this.project.avatar_url = url;
    }
};