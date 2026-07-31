# `@system-b90/command-palette`

A VSCode-style command palette for MUI apps: a contribution registry, a fuzzy
matcher with per-character match highlighting, recency-aware ranking, and an
accessible, RTL-aware dialog.

Extracted from Bluz's `ui/src/components/command-palette/`. Generic by
construction — it imports only `react`, `@mui/material` and
`@mui/icons-material` (all peer dependencies), and holds no domain knowledge.
English and Hebrew copy ship with it; only the language you import is built
into your bundle.

📖 **Full documentation:** <https://system-b90.github.io/command-palette/> —
getting started, the command model, ranking internals, theming and RTL,
accessibility, recipes and the generated API reference. Source in `docs/`.

## Install

```powershell
"@system-b90:registry=https://npm.pkg.github.com" | Out-File -Append $HOME\.npmrc
"//npm.pkg.github.com/:_authToken=$env:GITHUB_TOKEN" | Out-File -Append $HOME\.npmrc

npm install @system-b90/command-palette
```

Peer dependencies: `react` 18 or 19, `@mui/material` 7, `@mui/icons-material` 7.

## Quick start

```tsx
// 1. Mount the provider once, above every component that contributes commands,
//    with the language you want.
import { CommandPaletteProvider } from "@system-b90/command-palette";
import { EN_LABELS } from "@system-b90/command-palette/en";

<CommandPaletteProvider labels={EN_LABELS} storageNamespace="peek-a-boo">
    {children}
</CommandPaletteProvider>;
```

```tsx
// 2. Contribute commands from wherever the action can actually be performed.
import { useCommands } from "@system-b90/command-palette";

const commands = useMemo(
    () => [
        {
            id: "session.new",
            title: "New session",
            keywords: ["create", "start"],
            group: "Sessions",
            kind: "command" as const,
            icon: <AddIcon />,
            run: () => setOpenSessionDialog(true),
        },
    ],
    [setOpenSessionDialog],
);

// Must be referentially stable — a fresh array every render re-registers every
// render. Pass a `(query) => Command[]` callback instead when the set is too
// large to materialise eagerly.
useCommands(commands);
```

```tsx
// 3. Open it from a button, if you want a mouse affordance too.
const { open } = useCommandPalette();
```

## Language

Two tables ship, each behind its own subpath:

```tsx
import { EN_LABELS } from "@system-b90/command-palette/en";
import { HE_LABELS } from "@system-b90/command-palette/he";
```

Pick one and pass it as `labels`. **Only the one you import is baked into the
build** — the palette itself references neither table, and the package is
`sideEffects: false`, so a bundler has no route from your entry point to the
language you did not import. That is also why `labels` is required and why there
is no `language="he"` prop: a runtime switch would need both tables present, and
would ship both.

Re-word individual strings without restating the table:

```tsx
import { withLabelOverrides } from "@system-b90/command-palette";
import { HE_LABELS } from "@system-b90/command-palette/he";

const LABELS = withLabelOverrides(HE_LABELS, { recents: "בשימוש תדיר" });

<CommandPaletteProvider labels={LABELS} storageNamespace="bluz">
```

A third language is just a `CommandPaletteLabels` object of your own — nothing
in the package needs to know about it.

`labels` must be referentially stable (module constant or `useMemo`).

## Interaction model

| Input | Effect |
| --- | --- |
| `Ctrl`/`⌘` + `K` | Open with every lane in play |
| `Ctrl`/`⌘` + `Shift` + `P` | Open pre-filtered to the command lane |
| `>` prefix | Commands only |
| `@` prefix | Entities only |
| `:` prefix | Navigation only |
| `↑` `↓` `Home` `End` | Move selection (skips disabled rows) |
| `Enter` | Run the selected command |
| `Esc` | Close |

Lanes are a power-user shortcut, not a requirement: with no prefix the palette
searches everything at once. Both open shortcuts can be turned off individually
via the `hotkeys` prop.

A command that declares `shortcut: ["Ctrl", "Z"]` gets that chord bound globally
for as long as it is contributed — contributors declare, they do not also wire a
window listener.

## Headless use

`@system-b90/command-palette/core` exposes the React-free half — registry,
matcher, ranking, recents, prefix parsing — for hosts that want the machinery
without the dialog (an in-page search field that should rank identically, say).

## Layout

```
src/
  types.ts                   Public contracts. Start here.
  labels/
    index.ts                 Merge helper + types. No copy — see the file header.
    en.ts                    English table, `/en` subpath
    he.ts                    Hebrew table, `/he` subpath
  theme.ts                   CSS-vars/classic MUI theme bridge
  core/                      No React. Portable, testable on its own.
    text.ts                  Normalisation: Unicode marks, Hebrew niqqud/gershayim/final forms
    fuzzy.ts                 Scoring + per-character match indices for highlighting
    modes.ts                 Prefix ⇄ lane parsing
    registry.ts              The contribution store
    recents.ts               localStorage MRU, folded into ranking
    rank.ts                  Filter → score → sort → group
    index.ts                 The `/core` subpath entry point
  CommandPaletteContext.ts   React context + the guard hook
  CommandPaletteProvider.tsx Owns registry/recents/open state; renders the palette
  use-commands.ts            Contribute commands while mounted
  use-command-palette.ts     Imperative open/close/toggle
  use-open-palette-hotkeys.ts Window-level open shortcuts
  CommandPaletteDialog.tsx   The MUI sheet
  CommandPaletteRow.tsx      One result row
  HighlightedText.tsx        Match highlighting
  KeyChip.tsx                Keycaps and key sequences
```

## Does this belong in this package?

Yes, if **all** of these hold:

- It imports nothing but `react` and `@mui/*`.
- It contains no user-facing copy. Every string the palette renders arrives
  through `labels`; the shipped tables under `src/labels/` are data, not
  component code, and nothing else in the package may import them.
- It contains no knowledge of any host app's domain — no curriculums, no
  syllabuses, no settings tabs.

Otherwise it belongs in the host app alongside its own command contributions
(in Bluz, that is `ui/src/components/app-commands/`).

## Notes

- **Ranking** is text score (title > keywords > subtitle > group) plus a bounded
  recency bonus and a static `priority` nudge. Recency breaks ties; it never
  outranks a materially better text match.
- **Theming** works under both a classic MUI theme and a CSS-vars theme
  (`extendTheme`/`CssVarsProvider`) — see `src/theme.ts` for why that needs a
  bridge.
- **RTL** is handled with logical properties throughout, and the query field
  inherits the ambient direction rather than pinning its own. Two things
  deliberately opt out:
  - The lane prefix (`>` `@` `:`) never appears in the field — the dialog strips
    it into a chip beside the input. An ASCII prefix left in an RTL field would
    be stranded at the wrong visual end of the query.
  - Key sequences render through `ShortcutKeys`, which pins itself to `ltr`. A
    chord is written modifier-first everywhere, so inheriting RTL would flex
    `Ctrl` `Z` into `Z` `Ctrl`.
- **The matcher is hand-rolled** rather than pulled from a library, so the
  package carries zero runtime dependencies and scoring can be tuned for the
  palette's shape: short titles, mixed-script content, and a need for
  per-character match indices to drive highlighting.

## Development

```bash
npm ci
npm run lint        # ESLint, ported from Bluz's ui/eslint.config.mts
npm run typecheck   # tsc --noEmit
npm test            # builds, then runs the core/ unit tests against dist/
npm run docs:api    # regenerate docs/api/ with TypeDoc (gitignored)
npm run docs:serve  # mkdocs live preview; needs `pip install mkdocs-material mkdocs-typedoc`
```

Internal imports use the `@/*` alias; `build` runs `tsc-alias` after `tsc` so
the published `.js`/`.d.ts` carry plain relative specifiers.

## Publishing

CI publishes on GitHub Release (or manual dispatch) via
`.github/workflows/publish.yml`. Bump `version` in `package.json` before
releasing — consumers pin exact versions.
