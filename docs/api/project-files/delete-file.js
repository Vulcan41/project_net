import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { fileId } = req.body;

        if (!fileId) {
            return res.status(400).json({ error: "Missing fileId" });
        }

        // get file info
        const { data: file, error } = await supabase
            .from("project_files")
            .select("object_key")
            .eq("id", fileId)
            .single();

        if (error || !file) {
            return res.status(404).json({ error: "File not found" });
        }

        // delete from R2
        const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file.object_key,
        });

        await s3.send(command);

        // delete from DB
        const { error: deleteError } = await supabase
            .from("project_files")
            .delete()
            .eq("id", fileId);

        if (deleteError) {
            throw deleteError;
        }

        return res.status(200).json({
            success: true
        });

    } catch (err) {
        console.error("Delete file error:", err);
        return res.status(500).json({
            error: "Failed to delete file"
        });
    }
}