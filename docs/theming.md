# Theming & RTL

## It uses your theme

The palette renders with MUI primitives (`Dialog`, `InputBase`, `Chip`,
`Typography`, `Box`) and reads everything visual from the ambient theme:

| Token | Used for |
| --- | --- |
| `background.paper` | Sheet background, keycap fill |
| `divider` | Sheet border, field/footer separators, group separators, keycap border |
| `primary.main` | Active search icon, match highlighting, lane chip, selected-row tint and accent |
| `text.primary` / `text.secondary` | Title / subtitle, group headings, hints |
| `action.hover` | Icon tiles, footer bar |
| `action.disabledBackground` | Scrollbar thumb |

So it inherits your palette, your dark mode and your font. There is no theme
prop and no CSS to import. The provider must be **inside** your `ThemeProvider`.

The only layout knob is `width` (default `640`), capped at `calc(100vw - 32px)`.
The sheet is top-anchored at `12vh`, and the result list is capped at
`min(50vh, 420px)`.

## Classic themes and CSS-variables themes

MUI 7 has two theme flavours, and the palette supports both.

A **CSS-variables theme** (`extendTheme` + `CssVarsProvider`, what Next.js apps
use for flash-free dark mode) exposes channel tokens such as
`theme.vars.palette.primary.mainChannel` — `"25 118 210"` — and its
`palette.primary.main` is a `var(--mui-palette-primary-main)` reference, which
MUI's `alpha()` cannot parse. A **classic theme** has no `vars` at all, but a
real colour string that `alpha()` handles fine.

`src/theme.ts` bridges the two:

```ts
export function primaryAlpha(theme: Theme, opacity: number): string {
    const channel = theme.vars?.palette.primary.mainChannel;
    if (channel) return `rgb(${channel} / ${opacity})`;
    return alpha(theme.palette.primary.main, opacity);
}
```

Selected rows use `primaryAlpha(theme, 0.12)` for the background, `0.22` for the
inline-start accent, and `0.16` for the icon tile.

!!! note "Why a tint rather than a solid selected fill"
    Matched characters inside a title are drawn in `primary.main`. On a solid
    primary fill they would be invisible. The tint-plus-accent-bar treatment
    keeps the highlighting legible on the selected row, which is the row the
    user is actually reading.

## RTL

The palette is used against Hebrew UIs, and is RTL-correct throughout:

- Spacing and borders use **logical properties** (`borderInlineStart`,
  `px`/`py` via MUI's direction-aware system), so the selection accent sits on
  the reading-start edge in both directions.
- The query field **inherits the ambient direction** rather than pinning its
  own, so it reads the same way as the rest of your app.
- Text is not reversed, re-ordered or otherwise touched by the matcher's
  normalisation — only compared.

Two things deliberately opt out of the ambient direction.

### The lane chip

The lane prefix (`>`, `@`, `:`) never appears inside the input. `parseQuery`
strips it and the dialog renders it as a MUI `Chip` beside the field, with the
raw value reconstructed by `buildRawQuery` on every change.

An ASCII prefix left in an RTL field would be laid out at the wrong visual end
of the query — logically first, visually last — which reads as a stray character
rather than as a mode indicator. Lifting it into a chip sidesteps bidi entirely,
and doubles as a clearer affordance: the chip has a delete button that returns
you to searching all lanes. ++backspace++ on an empty field does the same.

### Key sequences

`ShortcutKeys` pins itself to `direction: "ltr"` and reverses its source order.
A chord is written modifier-first in every locale — ++ctrl+z++, never
"Z Ctrl" — but MUI's RTL stylis plugin mirrors `flex-direction` for the whole
page, keycaps included. Reversing the source order means the row comes out
modifier-first *after* that mirroring applies.

`KeyChip` also swaps a few key names for glyphs: `ArrowUp`/`Down`/`Left`/`Right`
become arrow icons, `Enter` → `↵`, `Escape` → `Esc`, `Backspace` → `⌫`,
`Shift` → `⇧`. Anything else renders as given, so pass `"Ctrl"`, not `"CTRL"`.

## Customising appearance

There is intentionally no `sx` passthrough or slot API. If you need one, the
honest options are, in order:

1. **Change your theme.** Most of what looks wrong is a palette token.
2. **Target it from your theme's `components` overrides.** The palette uses
   stock MUI components, so `MuiDialog` overrides reach it.
3. **Raise it as a package change.** If two apps want the same knob, it belongs
   here — as a prop with a documented default, not as an escape hatch.

Cherry-picking internals with CSS selectors will break; the DOM structure is not
part of the public API. The ARIA roles [are](accessibility.md).
