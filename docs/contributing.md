# Contributing

## Setup

```bash
npm ci
```

Requires Node 22+ (CI runs 24) and no registry authentication unless you
are installing the package elsewhere — this repo itself has no private
dependencies.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run build` | `tsc` then `tsc-alias`. The second step is not optional — see below. |
| `npm run clean` | Removes `dist/`. Run it after deleting or renaming a source file; `tsc` does not prune stale output. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm test` | Builds (via `pretest`), then runs the unit tests against `dist/`. |

## House rules

**Internal imports use the `@/*` alias.** `no-restricted-imports` enforces it.
Keep the `.js` extension on every internal specifier — the package is ESM, and
the emitted code must resolve at runtime. `tsc-alias` rewrites `@/…` to relative
paths during `build`; without it the published package would not resolve at all.

**Every component and hook module starts with `"use client"`.** Hosts are
Next.js App Router apps.

**No runtime dependencies.** `react` and `@mui/*` are peers. Adding a dependency
is a deliberate decision affecting three apps, not a convenience.

**No copy outside `src/labels/`.** Nothing in the package may import
`labels/en.js` or `labels/he.js` — see
[Language & Localisation](localisation.md#only-the-language-you-import-is-built-in).
`tests/labels.test.ts` fails the build if that is violated.

**No host-app knowledge.** No domain concepts, no routes, no assumptions about
what a "course" is.

## Tests

`tests/` covers `core/` — registry, matcher, ranking, prefix parsing, shortcut
matching — plus the label tables and the no-locale-coupling invariant. They
import from `dist/`, the same entry point consumers resolve, which is why
`pretest` builds first.

The React layer has no test harness in this repo. UI behaviour is covered by the
consuming apps' E2E suites. If you change dialog behaviour, run those suites
against your branch.

Add a test when you change scoring, normalisation, or anything in `core/`. The
scoring constants are load-bearing and easy to nudge by accident.

## Documentation

Prose lives in `docs/` and is built with mkdocs-material; the API reference in
`docs/api/` is **generated** by TypeDoc from TSDoc comments in `src/` and is
gitignored — never edit it by hand.

```bash
pip install mkdocs-material mkdocs-typedoc
python -m mkdocs serve     # http://127.0.0.1:8000
```

Document *why* in the source and *how* in `docs/`. The comments in `src/` skew
toward rationale on purpose — the mechanics are readable from the code, the
trade-offs are not.

## Git

Commit format: `Vibe-<PastTenseVerb> <description>` — `Vibe-Added`, `Vibe-Fixed`.
No `feat:`/`fix:`/`chore:` prefixes. Never commit directly to `master`; branch
and open a PR.

## CI

| Workflow | Trigger | Does |
| --- | --- | --- |
| `verify.yml` | PR, push to master, dispatch | Lint → typecheck → tests, each with `if: !cancelled()` so one failure does not mask another. |
| `docs.yml` | Tags, dispatch | Builds the mkdocs site and deploys to GitHub Pages. |
| `publish.yml` | GitHub Release, dispatch | Builds and publishes to npm (with provenance); skips if the version is already on the registry. |

## Releasing

1. Bump `version` in `package.json`. Consumers pin exact versions, so this is a
   deliberate act, not an automated one.
2. Merge to `master`.
3. Cut a GitHub Release. `publish.yml` builds and publishes.
4. Bump the dependency in each consuming app as it is ready.

Follow semver against the **public API** — the exports of `.`, `./core`, `./en`
and `./he`, plus the ARIA contract in [Accessibility](accessibility.md). The DOM
structure and class names are not public.

Breaking changes worth flagging loudly: anything in `CommandPaletteLabels` (every
host must supply the new field), the `Command` shape, or the scoring behaviour if
an app has tuned `priority` values against it.
