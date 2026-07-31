# Accessibility

The palette implements the standard combobox-with-listbox pattern: focus stays
in the text field at all times, and selection is communicated to assistive
technology through `aria-activedescendant` rather than by moving focus.

## Roles and attributes

| Element | Markup |
| --- | --- |
| Query field | `role="combobox"`, `aria-expanded="true"`, `aria-controls="<listbox id>"`, `aria-activedescendant="<listbox id>-option-<index>"`, `aria-label={labels.placeholder}` |
| Result list | `role="listbox"`, `aria-label={labels.placeholder}`, a generated `id` |
| Group block | `role="group"`, `aria-label={group name}` |
| Group heading | `aria-hidden` — the name is already on the group's `aria-label`, so this avoids reading it twice |
| Result row | `role="option"`, `aria-selected`, `aria-disabled` when `enabled === false`, a stable `id` |

Ids are generated with React's `useId`, so several palettes on one page (or an
SSR/CSR pair) cannot collide.

`aria-activedescendant` is omitted entirely when there are no results, rather
than pointing at a non-existent id.

## Keyboard model

| Key | Behaviour |
| --- | --- |
| ++ctrl+k++ / ++cmd+k++ | Open, all lanes |
| ++ctrl+shift+p++ / ++cmd+shift+p++ | Open, command lane pre-selected |
| ++up++ / ++down++ | Move selection, **skipping disabled rows**, without wrapping past either end |
| ++home++ / ++end++ | First / last selectable row |
| ++enter++ | Run the selected command |
| ++backspace++ | On an empty field with a lane active, clears the lane |
| ++esc++ | Close (MUI `Dialog` default) |

Selection never wraps. Wrapping in a list whose length changes on every
keystroke tends to teleport the user somewhere unexpected; stopping at the ends
is more predictable.

Any change to the result set resets selection to the first **selectable** row —
not index 0, which may be disabled.

The selected row is kept in view with `scrollIntoView({ block: "nearest" })`,
which scrolls the minimum amount rather than centring and re-centring as you
arrow along.

### The open shortcuts

Both are modifier combinations, so unlike a bare-key binding they cannot fire
while the user is typing into a field. Both also accept the Hebrew-layout
letters that sit on the same physical keys (`ל` for `k`, `פ` for `p`), so the
shortcut works without switching layout. ++ctrl+k++ requires ++shift++ to be
absent, keeping the two bindings distinct.

Either can be disabled: `hotkeys={{ quickOpen: false, commandMode: false }}`.

### Command shortcuts

The global handler for `Command.shortcut` ignores keydowns while focus is in an
`<input>` or `<textarea>`, so a contributed shortcut cannot fire mid-typing.

## Focus management

The dialog's own focus trap moves focus to the paper when its transition ends,
which lands *after* both `autoFocus` on the input and the on-open effect. The
palette therefore re-grabs focus in the transition's `onEntered` callback. Without
that, opening by mouse click left the field unfocused, because the trigger button
kept focus.

On close, MUI's `Dialog` restores focus to whatever had it before — the trigger
button, or the page.

## Screen-reader notes

- **Match highlighting is visual only.** Matched characters are wrapped in
  `<mark>` with `color: primary.main`; there is no extra announcement, so the
  title reads as one continuous string.
- **The keycap hints** in the footer are `<kbd>` elements with their labels
  beside them, read as ordinary content.
- **Disabled rows are announced** via `aria-disabled` rather than removed, which
  is why they are kept in the list at all.

## What is not covered

- **Reduced motion.** The dialog uses MUI's default transition at a 150 ms
  duration; it does not currently check `prefers-reduced-motion`. If your app
  needs it, a theme-level transition override reaches it.
- **Forced-colours / high-contrast mode** has not been explicitly tested. The
  selection treatment is a translucent tint plus a border, so it degrades to the
  border, but this is untested rather than verified.
- **Touch.** The palette is keyboard-first. Rows are clickable and the dialog is
  responsive, but there is no touch-specific affordance.
