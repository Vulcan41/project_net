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
        const { conversationId, fileName, contentType } = req.body || {};

        if (!conversationId || !fileName) {
            return res.status(400).json({ error: "Missing conversationId or fileName" });
        }

        /* =========================
           STEP 1: Get current user
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
           STEP 2: Verify conversation membership
        ========================= */

        const { data: conversation, error: conversationError } = await supabaseAdmin
            .from("conversations")
            .select(`
                id,
                friendship_id,
                friendship:friendship_id (
                    id,
                    status,
                    requester_id,
                    receiver_id
                )
            `)
            .eq("id", conversationId)
            .single();

        if (conversationError || !conversation || !conversation.friendship) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        const friendship = conversation.friendship;

        const isParticipant =
        friendship.requester_id === user.id ||
        friendship.receiver_id === user.id;

        if (!isParticipant) {
            return res.status(403).json({ error: "Forbidden" });
        }

        if (friendship.status !== "accepted") {
            return res.status(403).json({ error: "Conversation is inactive" });
        }

        /* =========================
           STEP 3: Build object key
        ========================= */

        const attachmentId = crypto.randomUUID();
        const safeFileName = sanitizeFileName(fileName);
        const objectKey = `messages/${conversationId}/${attachmentId}/${safeFileName}`;

        /* =========================
           STEP 4: Generate signed upload URL
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
            attachmentId
        });

    } catch (error) {
        console.error("Message attachment upload URL error:", error);
        return res.status(500).json({ error: "Failed to generate upload URL" });
    }
}