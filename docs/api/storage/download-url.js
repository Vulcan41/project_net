import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

        const { data: file, error } = await supabase
            .from("storage_files")
            .select("object_key")
            .eq("id", fileId)
            .single();

        if (error || !file) {
            return res.status(404).json({ error: "File not found" });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file.object_key,
        });

        const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

        return res.status(200).json({ downloadUrl });

    } catch (err) {
        console.error("Download URL error:", err);
        return res.status(500).json({ error: "Failed to generate download URL" });
    }
}