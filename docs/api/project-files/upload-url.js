import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { projectId, fileName, contentType } = req.body;

        if (!projectId || !fileName) {
            return res.status(400).json({ error: "Missing projectId or fileName" });
        }

        // create unique object key
        const fileId = crypto.randomUUID();
        const objectKey = `projects/${projectId}/${fileId}/${fileName}`;

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