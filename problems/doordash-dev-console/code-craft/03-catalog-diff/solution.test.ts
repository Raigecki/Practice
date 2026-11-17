import { danglingDependencies, diffCatalog } from "./solution";
import type { Entity } from "./types";
import { DuplicateEntityError } from "./types";

const component = (name: string, overrides: Partial<Entity> = {}): Entity => ({
  kind: "Component",
  name,
  owner: "group:payments",
  lifecycle: "production",
  tags: [],
  dependsOn: [],
  ...overrides,
});

describe("DoorDash Dev Console: Catalog Diff", () => {
  describe("Part 1: added / removed / changed", () => {
    it("detects added and removed entities", () => {
      const diff = diffCatalog([component("ledger"), component("old-thing")], [component("ledger"), component("new-thing")]);
      expect(diff.added).toEqual(["component:default/new-thing"]);
      expect(diff.removed).toEqual(["component:default/old-thing"]);
      expect(diff.changed).toEqual([]);
    });

    it("detects changed entities", () => {
      const diff = diffCatalog([component("ledger")], [component("ledger", { lifecycle: "deprecated" })]);
      expect(diff.changed.map((c) => c.ref)).toEqual(["component:default/ledger"]);
    });

    it("refs are case-insensitive and include the namespace", () => {
      const diff = diffCatalog(
        [component("Ledger"), component("ledger", { namespace: "finance" })],
        [component("ledger"), component("ledger", { namespace: "Finance" })],
      );
      expect(diff).toEqual({ added: [], removed: [], changed: [] });
    });

    it("same name, different kind are different entities", () => {
      const diff = diffCatalog([component("payments")], [component("payments"), component("payments", { kind: "API" })]);
      expect(diff.added).toEqual(["api:default/payments"]);
    });

    it("outputs are sorted", () => {
      const diff = diffCatalog([], [component("c"), component("a"), component("b")]);
      expect(diff.added).toEqual(["component:default/a", "component:default/b", "component:default/c"]);
    });

    it("throws on duplicate entities in a snapshot", () => {
      expect(() => diffCatalog([component("x"), component("X")], [])).toThrow(DuplicateEntityError);
    });

    it("empty snapshots", () => {
      expect(diffCatalog([], [])).toEqual({ added: [], removed: [], changed: [] });
    });
  });

  describe("Part 2: field-level changes", () => {
    it("reports each changed field with before/after, in field order", () => {
      const diff = diffCatalog(
        [component("ledger", { owner: "group:payments", lifecycle: "experimental", tags: ["java"] })],
        [component("ledger", { owner: "group:finance", lifecycle: "production", tags: ["java", "tier-1"] })],
      );
      expect(diff.changed).toEqual([
        {
          ref: "component:default/ledger",
          changes: [
            { field: "owner", before: "group:payments", after: "group:finance" },
            { field: "lifecycle", before: "experimental", after: "production" },
            { field: "tags", before: ["java"], after: ["java", "tier-1"] },
          ],
        },
      ]);
    });

    it("tag order and duplicates are not changes", () => {
      const diff = diffCatalog(
        [component("ledger", { tags: ["b", "a"] })],
        [component("ledger", { tags: ["a", "b", "a"] })],
      );
      expect(diff.changed).toEqual([]);
    });

    it("owner comparison is case-insensitive", () => {
      const diff = diffCatalog([component("ledger", { owner: "group:Payments" })], [component("ledger", { owner: "group:payments" })]);
      expect(diff.changed).toEqual([]);
    });

    it("dependsOn compares normalized refs ('kind:name' means default namespace)", () => {
      const diff = diffCatalog(
        [component("ledger", { dependsOn: ["Component:payments"] })],
        [component("ledger", { dependsOn: ["component:default/payments", "resource:default/ledger-db"] })],
      );
      expect(diff.changed[0].changes).toEqual([
        {
          field: "dependsOn",
          before: ["component:default/payments"],
          after: ["component:default/payments", "resource:default/ledger-db"],
        },
      ]);
    });
  });

  describe("Part 3: danglingDependencies", () => {
    it("finds dependencies on entities that don't exist", () => {
      const snapshot = [
        component("ledger", { dependsOn: ["component:payments", "resource:ledger-db"] }),
        component("payments"),
      ];
      expect(danglingDependencies(snapshot)).toEqual([
        { ref: "component:default/ledger", missing: ["resource:default/ledger-db"] },
      ]);
    });

    it("missing refs are normalized, de-duplicated and sorted; results sorted by ref", () => {
      const snapshot = [
        component("zeta", { dependsOn: ["API:x"] }),
        component("alpha", { dependsOn: ["resource:b", "Resource:default/B", "resource:a"] }),
      ];
      expect(danglingDependencies(snapshot)).toEqual([
        { ref: "component:default/alpha", missing: ["resource:default/a", "resource:default/b"] },
        { ref: "component:default/zeta", missing: ["api:default/x"] },
      ]);
    });

    it("namespaced deps resolve correctly", () => {
      const snapshot = [
        component("ledger", { dependsOn: ["component:finance/payments"] }),
        component("payments", { namespace: "finance" }),
      ];
      expect(danglingDependencies(snapshot)).toEqual([]);
    });

    it("everything resolved", () => {
      expect(danglingDependencies([component("a")])).toEqual([]);
    });
  });
});
