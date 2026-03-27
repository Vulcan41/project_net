import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { projectId, folderId, filenames } = req.body || {};

        if (!projectId || !folderId || !Array.isArray(filenames)) {
            return res.status(400).json({ error: "Invalid payload" });
        }

        if (!filenames.length) {
            return res.status(200).json({ conflicts: [] });
        }

        const { data, error } = await supabase
            .from("project_files")
            .select("id, filename")
            .eq("project_id", projectId)
            .eq("folder_id", folderId)
            .in("filename", filenames);

        if (error) {
            console.error("Supabase error in check-conflicts:", error);
            return res.status(500).json({ error: error.message });
        }

        const conflicts = (data || []).map((file) => ({
            filename: file.filename,
            existingFileId: file.id
        }));

        return res.status(200).json({ conflicts });
    } catch (err) {
        console.error("check-conflicts error:", err);
        return res.status(500).json({
            error: err.message || "Failed to check conflicts"
        });
    }
}