
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

type RestaurantTable = {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
  created_at: string;
};

type Props = {
  slug: string;
  lang: string;
};

export default function RestaurantTables({
  slug,
  lang,
}: Props) {
  const es = lang !== "en";

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");

  const endpoint =
    `/api/businesses/${encodeURIComponent(slug)}/tables`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/tables`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "No se pudieron cargar las mesas.",
        );
      }

      setTables(result.tables ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar las mesas.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setCapacity("4");
  }

  function newTable() {
    setEditingId(null);
    setName(`Mesa ${tables.length + 1}`);
    setCapacity("4");
    setShowForm(true);
    setNotice("");
    setError("");
  }

  function editTable(table: RestaurantTable) {
    setEditingId(table.id);
    setName(table.name);
    setCapacity(String(table.capacity));
    setShowForm(true);
    setNotice("");
    setError("");
  }

  async function saveTable(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const number = Number(capacity);

    if (
      !name.trim() ||
      !Number.isInteger(number) ||
      number < 1 ||
      number > 50
    ) {
      setError(
        es
          ? "Escribe un nombre y una capacidad de 1 a 50."
          : "Enter a name and a capacity between 1 and 50.",
      );
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name: name.trim(),
          capacity: number,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "No se pudo guardar.",
        );
      }

      resetForm();

      setNotice(
        es
          ? "Mesa guardada correctamente."
          : "Table saved successfully.",
      );

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al guardar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleTable(table: RestaurantTable) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: table.id,
          active: !table.active,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "No se pudo cambiar el estado.",
        );
      }

      setNotice(
        es
          ? "Estado de la mesa actualizado."
          : "Table status updated.",
      );

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al actualizar.",
      );
    } finally {
      setBusy(false);
    }
  }

  const activeCount = tables.filter(
    (table) => table.active,
  ).length;

  return (
    <section
      id="restaurant-tables"
      className="px-4 pt-8 sm:px-6 lg:px-8"
    >
      <div className="rounded-3xl border border-[#eaded3] bg-[#fffaf4] p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#a63822]">
              {es ? "Restaurante" : "Restaurant"}
            </p>

            <h2 className="mt-2 text-2xl font-black text-[#302018]">
              {es ? "Administración de mesas" : "Table management"}
            </h2>

            <p className="mt-2 text-sm text-[#806b5d]">
              {es
                ? "Configura las mesas y su capacidad. Los pedidos y la ocupación se conectarán después."
                : "Set up tables and seating capacity. Orders and occupancy will be connected later."}
            </p>

            {!loading && (
              <p className="mt-2 text-xs font-bold text-[#806b5d]">
                {activeCount} {es ? "mesas activas" : "active tables"}
                {" · "}
                {tables.length} {es ? "registradas" : "registered"}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading || busy}
              className="rounded-xl border border-[#eaded3] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"
            >
              {es ? "Actualizar" : "Refresh"}
            </button>

            <button
              type="button"
              onClick={newTable}
              disabled={busy}
              className="rounded-xl bg-[#a63822] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {es ? "+ Agregar mesa" : "+ Add table"}
            </button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800"
          >
            {notice}
          </p>
        )}

        {showForm && (
          <form
            onSubmit={saveTable}
            className="mt-5 rounded-2xl border border-[#eaded3] bg-white p-4"
          >
            <h3 className="font-bold">
              {editingId
                ? es ? "Editar mesa" : "Edit table"
                : es ? "Nueva mesa" : "New table"}
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="table-name"
                  className="mb-1 block text-sm font-semibold"
                >
                  {es ? "Nombre" : "Name"}
                </label>

                <input
                  id="table-name"
                  type="text"
                  required
                  maxLength={50}
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Mesa 1"
                  className="w-full rounded-xl border border-[#eaded3] p-3"
                />
              </div>

              <div>
                <label
                  htmlFor="table-capacity"
                  className="mb-1 block text-sm font-semibold"
                >
                  {es ? "Capacidad (personas)" : "Capacity (guests)"}
                </label>

                <input
                  id="table-capacity"
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  required
                  value={capacity}
                  onChange={(event) =>
                    setCapacity(event.target.value)
                  }
                  className="w-full rounded-xl border border-[#eaded3] p-3"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#a63822] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy
                  ? es ? "Guardando..." : "Saving..."
                  : es ? "Guardar mesa" : "Save table"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={busy}
                className="rounded-xl border border-[#eaded3] px-5 py-3 text-sm font-bold"
              >
                {es ? "Cancelar" : "Cancel"}
              </button>
            </div>
          </form>
        )}

        {loading && tables.length === 0 ? (
          <p className="mt-5 text-sm text-[#806b5d]">
            {es ? "Cargando mesas..." : "Loading tables..."}
          </p>
        ) : tables.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#dac8b8] bg-white p-6 text-center">
            <p className="font-bold">
              {es
                ? "Todavía no tienes mesas registradas."
                : "No tables registered yet."}
            </p>

            <p className="mt-2 text-sm text-[#806b5d]">
              {es
                ? "Presiona Agregar mesa para comenzar."
                : "Select Add table to get started."}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((table) => (
              <article
                key={table.id}
                className={`rounded-2xl border p-4 ${
                  table.active
                    ? "border-[#eaded3] bg-white"
                    : "border-gray-200 bg-gray-100 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="break-words text-lg font-black">
                      {table.name}
                    </h3>

                    <p className="mt-1 text-sm text-[#806b5d]">
                      {table.capacity}{" "}
                      {es ? "personas" : "guests"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      table.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {table.active
                      ? es ? "Activa" : "Active"
                      : es ? "Inactiva" : "Inactive"}
                  </span>
                </div>

                <p className="mt-4 text-xs text-[#806b5d]">
                  {es
                    ? "Sin pedidos asociados todavía"
                    : "Orders not connected yet"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => editTable(table)}
                    disabled={busy}
                    className="rounded-xl border border-[#eaded3] px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {es ? "Editar" : "Edit"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleTable(table)}
                    disabled={busy}
                    className="rounded-xl border border-[#eaded3] px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {table.active
                      ? es ? "Desactivar" : "Disable"
                      : es ? "Activar" : "Enable"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
