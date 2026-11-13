import { apiErrorMessage, redirectToLoginIfUnauthenticated } from "@/lib/api/client";
import { imageUploadFormData, PhotoTooLargeError } from "@/lib/client/resizeImage";
import type { ScannedPantryItem } from "@/lib/pantryItems";

/**
 * Sends a pantry or fridge photo to be read (#195: shared by the planner and
 * the plan page's pantry sheet). Resolves to the items found, or null when the
 * session has expired and the browser is already on its way to the login page.
 * Throws an Error whose message is ready to show.
 */
export async function scanPantryImage(file: File): Promise<ScannedPantryItem[] | null> {
  // Resized on the client to stay well under Vercel's 4.5 MB body limit (#82).
  const formData = await imageUploadFormData(file);

  const response = await fetch('/api/scan-pantry-image', {
    method: 'POST',
    body: formData,
  });

  if (redirectToLoginIfUnauthenticated(response)) return null;
  // Vercel's 413 body isn't our JSON, so handle it before parsing.
  if (response.status === 413) throw new PhotoTooLargeError();

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.error) {
    throw new Error(apiErrorMessage(data));
  }

  return data.items;
}
