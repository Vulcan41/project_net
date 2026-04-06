const BASE_URL = 'https://noesisflowapi-production.up.railway.app';

export async function apiRequest(path, options = {}) {
  const url = BASE_URL ? `${BASE_URL}${path}` : path;
  return fetch(url, options);
}

export const API_PATHS = {
  PROJECT_FILES_DOWNLOAD_URL: "/api/project-files/download-url",
  PROJECT_FILES_UPLOAD_URL: "/api/project-files/upload-url",
  PROJECT_FILES_DELETE_FILE: "/api/project-files/delete-file",
  PROJECT_FILES_DELETE_FOLDER: "/api/project-files/delete-folder",
  PROJECT_FILES_CHECK_CONFLICTS: "/api/project-files/check-conflicts",
  MESSAGES_UPLOAD_ATTACHMENT: "/api/messages/upload-attachment-url",
  MESSAGES_DOWNLOAD_ATTACHMENT: "/api/messages/download-attachment-url",
  MESSAGES_LINK_PREVIEW: "/api/messages/link-preview",
};
