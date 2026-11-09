import { describe, expect, it } from "vitest";

import { groupBySection, groupName } from "./menu-sections";

const sections = [
  { id: "s1", name: "Tacos", toKitchen: true },
  { id: "s2", name: "Bebidas", toKitchen: false },
  { id: "s3", name: "Vacía", toKitchen: true },
];

describe("groupBySection", () => {
  it("respeta el orden de las secciones, pone Otros al final y quita las vacías", () => {
    const dishes = [
      { id: "a", sectionId: "s2" },
      { id: "b", sectionId: null },
      { id: "c", sectionId: "s1" },
      { id: "d", sectionId: "borrada" },
    ];
    const groups = groupBySection(dishes, sections);
    expect(groups.map((g) => g.id)).toEqual(["s1", "s2", null]);
    expect(groups[2].dishes.map((d) => d.id)).toEqual(["b", "d"]);
    expect(groupName(groups[2], "es")).toBe("Otros");
  });

  it("sin secciones regresa un solo grupo", () => {
    const groups = groupBySection([{ id: "a", sectionId: null }], undefined);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBeNull();
  });
});
