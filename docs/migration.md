# Migrating from Bluz's in-tree copy

The palette lived at `bluz/ui/src/components/command-palette/` before it was a
package. This is the record of that migration, kept because madash and
peek-a-boo will do a smaller version of the same thing, and because it documents
which behaviours changed.

## Steps

**1. Add the dependency.**

```json title="package.json"
"@system-b90/command-palette": "^0.1.0"
```

**2. Rewrite the imports.** The public API is unchanged, so this is a
find-and-replace:

```diff
- import { CommandPaletteProvider } from "@/components/command-palette";
+ import { CommandPaletteProvider } from "@system-b90/command-palette";
```

Bluz had ten such files: the eight `app-commands/` modules, its
`BluzCommandPalette` wrapper and the header's `CommandPaletteButton`. No other
import shape existed, because the in-tree copy was already consumed only through
its barrel.

**3. Delete the directory.** `rm -rf ui/src/components/command-palette`.

**4. Drop any lint exemption for it.** Bluz's `ui/eslint.config.mts` had an
override turning off `no-restricted-imports` for `**/components/command-palette/**`,
because the folder used relative imports in preparation for extraction. That
block goes.

**5. Fix import order.** `eslint --fix` handles it — `@system-b90/…` sorts
differently from `@/…` under `import/order`.

**6. Move the labels onto the shipped table.** This is the one API change; see
below.

**7. Verify.** `npm run typecheck`, `npm run lint`, `npm run build`, then the
palette's E2E spec.

## The one API change: `labels`

Previously the package shipped no copy at all and `labels` was a required, full
`CommandPaletteLabels` object. It still is required — but two tables now ship,
so most of a host's table is redundant. Bluz went from a hand-written table to
the Hebrew table plus the strings it says differently:

```ts title="ui/src/components/app-commands/labels.ts"
import { withLabelOverrides } from "@system-b90/command-palette";
import { HE_LABELS } from "@system-b90/command-palette/he";

export const PALETTE_LABELS = withLabelOverrides(HE_LABELS, {
    placeholder: "הקלידו פקודה, או חפשו סילבוס, חדר, גאנט…",
    empty: "לא נמצאו תוצאות",
    recents: "בשימוש לאחרונה",
    kinds: { entity: "פריטים", goto: "ניווט" },
    hints: { run: "ביצוע" },
});
```

Keeping a full hand-written table also works — `labels` takes any
`CommandPaletteLabels`. The overrides form just means a new label field added by
the package arrives translated rather than as a type error.

!!! warning "Import one language"
    Bluz imports `/he` and never `/en`, which is what keeps the English strings
    out of its bundle. Verified on the built output: the Hebrew strings appear
    in the client chunks and `"No matching results"` does not.

## Behaviour changes

Everything else is source-compatible. Two things behave *better* than the
in-tree copy:

| | Before | After |
| --- | --- | --- |
| **Themes** | `CommandPaletteRow` read `theme.vars.palette.primary.mainChannel` unguarded, which throws under a classic (non-CSS-variables) MUI theme. Bluz never hit it because it uses `extendTheme`. | `primaryAlpha()` handles both flavours. Matters for peek-a-boo and madash. |
| **Normalisation** | Hebrew-specific folding only. | Unicode combining marks are folded too, so `résumé` matches `resume`. Hebrew behaviour is unchanged. |

No change to: the `Command` shape, the registry semantics, ranking constants,
lane prefixes, hotkeys, the ARIA contract, or the recents storage key
(`command-palette:recents:<namespace>`) — so users keep their history.

## New capabilities

Things the in-tree copy did not have:

- **`@system-b90/command-palette/core`** — the React-free half, for ranking an
  in-page search field identically. See [Recipes](recipes.md#headless-use-of-the-matcher).
- **`withLabelOverrides`** for partial label overrides.
- **`HighlightedText`** is exported, so hosts can highlight their own matches.
- **`CommandRegistry`, `RecentsStore`, `rankCommands`** are exported for tests.

## For madash and peek-a-boo

Neither has an existing copy to remove, so it is just:

1. `npm install @system-b90/command-palette`
2. Mount `CommandPaletteProvider` inside the theme provider, with `EN_LABELS` or
   `HE_LABELS` and a `storageNamespace` of its own.
3. Contribute commands from the components that own the actions.

Start with navigation (`kind: "goto"`) — it is the cheapest thing to wire and
usually the most used. [Getting Started](getting-started.md) has the details.

## Lockfile note

`@system-b90/command-palette` must be published to npm before
`npm ci` can resolve it. Until the release lands, install from a locally packed
tarball (`npm pack` in the package repo, then `npm install --no-save <tgz>`) to
develop against it — that is how this migration was verified.
