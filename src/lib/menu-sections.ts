import type { MenuSection } from "./stall";

// ==========================================
// TODAVÍA HAY
// AGRUPAR EL MENÚ POR SECCIÓN
// ==========================================
//
// Mismo orden en todos lados: secciones en
// el orden del dueño y al final "Otros" (los
// platillos sin sección). Las secciones sin
// platillos no se regresan.
// ==========================================

export type DishGroup<T> = {
  /** null = "Otros". */
  id: string | null;
  /** null = "Otros"; quien muestra pone el texto. */
  name: string | null;
  dishes: T[];
};

export function groupBySection<T extends { sectionId?: string | null }>(
  dishes: T[],
  sections: MenuSection[] | undefined,
): DishGroup<T>[] {
  const list = sections ?? [];
  const known = new Set(list.map((s) => s.id));

  const groups: DishGroup<T>[] = list.map((s) => ({
    id: s.id,
    name: s.name,
    dishes: dishes.filter((d) => d.sectionId === s.id),
  }));

  groups.push({
    id: null,
    name: null,
    dishes: dishes.filter((d) => !d.sectionId || !known.has(d.sectionId)),
  });

  return groups.filter((g) => g.dishes.length > 0);
}

/** Nombre a mostrar de un grupo. */
export function groupName(
  group: { name: string | null },
  lang: string,
): string {
  return group.name ?? (lang === "en" ? "Other" : "Otros");
}
