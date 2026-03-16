import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

console.log("Download endpoint loaded");

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

console.log("Has SUPABASE_URL:", !!process.env.SUPABASE_URL);
console.log("Has SERVICE_ROLE_KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

    console.log("Request method:", req.method);

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {

        const { fileId } = req.body;

        console.log("Requested fileId:", fileId);

        if (!fileId) {
            return res.status(400).json({ error: "Missing fileId" });
        }

        const { data: file, error } = await supabase
            .from("storage_files")
            .select("object_key")
            .eq("id", fileId)
            .single();

        console.log("Supabase result:", file);
        console.log("Supabase error:", error);

        if (error || !file) {
            return res.status(404).json({ error: "File not found" });
        }

        console.log("Object key:", file.object_key);

        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file.object_key,
        });

        const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

        console.log("Generated download URL");

        return res.status(200).json({ downloadUrl });

    } catch (err) {

        console.error("Download URL error:", err);

        return res.status(500).json({
            error: "Failed to generate download URL"
        });

    }

}