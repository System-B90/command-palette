import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Imports the built package (the same entry point real consumers resolve).
import { CommandRegistry } from "../dist/core/registry.js";

const noop = () => {};

const command = (id: string) => ({ id, title: id, run: noop });

const EMPTY_QUERY = { text: "", kind: null };

describe("CommandRegistry stale-unsubscribe guard", () => {
    test("a replaced source's unsubscribe does not remove its replacement", () => {
        // This is React StrictMode's double-invoked effect: the same id is
        // registered twice and only then is the first cleanup run. Dropping
        // the identity check would delete live commands in every StrictMode
        // host while the simple unregister test stayed green.
        const registry = new CommandRegistry();
        const unsubscribeA = registry.register("x", [command("from-a")]);
        registry.register("x", [command("from-b")]);

        unsubscribeA();

        assert.deepEqual(
            registry.collect(EMPTY_QUERY).map((c) => c.id),
            ["from-b"],
        );
    });

    test("calling the same unsubscribe twice does not throw", () => {
        const registry = new CommandRegistry();
        const unsubscribe = registry.register("x", [command("only")]);

        unsubscribe();

        assert.doesNotThrow(() => unsubscribe());
        assert.deepEqual(registry.collect(EMPTY_QUERY), []);
    });

    test("a stale unsubscribe emits no notification", () => {
        const registry = new CommandRegistry();
        const unsubscribeA = registry.register("x", [command("from-a")]);
        registry.register("x", [command("from-b")]);

        let notifications = 0;
        registry.subscribe(() => {
            notifications += 1;
        });

        unsubscribeA();

        // Nothing changed, so nothing should re-render.
        assert.equal(notifications, 0);
    });

    test("a real unsubscribe emits exactly once, and a repeat emits none", () => {
        const registry = new CommandRegistry();
        const unsubscribe = registry.register("x", [command("only")]);

        let notifications = 0;
        registry.subscribe(() => {
            notifications += 1;
        });

        unsubscribe();
        assert.equal(notifications, 1);

        unsubscribe();
        assert.equal(notifications, 1);
    });

    test("the replacement's own unsubscribe still works afterwards", () => {
        const registry = new CommandRegistry();
        const unsubscribeA = registry.register("x", [command("from-a")]);
        const unsubscribeB = registry.register("x", [command("from-b")]);

        unsubscribeA();
        unsubscribeB();

        assert.deepEqual(registry.collect(EMPTY_QUERY), []);
    });

    test("re-registering the identical source array keeps it removable", () => {
        // Same reference registered twice: the guard compares by identity, so
        // the entry is still the one this closure owns.
        const registry = new CommandRegistry();
        const source = [command("shared")];
        registry.register("x", source);
        const unsubscribeSecond = registry.register("x", source);

        unsubscribeSecond();

        assert.deepEqual(registry.collect(EMPTY_QUERY), []);
    });

    test("register emits on every registration, including a replacement", () => {
        const registry = new CommandRegistry();
        let notifications = 0;
        registry.subscribe(() => {
            notifications += 1;
        });

        registry.register("x", [command("from-a")]);
        registry.register("x", [command("from-b")]);

        assert.equal(notifications, 2);
    });

    test("subscribe's own unsubscribe detaches the listener", () => {
        const registry = new CommandRegistry();
        let notifications = 0;
        const stop = registry.subscribe(() => {
            notifications += 1;
        });

        registry.register("x", [command("a")]);
        stop();
        registry.register("y", [command("b")]);

        assert.equal(notifications, 1);
    });
});

describe("CommandRegistry run", () => {
    test("runs a contributed command by id", () => {
        const registry = new CommandRegistry();
        let ran = 0;
        registry.register("x", [{ id: "go", title: "Go", run: () => (ran += 1) }]);

        registry.run("go");

        assert.equal(ran, 1);
    });

    test("does not run a disabled command", () => {
        const registry = new CommandRegistry();
        let ran = 0;
        registry.register("x", [
            { id: "go", title: "Go", enabled: false, run: () => (ran += 1) },
        ]);

        registry.run("go");

        assert.equal(ran, 0);
    });

    test("is a no-op for an unknown id", () => {
        const registry = new CommandRegistry();

        assert.doesNotThrow(() => registry.run("nope"));
    });

    test("does not run a command whose source was unregistered", () => {
        const registry = new CommandRegistry();
        let ran = 0;
        const unsubscribe = registry.register("x", [
            { id: "go", title: "Go", run: () => (ran += 1) },
        ]);

        unsubscribe();
        registry.run("go");

        assert.equal(ran, 0);
    });
});
