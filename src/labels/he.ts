import type { CommandPaletteLabels } from "@/types.js";

/**
 * Hebrew copy.
 *
 * Its own module, reachable only through the `@system-b90/command-palette/he`
 * subpath, so an app that imports the English table never pulls these strings
 * into its bundle — see `src/labels/index.ts`.
 */
export const HE_LABELS: CommandPaletteLabels = {
    placeholder: "הקלד פקודה או חפש…",
    empty: "אין תוצאות מתאימות",
    recents: "אחרונים",
    kinds: {
        command: "פקודות",
        entity: "ישויות",
        goto: "מעבר אל",
    },
    hints: {
        navigate: "ניווט",
        run: "הרצה",
        close: "סגירה",
    },
};
