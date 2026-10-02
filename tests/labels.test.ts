import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import { EN_LABELS } from "../dist/labels/en.js";
import { HE_LABELS } from "../dist/labels/he.js";
import { withLabelOverrides } from "../dist/labels/index.js";

const DIST = path.join(import.meta.dirname, "..", "dist");

async function distFiles(dir: string): Promise<Array<string>> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return await distFiles(full);
            return entry.name.endsWith(".js") ? [full] : [];
        }),
    );
    return files.flat();
}

describe("shipped label tables", () => {
    test("both locales define the same keys", () => {
        assert.deepEqual(Object.keys(EN_LABELS).sort(), Object.keys(HE_LABELS).sort());
        assert.deepEqual(
            Object.keys(EN_LABELS.kinds).sort(),
            Object.keys(HE_LABELS.kinds).sort(),
        );
        assert.deepEqual(
            Object.keys(EN_LABELS.hints).sort(),
            Object.keys(HE_LABELS.hints).sort(),
        );
    });

    test("no string is left untranslated", () => {
        const flat = (labels: typeof EN_LABELS) => [
            labels.placeholder,
            labels.empty,
            labels.recents,
            ...Object.values(labels.kinds),
            ...Object.values(labels.hints),
        ];

        for (const value of [...flat(EN_LABELS), ...flat(HE_LABELS)]) {
            assert.equal(typeof value, "string");
            assert.notEqual(value.trim(), "");
        }
        // Every Hebrew string differs from its English counterpart, which is
        // what a copy-paste-and-forget mistake would break.
        assert.deepEqual(
            flat(HE_LABELS).filter((value) => flat(EN_LABELS).includes(value)),
            [],
        );
    });

    /*
     * The load-bearing test for "only one language per build": nothing in the
     * package may import either locale module, or a bundler would pull both in
     * no matter which one the host imported.
     */
    test("no shipped module imports a locale table", async () => {
        const offenders: Array<string> = [];

        for (const file of await distFiles(DIST)) {
            if (path.dirname(file) === path.join(DIST, "labels")) continue;
            const source = await readFile(file, "utf8");
            if (/from "[^"]*labels\/(en|he)\.js"/.test(source)) {
                offenders.push(path.relative(DIST, file));
            }
        }

        assert.deepEqual(offenders, []);
    });
});

describe("withLabelOverrides", () => {
    test("returns the base table untouched when there is nothing to override", () => {
        assert.equal(withLabelOverrides(EN_LABELS), EN_LABELS);
    });

    test("overlays top-level and nested fields without dropping siblings", () => {
        const merged = withLabelOverrides(EN_LABELS, {
            recents: "Frequent",
            hints: { run: "go" },
        });

        assert.equal(merged.recents, "Frequent");
        assert.equal(merged.hints.run, "go");
        assert.equal(merged.hints.close, EN_LABELS.hints.close);
        assert.equal(merged.placeholder, EN_LABELS.placeholder);
        assert.deepEqual(merged.kinds, EN_LABELS.kinds);
    });

    test("does not mutate the base table", () => {
        withLabelOverrides(EN_LABELS, { recents: "Frequent" });
        assert.equal(EN_LABELS.recents, "Recent");
    });
});
