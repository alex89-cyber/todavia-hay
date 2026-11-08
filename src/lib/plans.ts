
// ==========================================
// TODAVÍA HAY
// FUNCIONES POR PLAN
// ==========================================

export type BusinessPlan =
  | "basic"
  | "medium"
  | "plus";

export type PlanFeature =
  | "menu"
  | "chatbot"
  | "inventory"
  | "reports"
  | "rewards"
  | "employees"
  | "tables"
  | "payments"
  | "kitchen";

export const PLANS: Record<
  BusinessPlan,
  {
    name: string;
    description: string;
    features: PlanFeature[];
  }
> = {
  basic: {
    name: "Básico",
    description: "Para negocios pequeños",
    features: [
      "menu",
      "chatbot",
      "inventory",
      "reports",
      "rewards",
    ],
  },

  medium: {
    name: "Medium",
    description: "Para negocios con empleados",
    features: [
      "menu",
      "chatbot",
      "inventory",
      "reports",
      "rewards",
      "employees",
      "tables",
      "payments",
    ],
  },

  plus: {
    name: "Plus",
    description: "Para negocios con cocina",
    features: [
      "menu",
      "chatbot",
      "inventory",
      "reports",
      "rewards",
      "employees",
      "tables",
      "payments",
      "kitchen",
    ],
  },
};

export function hasFeature(
  plan: BusinessPlan,
  feature: PlanFeature,
): boolean {
  return PLANS[plan].features.includes(feature);
}

export function normalizePlan(
  value: unknown,
): BusinessPlan {
  if (
    value === "medium" ||
    value === "plus"
  ) {
    return value;
  }

  return "basic";
}
