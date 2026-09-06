import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as route from "./productEditorRoute";
import type { ProductEditorController } from "./useProductEditorLifecycle";

// Drive the real hook with separate local-state and router commits, as happens
// when React Router transitions the URL after an urgent row-click update.
function editorHarness(initialQuery = "") {
  const slots: any[] = [];
  let cursor = 0;
  let dirty = false;
  let query = new URLSearchParams(initialQuery);
  let pendingQuery: URLSearchParams | undefined;
  let effects: Array<() => void> = [];
  const loads: string[] = [];
  const products = [
    { id: "product-1", barcode: "8850000000001" },
    { id: "product-2", barcode: "8850000000002" },
  ];
  const session = (product: unknown) => ({ mode: "edit", product });
  const lifecycle = {
    openCreate: () => ({ mode: "create", product: null }),
    openProduct: session,
    openLinked: async (id: string) => {
      loads.push(id);
      return { kind: "opened", session: session(products.find((p) => p.id === id)) };
    },
  };
  const sameDeps = (a?: unknown[], b?: unknown[]) => Boolean(
    a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])),
  );
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => {
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) dirty = true;
        slots[index] = value;
      }];
    },
    useCallback(callback: any, deps: unknown[]) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(callback: () => void | (() => void), deps: unknown[]) {
      const index = cursor++;
      const previous = slots[index];
      if (sameDeps(previous?.deps, deps)) return;
      slots[index] = { deps };
      effects.push(() => {
        previous?.cleanup?.();
        slots[index].cleanup = callback();
      });
    },
    useEffectEvent(callback: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { event: (...args: any[]) => slots[index].callback(...args) };
      slots[index].callback = callback;
      return slots[index].event;
    },
  };
  const setSearchParams = (update: (current: URLSearchParams) => URLSearchParams) => {
    pendingQuery = update(query);
  };
  const exports: any = {};
  const source = readFileSync(new URL("./useProductEditorLifecycle.ts", import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports,
    console,
    require: (name: string) => {
      if (name === "react") return hooks;
      if (name === "react-router") return { useSearchParams: () => [query, setSearchParams] };
      if (name === "./productEditorRoute") return route;
      if (name === "./productEditorLifecycle") return { createProductEditorLifecycle: () => lifecycle };
      if (name === "./productEditorPersistence") return { createHttpProductEditorAdapter: () => ({}) };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  let controller: ProductEditorController;
  function render() {
    let commits = 0;
    do {
      assert.ok(++commits < 20, "editor must settle without a render loop");
      dirty = false;
      cursor = 0;
      effects = [];
      controller = exports.useProductEditorLifecycle({
        inventory: { products, total: products.length },
        onReconcile() {},
        onRefresh() {},
      });
      effects.forEach((effect) => effect());
    } while (dirty);
    return controller;
  }
  return {
    render,
    loads,
    commitRoute(next?: string) {
      query = next === undefined ? pendingQuery! : new URLSearchParams(next);
      pendingQuery = undefined;
      return render();
    },
  };
}

test("clicking a stock row keeps its editor open while the URL transition is pending", () => {
  const app = editorHarness();
  app.render().openEdit("8850000000001");
  assert.equal(app.render().product?.id, "product-1", "editor must not blink closed before navigation commits");
  assert.equal(app.commitRoute().product?.id, "product-1");
  assert.deepEqual(app.loads, [], "a visible row must not be fetched again");
});

test("switching products keeps the clicked product visible until navigation commits", () => {
  const app = editorHarness();
  app.render().openEdit("8850000000001");
  app.commitRoute();
  app.render().openEdit("8850000000002");
  assert.equal(app.render().product?.id, "product-2");
  assert.equal(app.commitRoute().product?.id, "product-2");
  assert.deepEqual(app.loads, []);
});

test("closing the editor does not reload the product from the previous URL", () => {
  const app = editorHarness();
  app.render().openEdit("8850000000001");
  app.commitRoute();
  app.render().close();
  assert.equal(app.render().isOpen, false);
  assert.deepEqual(app.loads, []);
  assert.equal(app.commitRoute().isOpen, false);
});

test("direct links and browser history still synchronize the editor", async () => {
  const app = editorHarness("edit=product-1");
  app.render();
  await Promise.resolve();
  assert.equal(app.render().product?.id, "product-1");
  assert.equal(app.commitRoute("").isOpen, false);
  app.commitRoute("edit=product-2");
  await Promise.resolve();
  assert.equal(app.render().product?.id, "product-2");
  assert.deepEqual(app.loads, ["product-1", "product-2"]);
});
