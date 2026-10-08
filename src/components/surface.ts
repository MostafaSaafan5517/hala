// Surfaces carry hierarchy instead of borders (docs/design/DESIGN.md, Depth; Lists and cards).

/** A level-1 surface: a form, a summary or a panel sits on one. */
export const surface = "rounded-surface bg-card shadow-level-1";

/** One list on one surface, its rows divided, with no box around each row. */
export const surfaceList =
  "divide-y divide-border overflow-hidden rounded-surface bg-card shadow-level-1";

/** A row of a surface list. */
export const surfaceRow = "px-4 py-3.5 sm:px-5";

/**
 * A row of a surface list that is a link: the whole row fills on hover, and its focus outline
 * is drawn inside, since the surface clips anything outside it.
 */
export const surfaceLinkRow =
  "block px-4 py-3.5 outline-offset-[-2px] hover:bg-muted sm:px-5";
