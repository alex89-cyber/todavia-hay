
"use client";

import {
  AgStudioAiModule,
  AgStudioLicenseManager,
  createAiHarness,
  studioTheme,
  type AgStudioApi,
} from "ag-studio";
import { AgStudio } from "ag-studio-react";
import { useEffect, useMemo, useState } from "react";

import type { CashUpTables } from "@/lib/analytics";
import { geminiAdapter } from "./geminiAdapter";
import {
  cashUpFacts,
  dataSources,
  initialReport,
} from "./report";
import {
  ticketWidget,
  type TicketContext,
} from "./TicketWidget";

const license = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;

if (license) {
  AgStudioLicenseManager.setLicenseKey(license);
}

const font = "var(--font-geist-sans), system-ui, sans-serif";

const theme = studioTheme.withParams({
  fontFamily: font,
  studioCanvasFontFamily: font,
  studioWidgetTitleFontFamily: font,
  studioWidgetSubtitleFontFamily: font,
  chartFontFamily: font,

  accentColor: "#a3341f",
  textColor: "#2a1a14",
  subtleTextColor: "#7a6458",
  borderColor: "#eadfd3",

  backgroundColor: "#ffffff",
  studioCanvasBackgroundColor: "#fbf6ef",
  studioWidgetBackgroundColor: "#ffffff",

  studioWidgetBorder: {
    width: 1,
    color: "#eadfd3",
  },

  studioWidgetBorderRadius: 14,
  studioWidgetPadding: 10,
  studioWidgetTitleFontSize: 16,
  studioWidgetTitleFontWeight: "bold",
  studioWidgetTitleTextColor: "#2a1a14",
  studioWidgetSubtitleTextColor: "#7a6458",

  studioToggleButtonActiveBackgroundColor: "#a3341f",
  studioToggleButtonActiveBorderColor: "#a3341f",
  studioToggleButtonActiveColor: "#a3341f",

  chartTextColor: "#2a1a14",
  chartSubtleTextColor: "#7a6458",

  chartPaletteFills1Color: "#a3341f",
  chartPaletteFills2Color: "#e39b2d",
  chartPaletteFills3Color: "#2f7d5b",
  chartPaletteFills4Color: "#6b4e9b",
  chartPaletteFills5Color: "#d9653b",
  chartPaletteFills6Color: "#3d6e9e",
  chartPaletteFills7Color: "#8a6a3b",
  chartPaletteFills8Color: "#c2456b",
} as Record<string, unknown>);

const starters = {
  es: [
    {
      label: "¿Qué platillo me deja más?",
      prompt:
        "Según los datos del reporte seleccionado, ¿qué platillo generó más ingresos y cuántos vendí? Responde brevemente.",
    },
    {
      label: "¿Qué se me acaba?",
      prompt:
        "Si este reporte contiene información de inventario, dime qué ingredientes tienen menos existencias. Si no hay datos, indícalo claramente.",
    },
    {
      label: "Efectivo vs PayPal",
      prompt:
        "Compara las ventas registradas en efectivo, tarjeta y PayPal para el periodo mostrado.",
    },
    {
      label: "Mi mejor hora",
      prompt:
        "¿En qué horario se registraron más ingresos en este reporte? Agrega una gráfica si es posible.",
    },
  ],
  en: [
    {
      label: "Which dish earns most?",
      prompt:
        "Which dish generated the most revenue in the selected report, and how many were sold? Keep it short.",
    },
    {
      label: "What's running out?",
      prompt:
        "If inventory data is available, identify low-stock ingredients. Otherwise explain that inventory data is unavailable.",
    },
    {
      label: "Cash vs PayPal",
      prompt:
        "Compare cash, card and PayPal sales for the selected report.",
    },
    {
      label: "My best hour",
      prompt:
        "Which hour generated the most revenue in this report? Add a chart if possible.",
    },
  ],
};

export default function StudioDashboard({
  tables,
  lang,
  stallName,
  dateLabel,
}: {
  tables: CashUpTables;
  lang: "es" | "en";
  stallName: string;
  dateLabel: string;
}) {
  const [mode] = useState<"edit" | "view">(() =>
    window.innerWidth < 900 ? "view" : "edit",
  );

  // El inventario solo aparece si existen registros.
  const showInventory = tables.inventario.length > 0;

  // También evitamos presentar como real un contador
  // de apartados cuando no tenemos esos registros.
  const showReservations = tables.apartados.length > 0;

  const data = useMemo(
    () => dataSources(tables, lang),
    [tables, lang],
  );

  const initialState = useMemo(
    () => initialReport(lang, showInventory, showReservations),
    [lang, showInventory, showReservations],
  );

  const context = useMemo<TicketContext>(
    () => ({
      stallName,
      dateLabel,
      lang,
    }),
    [stallName, dateLabel, lang],
  );

  const widgets = useMemo(() => {
    const ticket = ticketWidget(lang);

    return (base: {
      widgets: readonly unknown[];
      menu: {
        label: string;
        widgetIds: readonly string[];
      }[];
      defaultType: string;
    }) => ({
      ...base,
      widgets: [...base.widgets, ticket],
      menu: [
        {
          label: lang === "es" ? "Del puesto" : "Stall",
          widgetIds: [ticket.id],
        },
        ...base.menu,
      ],
    });
  }, [lang]);

  const adapter = useMemo(
    () => geminiAdapter(lang),
    [lang],
  );

  useEffect(() => {
    adapter.setFacts(cashUpFacts(tables));
  }, [adapter, tables]);

  const ai = useMemo(
    () =>
      ({ api }: { api: AgStudioApi }) =>
        createAiHarness(api, {
          adapter,
          primary: "lead",
          promptStarters: starters[lang],
        }),
    [lang, adapter],
  );

  // Al cambiar entre reportes con y sin inventario,
  // React monta una instancia nueva de AG Studio.
  const studioKey = [
    lang,
    dateLabel,
    showInventory ? "inventory" : "no-inventory",
    showReservations ? "reservations" : "no-reservations",
  ].join("-");

  return (
    <AgStudio
      key={studioKey}
      style={{
        height: "100%",
        width: "100%",
      }}
      data={data}
      initialState={initialState}
      mode={mode}
      theme={theme}
      context={context}
      widgets={widgets as never}
      modules={[AgStudioAiModule]}
      ai={ai}
      onApiReady={(e: { api: AgStudioApi }) => {
        (
          window as unknown as {
            studio: AgStudioApi;
          }
        ).studio = e.api;
      }}
    />
  );
}
