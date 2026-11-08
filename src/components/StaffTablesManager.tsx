
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// ==========================================
// TODAVÍA HAY
// MESAS DEL MESERO
// ==========================================
//
// El mesero puede:
// - Ver mesas.
// - Seleccionar mesas.
// - Juntar mesas.
// - Separar grupos.
//
// El mesero NO puede:
// - Crear mesas.
// - Editar mesas.
// - Activar o desactivar mesas.
//
// ==========================================

type RestaurantTable = {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
  group_id: string | null;
};

type Props = {
  slug: string;
  lang: "es" | "en";
};

export default function StaffTablesManager({
  slug,
  lang,
}: Props) {
  const es = lang === "es";

  const [tables, setTables] =
    useState<RestaurantTable[]>([]);

  const [selected, setSelected] =
    useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const endpoint =
    `/api/businesses/${encodeURIComponent(slug)}/staff-tables`;

  // ========================================
  // CARGAR MESAS
  // ========================================

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/staff-tables`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
          "No se pudieron consultar las mesas.",
        );
      }

      setTables(result.tables ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al consultar mesas.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // ========================================
  // JUNTAR O SEPARAR MESAS
  // ========================================

  async function action(
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
          "No se pudo realizar la operación.",
        );
      }

      setTables(result.tables ?? []);
      setSelected([]);
      setNotice(successMessage);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el cambio.",
      );

      // Actualizar para ver si otro mesero
      // realizó cambios simultáneamente.
      await load();
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // SELECCIONAR MESAS
  // ========================================

  function toggleSelection(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  // ========================================
  // MESAS INDIVIDUALES
  // ========================================

  const standalone = useMemo(
    () => tables.filter((table) => !table.group_id),
    [tables],
  );

  // ========================================
  // MESAS AGRUPADAS
  // ========================================

  const groups = useMemo(() => {
    const map = new Map<string, RestaurantTable[]>();

    for (const table of tables) {
      if (!table.group_id) continue;

      const previous = map.get(table.group_id) ?? [];

      map.set(table.group_id, [
        ...previous,
        table,
      ]);
    }

    return [...map.entries()].map(
      ([id, members]) => ({
        id,
        members,
        capacity: members.reduce(
          (sum, table) => sum + table.capacity,
          0,
        ),
      }),
    );
  }, [tables]);

  const activeCount = tables.filter(
    (table) => table.active,
  ).length;

  // ========================================
  // JUNTAR MESAS
  // ========================================

  async function joinTables() {
    if (selected.length < 2) {
      setError(
        es
          ? "Selecciona al menos dos mesas."
          : "Select at least two tables.",
      );
      return;
    }

    await action(
      {
        action: "join",
        tableIds: selected,
      },
      es
        ? "Mesas agrupadas correctamente."
        : "Tables joined successfully.",
    );
  }

  // ========================================
  // SEPARAR MESAS
  // ========================================

  async function separateTables(groupId: string) {
    await action(
      {
        action: "separate",
        groupId,
      },
      es
        ? "Mesas separadas correctamente."
        : "Tables separated successfully.",
    );
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ========================================

  return (
    <div className="mt-8 space-y-6">

      {/* RESUMEN */}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

        <div className="rounded-2xl border border-[#eaded3] bg-white p-4">
          <p className="text-xs text-gray-500">
            {es
              ? "Mesas habilitadas"
              : "Enabled tables"}
          </p>

          <p className="mt-2 text-3xl font-black text-[#a3341f]">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-[#eaded3] bg-white p-4">
          <p className="text-xs text-gray-500">
            {es
              ? "Grupos de mesas"
              : "Table groups"}
          </p>

          <p className="mt-2 text-3xl font-black text-[#a3341f]">
            {groups.length}
          </p>
        </div>

        <div className="col-span-2 rounded-2xl border border-[#eaded3] bg-white p-4 sm:col-span-1">
          <p className="text-xs text-gray-500">
            {es
              ? "Mesas seleccionadas"
              : "Selected tables"}
          </p>

          <p className="mt-2 text-3xl font-black text-[#a3341f]">
            {selected.length}
          </p>
        </div>
      </div>

      {/* ACCIONES DEL MESERO */}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void joinTables()}
          disabled={busy || selected.length < 2}
          className="rounded-xl bg-[#a3341f] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {es
            ? "Juntar seleccionadas"
            : "Join selected"}
        </button>

        <button
          type="button"
          onClick={() => void load()}
          disabled={busy || loading}
          className="rounded-xl border border-[#eaded3] bg-white px-5 py-3 text-sm font-bold disabled:opacity-50"
        >
          {es ? "Actualizar" : "Refresh"}
        </button>
      </div>

      {/* MENSAJES */}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-800"
        >
          {notice}
        </p>
      )}

      {/* GRUPOS DE MESAS */}

      {groups.length > 0 && (
        <section>
          <h2 className="text-xl font-black text-[#302018]">
            {es
              ? "Mesas agrupadas"
              : "Joined tables"}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <article
                key={group.id}
                className="rounded-2xl border-2 border-[#a3341f] bg-white p-5"
              >
                <p className="text-xs font-bold uppercase text-[#a3341f]">
                  {es
                    ? "Grupo de mesas"
                    : "Table group"}
                </p>

                <h3 className="mt-2 text-lg font-black">
                  {group.members
                    .map((table) => table.name)
                    .join(" + ")}
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  {es
                    ? "Capacidad combinada"
                    : "Combined capacity"}
                  :{" "}
                  <strong>
                    {group.capacity}{" "}
                    {es ? "personas" : "guests"}
                  </strong>
                </p>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void separateTables(group.id)
                  }
                  className="mt-4 rounded-xl border border-[#a3341f] px-4 py-3 text-sm font-bold text-[#a3341f] disabled:opacity-50"
                >
                  {es
                    ? "Separar mesas"
                    : "Separate tables"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* MESAS INDIVIDUALES */}

      <section>
        <h2 className="text-xl font-black text-[#302018]">
          {es
            ? "Mesas del restaurante"
            : "Restaurant tables"}
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          {es
            ? "Selecciona dos o más mesas para juntarlas. La configuración de mesas corresponde al propietario."
            : "Select two or more tables to join them. Table configuration belongs to the owner."}
        </p>

        {loading && tables.length === 0 ? (
          <p className="mt-5 text-sm text-gray-600">
            {es
              ? "Cargando mesas..."
              : "Loading tables..."}
          </p>
        ) : standalone.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#eaded3] bg-white p-6 text-center">
            <p className="font-bold">
              {es
                ? "No hay mesas individuales habilitadas."
                : "No individual tables available."}
            </p>

            <p className="mt-2 text-sm text-gray-600">
              {es
                ? "El propietario puede agregar mesas desde Configuración."
                : "The owner can add tables from Settings."}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {standalone.map((table) => (
              <article
                key={table.id}
                className={`rounded-2xl border bg-white p-5 ${
                  selected.includes(table.id)
                    ? "border-2 border-[#a3341f]"
                    : "border-[#eaded3]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl">
                      🍽️
                    </p>

                    <h3 className="mt-2 text-lg font-black">
                      {table.name}
                    </h3>

                    <p className="mt-1 text-sm text-gray-600">
                      {table.capacity}{" "}
                      {es ? "personas" : "guests"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      table.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {table.active
                      ? es ? "Habilitada" : "Enabled"
                      : es ? "Inactiva" : "Disabled"}
                  </span>
                </div>

                {/* ÚNICA ACCIÓN SOBRE UNA MESA */}

                {table.active && (
                  <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl bg-[#fff7ef] p-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={selected.includes(table.id)}
                      disabled={busy}
                      onChange={() =>
                        toggleSelection(table.id)
                      }
                      className="size-4 accent-[#a3341f]"
                    />

                    {es
                      ? "Seleccionar para juntar"
                      : "Select to join"}
                  </label>
                )}

                {!table.active && (
                  <p className="mt-5 text-xs text-gray-500">
                    {es
                      ? "Mesa desactivada por el propietario."
                      : "Table disabled by owner."}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* AVISO SOBRE OCUPACIÓN */}

      <div className="rounded-xl border border-[#eaded3] bg-[#fff7ef] p-4">
        <p className="text-xs text-[#806b5d]">
          {es
            ? "Habilitada significa que la mesa está configurada para usarse, no necesariamente que esté libre. Cuando conectemos los pedidos, podrás abrir una mesa, tomar la orden y mantener la cuenta abierta hasta cobrar."
            : "Enabled means the table is configured for use, not necessarily unoccupied. Once orders are connected, you will be able to open tables and manage unpaid tabs."}
        </p>
      </div>
    </div>
  );
}
