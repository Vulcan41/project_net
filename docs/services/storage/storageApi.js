import { supabase } from "../../core/supabase.js";
// If your supabase.js uses default export instead, change to:
// import supabase from "../../core/supabase.js";

function generateFileId() {
    return crypto.randomUUID();
}

async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
        throw new Error(`Failed to get current user: ${error.message}`);
    }

    if (!data?.user) {
        throw new Error("No authenticated user found.");
    }

    return data.user;
}

async function requestUploadUrl(objectKey, contentType) {
    const response = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            objectKey,
            contentType,
        }),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result?.error || "Failed to get upload URL.");
    }

    return result;
}

async function uploadToR2(uploadUrl, file) {
    const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
    });

    if (!response.ok) {
        throw new Error("Failed to upload file to R2.");
    }
}

async function insertFileRecord({
    fileId,
    userId,
    filename,
    objectKey,
    sizeBytes,
    mimeType,
}) {
    const { data, error } = await supabase
        .from("storage_files")
        .insert({
        id: fileId,
        user_id: userId,
        filename,
        object_key: objectKey,
        size_bytes: sizeBytes,
        mime_type: mimeType || null,
        status: "ready",
        is_public: false,
    })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to save file record: ${error.message}`);
    }

    return data;
}

export async function uploadFile(file) {
    if (!file) {
        throw new Error("No file provided.");
    }

    const user = await getCurrentUser();
    const fileId = generateFileId();
    const objectKey = `users/${user.id}/files/${fileId}`;

    const { uploadUrl } = await requestUploadUrl(
        objectKey,
        file.type || "application/octet-stream"
    );

    await uploadToR2(uploadUrl, file);

    const savedRecord = await insertFileRecord({
        fileId,
        userId: user.id,
        filename: file.name,
        objectKey,
        sizeBytes: file.size,
        mimeType: file.type,
    });

    return savedRecord;
}

export async function listMyFiles() {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from("storage_files")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`Failed to load files: ${error.message}`);
    }

    return data || [];
}

export async function getDownloadUrl(fileId) {
    const res = await fetch("/api/storage/download-url", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Failed to get download URL");
    }

    return data.downloadUrl;
}