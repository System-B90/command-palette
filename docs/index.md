# Command Palette

`@system-b90/command-palette` is a VSCode-style quick-open surface for MUI
applications: press ++ctrl+k++, type a few characters, hit ++enter++.

It was extracted from Bluz, where it had been built to be liftable from the
start, and is now shared by **bluz**, **madash** and **peek-a-boo**.

## What it gives you

| | |
| --- | --- |
| **A contribution model** | Commands are registered by whichever component is mounted and able to perform them, and disappear when it unmounts. The palette can live in the root layout and still reach page-local state. |
| **Fuzzy matching** | Hand-rolled matcher with per-character match indices, so results can show *why* they matched. Handles mixed-script content, Latin diacritics and Hebrew niqqud/final forms. |
| **Recency-aware ranking** | A bounded MRU bonus breaks ties without ever outranking a materially better text match. |
| **Lanes** | VSCode-style `>`, `@` and `:` prefixes narrow to commands, entities or navigation. Optional — an unprefixed query searches everything. |
| **Global shortcuts** | A command that declares `shortcut: ["Ctrl", "Z"]` gets that chord bound for as long as it is contributed. |
| **Two languages, one bundle** | English and Hebrew tables ship; only the one you import is built in. |
| **RTL and theming** | Logical properties throughout; works under both classic and CSS-variables MUI themes. |
| **Zero runtime dependencies** | `react`, `@mui/material` and `@mui/icons-material` are peer dependencies. Nothing else. |

## 60-second tour

```tsx
import { CommandPaletteProvider, useCommands } from "@system-b90/command-palette";
import { EN_LABELS } from "@system-b90/command-palette/en";

// Once, in the layout.
<CommandPaletteProvider labels={EN_LABELS} storageNamespace="my-app">
    {children}
</CommandPaletteProvider>;

// Anywhere below it, in the component that owns the action.
function SchedulePage() {
    const [open, setOpen] = useState(false);

    const commands = useMemo(
        () => [
            {
                id: "schedule.event.new",
                title: "New event",
                keywords: ["create", "add"],
                group: "Schedule",
                icon: <AddIcon />,
                run: () => setOpen(true),
            },
        ],
        [],
    );

    useCommands(commands);
    // …
}
```

That is the entire integration surface for most apps. Everything else in these
docs is detail you can reach for when you need it.

## Where to go next

- **[Getting Started](getting-started.md)** — install, mount, contribute, verify.
- **[Contributing Commands](commands.md)** — the `Command` shape in full, static
  arrays vs. factories, lanes, shortcuts, disabled and long-running commands.
- **[Language & Localisation](localisation.md)** — why the language is an import
  and not a prop, and how to add a third one.
- **[Ranking & Matching](ranking.md)** — exactly how a result gets its score.
- **[Theming & RTL](theming.md)** — how the palette picks up your theme, and the
  two places it deliberately ignores text direction.
- **[Accessibility](accessibility.md)** — the ARIA contract and keyboard model.
- **[Recipes](recipes.md)** — entity search, async commands, toggles, headless use.
- **[Architecture](architecture.md)** — module map, data flow, design decisions.
- **[API Reference](api/index.md)** — generated from the source.

## Support matrix

| Peer dependency | Supported |
| --- | --- |
| `react` | 18, 19 |
| `@mui/material` | 7 |
| `@mui/icons-material` | 7 |

The package is ESM-only (`"type": "module"`) and ships `"use client"` on every
component module, so it drops into a Next.js App Router server-component tree
without further ceremony.
