import { alpha, type Theme } from "@mui/material/styles";

/**
 * Translucent primary colour that works under both MUI theme flavours.
 *
 * A CSS-vars theme (`extendTheme` / `CssVarsProvider`, what Next.js apps use
 * for flash-free dark mode) exposes `theme.vars.palette.primary.mainChannel`,
 * and its `palette.primary.main` is a `var(...)` reference that `alpha()`
 * cannot parse. A classic theme has no `vars` at all but a real colour string.
 * Host apps use either, so probe for the channel and fall back to `alpha`.
 */
export function primaryAlpha(theme: Theme, opacity: number): string {
    const channel = theme.vars?.palette.primary.mainChannel;
    if (channel) return `rgb(${channel} / ${opacity})`;
    return alpha(theme.palette.primary.main, opacity);
}
