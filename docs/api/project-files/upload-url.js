import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

/* =========================
   R2 CLIENT
========================= */

const client = new S3Client({
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
   HELPERS
========================= */

function sanitizeFileName(fileName) {
    return String(fileName || "file")
        .replace(/[^\p{L}\p{N}._ -]/gu, "_")
        .replace(/\s+/g, "_")
        .slice(0, 180);
}

/* =========================
   HANDLER
========================= */

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { projectId, folderId, fileName, contentType } = req.body || {};

        if (!projectId || !fileName) {
            return res.status(400).json({ error: "Missing projectId or fileName" });
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
           STEP 2: Check project exists
        ========================= */

        const { data: project, error: projectError } = await supabaseAdmin
            .from("projects")
            .select("id, owner_id")
            .eq("id", projectId)
            .single();

        if (projectError || !project) {
            return res.status(404).json({ error: "Project not found" });
        }

        /* =========================
           STEP 3: Check permissions
        ========================= */

        const isOwner = project.owner_id === user.id;

        let canUpload = false;

        if (isOwner) {
            canUpload = true;
        } else {
            if (!folderId) {
                return res.status(400).json({ error: "Missing folderId" });
            }

            const { data: membership, error: membershipError } = await supabaseAdmin
                .from("project_members")
                .select("role, membership_status")
                .eq("project_id", projectId)
                .eq("user_id", user.id)
                .single();

            if (membershipError || !membership || membership.membership_status !== "active") {
                return res.status(403).json({ error: "Forbidden" });
            }

            const { data: folder, error: folderError } = await supabaseAdmin
                .from("project_folders")
                .select("id, member_can_contribute")
                .eq("id", folderId)
                .eq("project_id", projectId)
                .single();

            if (folderError || !folder) {
                return res.status(404).json({ error: "Folder not found" });
            }

            canUpload = !!folder.member_can_contribute;
        }

        if (!canUpload) {
            return res.status(403).json({ error: "Upload not allowed in this folder" });
        }

        /* =========================
           STEP 4: Build safe object key
        ========================= */

        const fileId = crypto.randomUUID();
        const safeFileName = sanitizeFileName(fileName);
        const objectKey = `projects/${projectId}/${fileId}/${safeFileName}`;

        /* =========================
           STEP 5: Generate signed upload URL
        ========================= */

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: objectKey,
            ContentType: contentType || "application/octet-stream",
        });

        const uploadUrl = await getSignedUrl(client, command, {
            expiresIn: 60,
        });

        return res.status(200).json({
            uploadUrl,
            objectKey,
            fileId
        });

    } catch (error) {
        console.error("Upload URL error:", error);
        return res.status(500).json({ error: "Failed to generate upload URL" });
    }
}