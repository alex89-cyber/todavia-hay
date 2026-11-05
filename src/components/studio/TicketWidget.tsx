"use client";

import type { AgWidgetDefinition } from "ag-studio-react";
import type { AgWidgetField, AgWidgetParams } from "ag-studio";
import { useEffect, useState } from "react";

// "Ticket del corte": a custom AG Studio widget drawn like the paper receipt a
// stall prints at closing. Any category + amount can be mapped to it (payment
// method by default, or dish, or hour), and it adds the total at the bottom.

export type TicketContext = { stallName: string; dateLabel: string; lang: "es" | "en" };
type Mapping = { concepto: AgWidgetField[]; importe: AgWidgetField[] };
type Row = { label: string; value: number; text: string };

function Ticket(props: AgWidgetParams) {
  const { widgetApi, sort, context } = props;
  const dm = props.dataMapping as unknown as Mapping;
  const ctx = context as TicketContext;
  const [rows, setRows] = useState<Row[] | null>(null);
  const concepto = dm.concepto?.[0];
  const importe = dm.importe?.[0];

  useEffect(() => {
    if (!concepto || !importe) {
      widgetApi.setDisplayState("incompleteDataMapping");
      return;
    }
    let live = true;
    widgetApi.setDisplayState("loading");
    widgetApi
      .getData({ fields: [concepto, importe], sort: sort?.map((s) => ({ field: s.field, direction: s.direction })) })
      .then(({ results }) => {
        if (!live) return;
        const r = results.rows.map((row) => ({
          label: widgetApi.formatFieldValue(concepto, row[concepto.key]),
          value: Number(row[importe.key] ?? 0),
          text: widgetApi.formatFieldValue(importe, row[importe.key]),
        }));
        setRows(r);
        widgetApi.setDisplayState(r.length ? "displayed" : "noData");
      })
      .catch(() => live && widgetApi.setDisplayState("noData"));
    return () => {
      live = false;
    };
  }, [widgetApi, concepto, importe, sort]);

  if (!rows || !importe) return null;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const es = ctx?.lang !== "en";

  return (
    <div className="th-ticket">
      <div className="th-ticket-paper">
        <p className="th-ticket-name">{ctx?.stallName}</p>
        <p className="th-ticket-date">{ctx?.dateLabel}</p>
        <p className="th-ticket-rule">{es ? "CORTE DE CAJA" : "CASH-UP"}</p>
        <ul>
          {rows.map((r) => (
            <li key={r.label}>
              <span>{r.label}</span>
              <i />
              <b>{r.text}</b>
            </li>
          ))}
        </ul>
        <p className="th-ticket-total">
          <span>TOTAL</span>
          <b>{widgetApi.formatFieldValue(importe, total)}</b>
        </p>
        <p className="th-ticket-thanks">{es ? "¡Gracias, buen día de venta!" : "Thanks, good selling day!"}</p>
      </div>
    </div>
  );
}

const receiptIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>';

export function ticketWidget(lang: "es" | "en"): AgWidgetDefinition {
  const es = lang === "es";
  return {
    id: "cashup-ticket",
    label: es ? "Ticket del corte" : "Cash-up receipt",
    icon: receiptIcon,
    comp: Ticket,
    dataMapping: {
      concepto: { type: "field", supportedRoles: ["category"], required: true, aiDescription: "What each receipt line is: payment method, dish, hour…" },
      importe: { type: "field", supportedRoles: ["numeric"], required: true, sort: true, aiDescription: "The amount on each line, usually ventas.importe summed. The receipt adds the total." },
    },
    form: (p) =>
      p.createDefaults({
        dataMappingItems: [
          { key: "concepto", label: es ? "Concepto" : "Line" },
          { key: "importe", label: es ? "Importe" : "Amount" },
        ],
      }),
    defaultState: {
      dataMapping: { concepto: [{ id: "ventas.metodo" }], importe: [{ id: "ventas.importe", aggregation: "sum" }] },
    },
    defaultSize: { width: 8, height: 30 },
    minSize: { width: 6, height: 18 },
    toolbar: ["duplicate", "delete"],
    ai: {
      label: es ? "Ticket del corte" : "Cash-up receipt",
      description: "A paper-receipt style summary: one line per category with its amount, and the total at the bottom.",
      usage: "Use it to sum up the day's money, e.g. amount per payment method or per dish.",
    },
  };
}
