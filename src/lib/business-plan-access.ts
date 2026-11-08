
import "server-only";

import { admin } from "@/lib/accounts";

export type BusinessPlan =
  | "basic"
  | "medium"
  | "plus";

export type BusinessFeature =
  | "employees"
  | "tables"
  | "payments"
  | "kitchen";

const FEATURES: Record<
  BusinessPlan,
  BusinessFeature[]
> = {
  basic: [],

  medium: [
    "employees",
    "tables",
    "payments",
  ],

  plus: [
    "employees",
    "tables",
    "payments",
    "kitchen",
  ],
};

export async function getBusinessPlan(
  slug: string,
): Promise<BusinessPlan> {
  const { data, error } = await admin()
    .from("businesses")
    .select("plan")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      "No se pudo comprobar el plan del negocio.",
    );
  }

  if (!data) {
    throw new Error("Negocio no encontrado.");
  }

  if (
    data.plan !== "basic" &&
    data.plan !== "medium" &&
    data.plan !== "plus"
  ) {
    throw new Error(
      "El negocio no tiene un plan válido.",
    );
  }

  return data.plan;
}

export async function businessHasFeature(
  slug: string,
  feature: BusinessFeature,
): Promise<boolean> {
  const plan = await getBusinessPlan(slug);

  return FEATURES[plan].includes(feature);
}
