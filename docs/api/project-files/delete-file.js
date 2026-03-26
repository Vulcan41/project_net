import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

/* =========================
   R2 CLIENT
========================= */

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

/* =========================
   SUPABASE CLIENTS
========================= */

function getUserClient(req) {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: req.headers.authorization || ""
                }
            }
        }
    );
}

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================
   HANDLER
========================= */

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { fileId } = req.body;

        if (!fileId) {
            return res.status(400).json({ error: "Missing fileId" });
        }

        /* =========================
           STEP 1: Get user
        ========================= */

        const supabaseUser = getUserClient(req);

        const {
            data: { user },
            error: userError
        } = await supabaseUser.auth.getUser();

        if (userError || !user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        /* =========================
           STEP 2: Get file
        ========================= */

        const { data: file, error: fileError } = await supabaseAdmin
            .from("project_files")
            .select("id, object_key, project_id")
            .eq("id", fileId)
            .single();

        if (fileError || !file) {
            return res.status(404).json({ error: "File not found" });
        }

        /* =========================
           STEP 3: Check ownership
        ========================= */

        const { data: project, error: projectError } = await supabaseAdmin
            .from("projects")
            .select("owner_id")
            .eq("id", file.project_id)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: "Project not found" });
        }

        const isOwner = project.owner_id === user.id;

        if (!isOwner) {
            return res.status(403).json({ error: "Forbidden" });
        }

        /* =========================
           STEP 4: Delete from R2
        ========================= */

        const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file.object_key,
        });

        await s3.send(command);

        /* =========================
           STEP 5: Delete from DB
        ========================= */

        const { error: deleteError } = await supabaseAdmin
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