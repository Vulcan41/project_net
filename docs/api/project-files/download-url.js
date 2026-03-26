import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

// 1. Auth client (uses user token)
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

// 2. Admin client (bypasses RLS)
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
            .select("object_key, project_id, visibility")
            .eq("id", fileId)
            .single();

        if (fileError || !file) {
            return res.status(404).json({ error: "File not found" });
        }

        /* =========================
           STEP 3: Check if owner
        ========================= */

        const { data: project } = await supabaseAdmin
            .from("projects")
            .select("owner_id")
            .eq("id", file.project_id)
            .single();

        const isOwner = project?.owner_id === user.id;

        /* =========================
           STEP 4: Check membership
        ========================= */

        const { data: membership } = await supabaseAdmin
            .from("project_members")
            .select("id")
            .eq("project_id", file.project_id)
            .eq("user_id", user.id)
            .eq("membership_status", "active")
            .maybeSingle();

        const isMember = !!membership;

        /* =========================
           STEP 5: Permission logic
        ========================= */

        let allowed = false;

        if (isOwner) {
            allowed = true;
        } else if (isMember && file.visibility === "public") {
            allowed = true;
        }

        if (!allowed) {
            return res.status(403).json({ error: "Forbidden" });
        }

        /* =========================
           STEP 6: Generate URL
        ========================= */

        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file.object_key,
        });

        const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

        return res.status(200).json({ downloadUrl });

    } catch (err) {
        console.error("Download URL error:", err);
        return res.status(500).json({
            error: "Failed to generate download URL"
        });
    }
}