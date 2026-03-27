import { supabase } from "../../core/supabase.js";

console.log("ENV CHECK:", {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MISSING"
});

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { projectId, folderId, filenames } = req.body || {};

        if (!projectId || !folderId || !Array.isArray(filenames)) {
            return res.status(400).json({ error: "Invalid payload" });
        }

        if (filenames.length === 0) {
            return res.status(200).json({ conflicts: [] });
        }

        // Get existing files with same names in this folder
        const { data, error } = await supabase
            .from("project_files")
            .select("id, filename")
            .eq("project_id", projectId)
            .eq("folder_id", folderId)
            .in("filename", filenames);

        if (error) {
            throw error;
        }

        const conflicts = (data || []).map((file) => ({
            filename: file.filename,
            existingFileId: file.id
        }));

        return res.status(200).json({
            conflicts
        });

    } catch (err) {
        console.error("check-conflicts error:", err);
        return res.status(500).json({
            error: "Internal server error"
        });
    }
}