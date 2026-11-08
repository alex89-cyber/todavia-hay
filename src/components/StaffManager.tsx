
"use client";

import {
  useState,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

export type StaffMember = {
  id: string;
  email: string;
  role: string;
};

type Props = {
  slug: string;
  members: StaffMember[];
};

const ROLES: Record<string, string> = {
  owner: "Dueño",
  manager: "Encargado",
  waiter: "Mesero",
  kitchen: "Cocina",
  staff: "Personal",
};

export function StaffManager({
  slug,
  members,
}: Props) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<
    "manager" | "waiter" | "kitchen"
  >("waiter");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ========================================
  // INVITAR EMPLEADO
  // ========================================

  async function invite(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/staff`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            email,
            role,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
          "No se pudo enviar la invitación",
        );
      }

      setEmail("");
      setMessage(
        result.message ??
        "Invitación enviada correctamente",
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error",
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // QUITAR EMPLEADO
  // ========================================

  async function remove(member: StaffMember) {
    if (busy || member.role === "owner") {
      return;
    }

    const confirmed = window.confirm(
      `¿Quitar a ${member.email} del negocio?`,
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/staff`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            userId: member.id,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
          "No se pudo quitar al empleado",
        );
      }

      setMessage(
        "Se quitó el acceso al negocio.",
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {/* AGREGAR EMPLEADO */}

      <section className="rounded-3xl border border-[#E7D9CC] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">
          Agregar empleado
        </h2>

        <p className="mt-2 text-sm text-[#786B62]">
          Invita a un empleado nuevo.
          Recibirá un correo para activar
          su cuenta de Todavía Hay.
        </p>

        <form
          onSubmit={invite}
          className="mt-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-2 text-sm font-bold">
            Correo electrónico

            <input
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="empleado@ejemplo.com"
              className="rounded-xl border border-[#E7D9CC] bg-[#FBF7F2] px-4 py-3 outline-none focus:border-[#A8321E]"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-bold">
            Perfil del empleado

            <select
              value={role}
              onChange={(event) =>
                setRole(
                  event.target.value as
                    "manager" |
                    "waiter" |
                    "kitchen",
                )
              }
              className="rounded-xl border border-[#E7D9CC] bg-[#FBF7F2] px-4 py-3"
            >
              <option value="waiter">
                Mesero
              </option>

              <option value="kitchen">
                Cocina
              </option>

              <option value="manager">
                Encargado
              </option>
            </select>
          </label>

          <div className="rounded-xl bg-[#F8F2EB] p-4 text-sm leading-6">
            <p className="font-bold">
              ¿Cómo entrará el empleado?
            </p>

            <p className="mt-1 text-[#786B62]">
              Primero activará su cuenta con
              el correo recibido. Después
              configuraremos su NIP personal
              y el dispositivo autorizado.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="rounded-full bg-[#A8321E] px-6 py-3 font-bold text-white disabled:opacity-50"
          >
            {busy
              ? "Enviando..."
              : "Enviar invitación"}
          </button>
        </form>
      </section>

      {/* MENSAJES */}

      {message && (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-800"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {error}
        </p>
      )}

      {/* LISTA DE PERSONAL */}

      <section className="rounded-3xl border border-[#E7D9CC] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">
          Personal registrado
        </h2>

        <p className="mt-2 text-sm text-[#786B62]">
          {members.length} persona(s)
          con acceso asignado al negocio.
        </p>

        <div className="mt-5 divide-y divide-[#EEE5DA]">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <p className="break-all font-semibold">
                  {member.email}
                </p>

                <p className="mt-1 text-sm text-[#786B62]">
                  {ROLES[member.role] ??
                    member.role}
                </p>
              </div>

              {member.role === "owner" ? (
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
                  Propietario
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(member)}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  Quitar acceso
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
