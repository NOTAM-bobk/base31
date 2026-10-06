// Avatars for the community discussion, drawn by DiceBear's public HTTP API.
//
// The seed is the display name, so the same name always produces the same
// picture — no accounts, no stored image, no upload. This is a third-party
// request made by the visitor's browser while the board is on screen, so the
// name travels in the URL (see the privacy page and README). Keep the seed
// encoded so a name can never break out of the query string.

/** The DiceBear collection used for every message. */
export const DISCUSSION_AVATAR_STYLE = "bottts";

/** A stable avatar URL for a display name. */
export function discussionAvatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/${DISCUSSION_AVATAR_STYLE}/svg?seed=${encodeURIComponent(name.trim())}`;
}
