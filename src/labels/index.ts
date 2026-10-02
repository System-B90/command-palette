import type { CommandPaletteLabels } from "@/types.js";

/**
 * Locale plumbing — types and merging only. **No copy lives here**, and nothing
 * in this file may import `./en.js` or `./he.js`.
 *
 * That is the whole trick behind "one language per build": each table is its own
 * module behind its own package subpath (`@system-b90/command-palette/en`,
 * `…/he`), the package is `sideEffects: false`, and the palette itself never
 * references either. A host that imports `EN_LABELS` therefore gives its bundler
 * no path by which the Hebrew strings could be reached, and vice versa. A single
 * module exporting both, or a `language="he"` prop selecting between them, would
 * bake in both — the choice has to be an import, not a value.
 */

/** A `labels` prop where every field is optional: the base table fills the rest. */
export type PartialCommandPaletteLabels = {
    placeholder?: string;
    empty?: string;
    recents?: string;
    kinds?: Partial<CommandPaletteLabels["kinds"]>;
    hints?: Partial<CommandPaletteLabels["hints"]>;
};

/**
 * Overlay per-field overrides onto a complete table, so a host can re-word one
 * string ("Type a command or jump to a class…") without restating the rest.
 *
 * ```ts
 * import { EN_LABELS } from "@system-b90/command-palette/en";
 * import { withLabelOverrides } from "@system-b90/command-palette";
 *
 * const LABELS = withLabelOverrides(EN_LABELS, { recents: "Frequent" });
 * ```
 */
export function withLabelOverrides(
    base: CommandPaletteLabels,
    overrides?: PartialCommandPaletteLabels,
): CommandPaletteLabels {
    if (!overrides) return base;

    return {
        ...base,
        ...overrides,
        kinds: { ...base.kinds, ...overrides.kinds },
        hints: { ...base.hints, ...overrides.hints },
    };
}
