// Where uploaded documents live, and which ones a user may refer to.
// Checked on the server because a browser can send any path it likes, and these
// functions read storage with full access.

export const DOCUMENTS_BUCKET = "candidate-documents";

/** Older records hold a full URL; newer ones just the path. Returns the path. */
export function storagePathFrom(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const marker = `/${DOCUMENTS_BUCKET}/`;
  const at = value.indexOf(marker);
  const path = at === -1 ? value : value.slice(at + marker.length);
  try {
    return decodeURIComponent(path.split("?")[0]);
  } catch {
    return null;
  }
}

/**
 * A user may only use files in their own folder: uploads/<user id>/<file>.
 *
 * TEMPORARY: also accepts uploads/<number>_<file>, the form used by the version of
 * the site on master. Remove that once this branch is live.
 */
export function isAllowedUploadPath(path: string | null, userId: string): boolean {
  if (!path || path.includes("..")) return false;
  return path.startsWith(`uploads/${userId}/`) || /^uploads\/\d+_[^/]+$/.test(path);
}
