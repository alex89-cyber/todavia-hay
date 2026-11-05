
"use client";

import {
  useState,
  type FormEvent,
} from "react";

type ContactMethod = "whatsapp" | "email" | "call";

type ContactForm = {
  name: string;
  business: string;
  email: string;
  phone: string;
  method: ContactMethod;
  message: string;
  website: string;
};

const INITIAL_FORM: ContactForm = {
  name: "",
  business: "",
  email: "",
  phone: "",
  method: "whatsapp",
  message: "",
  website: "",
};

const CONTACTS = [
  {
    name: "María Fernanda Pineda Pat",
    email: "ferpinpat05@gmail.com",
    phone: "+525539047960",
  },
  {
    name: "Alejandro Bonilla Ávila",
    email: "alexbonilla180305@gmail.com",
    phone: "+525551951931",
  },
];

const fieldClass =
  "w-full rounded-2xl border border-[#E2E8DD] bg-[#FAFBF8] px-4 py-3.5 text-sm text-[#244D38] outline-none transition placeholder:text-[#A3AEA4] focus:border-[#6DA27D] focus:ring-4 focus:ring-[#6DA27D]/10";

export function ContactSection({
  lang,
}: {
  lang: string;
}) {
  const es = lang === "es";

  const [form, setForm] =
    useState<ContactForm>(INITIAL_FORM);

  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);

  const [status, setStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const [errorMessage, setErrorMessage] = useState("");

  function update<K extends keyof ContactForm>(
    key: K,
    value: ContactForm[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));

    if (status !== "idle") {
      setStatus("idle");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sending || !consent) return;

    setSending(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          lang: es ? "es" : "en",
          consent,
        }),
      });

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error === "not_configured"
            ? es
              ? "El formulario todavía no tiene configurado el correo de envío."
              : "The email delivery service is not configured yet."
            : es
              ? "No pudimos enviar tu solicitud. Inténtalo de nuevo."
              : "We couldn't send your request. Please try again.",
        );
      }

      setStatus("success");
      setForm(INITIAL_FORM);
      setConsent(false);
    } catch (error) {
      setStatus("error");

      setErrorMessage(
        error instanceof Error
          ? error.message
          : es
            ? "Ocurrió un error al enviar la solicitud."
            : "Something went wrong.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      id="contacto"
      className="scroll-mt-24 bg-[#F4F6F1] px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-[#E8F0E3] px-4 py-2 text-[11px] font-black uppercase tracking-[0.17em] text-[#54815B]">
            {es ? "Hablemos de tu negocio" : "Let's talk business"}
          </span>

          <h2 className="mt-6 text-4xl font-black leading-[1.1] tracking-[-0.055em] text-[#244D38] sm:text-5xl">
            {es ? (
              <>
                Una buena idea empieza
                <br />
                <span className="text-[#E68B5C]">
                  con un hola.
                </span>
              </>
            ) : (
              <>
                Every great idea starts
                <br />
                <span className="text-[#E68B5C]">
                  with hello.
                </span>
              </>
            )}
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#78877C]">
            {es
              ? "Queremos conocer tu negocio. Puedes escribirnos directamente o dejarnos tus datos y nosotros nos ponemos en contacto contigo."
              : "We'd love to learn about your business. Reach out directly or leave your details and we'll get in touch."}
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* CONTACTOS DIRECTOS */}
          <div className="flex flex-col gap-5">
            <div className="rounded-[2rem] border border-[#E4EAE1] bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6">
                <h3 className="text-xl font-black text-[#244D38]">
                  {es
                    ? "Contacto directo"
                    : "Get in touch directly"}
                </h3>

                <p className="mt-2 text-sm leading-7 text-[#7D8A80]">
                  {es
                    ? "Estamos a un mensaje de distancia."
                    : "We're just one message away."}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {CONTACTS.map((contact, index) => {
                  const whatsappNumber =
                    contact.phone.replace(/\D/g, "");

                  const whatsappText = encodeURIComponent(
                    es
                      ? "Hola, me interesa conocer más sobre ¿Todavía hay?."
                      : "Hi, I'd like to learn more about ¿Todavía hay?.",
                  );

                  const emailSubject = encodeURIComponent(
                    es
                      ? "Información sobre ¿Todavía hay?"
                      : "Information about ¿Todavía hay?",
                  );

                  return (
                    <div
                      key={contact.email}
                      className="group rounded-2xl border border-[#E5ECE3] bg-[#FBFCFA] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#C5DCC8] hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${
                            index === 0
                              ? "bg-[#E8F0E3] text-[#426B4D]"
                              : "bg-[#FCEBDF] text-[#BF7954]"
                          }`}
                        >
                          {contact.name.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <h4 className="break-words text-sm font-black text-[#244D38] sm:text-base">
                            {contact.name}
                          </h4>

                          <p className="mt-1 text-xs text-[#859587]">
                            {es
                              ? "Equipo ¿Todavía hay?"
                              : "¿Todavía hay? team"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2 text-sm text-[#607668]">
                        <a
                          href={`mailto:${contact.email}?subject=${emailSubject}`}
                          className="block break-all transition hover:text-[#244D38] hover:underline"
                        >
                          ✉ {contact.email}
                        </a>

                        <a
                          href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block transition hover:text-[#244D38] hover:underline"
                        >
                          ◉ {contact.phone}
                        </a>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <a
                          href={`mailto:${contact.email}?subject=${emailSubject}`}
                          className="flex items-center justify-center gap-2 rounded-xl border border-[#DDE6DB] bg-white px-3 py-3 text-xs font-bold text-[#244D38] transition hover:border-[#244D38]"
                        >
                          {es ? "Correo" : "Email"}
                          <span aria-hidden="true">↗</span>
                        </a>

                        <a
                          href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 rounded-xl bg-[#244D38] px-3 py-3 text-xs font-bold text-white transition hover:bg-[#32684C]"
                        >
                          WhatsApp
                          <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] bg-[#244D38] p-7 text-white sm:p-8">
              <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full border-[25px] border-white/10" />

              <span className="relative text-3xl">
                ✳
              </span>

              <h3 className="relative mt-5 text-xl font-black">
                {es
                  ? "Tu negocio es único."
                  : "Your business is unique."}
              </h3>

              <p className="relative mt-3 text-sm leading-7 text-[#D4E7D8]">
                {es
                  ? "Nos encantará escuchar tus ideas y explorar cómo podemos ayudarte."
                  : "We'd love to hear your ideas and explore how we can help."}
              </p>
            </div>
          </div>

          {/* FORMULARIO */}
          <div className="rounded-[2rem] border border-[#E4EAE1] bg-white p-6 shadow-[0_20px_50px_rgba(31,62,42,0.05)] sm:p-8 lg:p-10">
            <div className="mb-8">
              <span className="inline-flex rounded-full bg-[#FCEDE3] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#C17F59]">
                {es ? "Te contactamos" : "Request a callback"}
              </span>

              <h3 className="mt-4 text-2xl font-black tracking-tight text-[#244D38] sm:text-3xl">
                {es
                  ? "¿Quieres que te contactemos?"
                  : "Want us to contact you?"}
              </h3>

              <p className="mt-3 text-sm leading-7 text-[#7D8A80]">
                {es
                  ? "Cuéntanos un poquito sobre ti. Fernanda y Alejandro recibirán tu mensaje."
                  : "Tell us a little about yourself. Fernanda and Alejandro will receive your message."}
              </p>
            </div>

            <form
              onSubmit={submit}
              className="flex flex-col gap-5"
            >
              {/* Campo invisible contra bots */}
              <div
                className="absolute -left-[9999px]"
                aria-hidden="true"
              >
                <label htmlFor="contact-website">
                  Website
                </label>

                <input
                  id="contact-website"
                  type="text"
                  name="website"
                  value={form.website}
                  onChange={(event) =>
                    update("website", event.target.value)
                  }
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="mb-2 block text-xs font-bold text-[#526C59]"
                  >
                    {es ? "Tu nombre" : "Your name"} *
                  </label>

                  <input
                    id="contact-name"
                    className={fieldClass}
                    placeholder={
                      es ? "Nombre completo" : "Full name"
                    }
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={form.name}
                    onChange={(event) =>
                      update("name", event.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-business"
                    className="mb-2 block text-xs font-bold text-[#526C59]"
                  >
                    {es
                      ? "Nombre de tu negocio"
                      : "Business name"}
                  </label>

                  <input
                    id="contact-business"
                    className={fieldClass}
                    placeholder={
                      es ? "Tu establecimiento" : "Your business"
                    }
                    maxLength={120}
                    value={form.business}
                    onChange={(event) =>
                      update("business", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-email"
                    className="mb-2 block text-xs font-bold text-[#526C59]"
                  >
                    {es ? "Correo electrónico" : "Email"} *
                  </label>

                  <input
                    id="contact-email"
                    type="email"
                    className={fieldClass}
                    placeholder="correo@ejemplo.com"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={form.email}
                    onChange={(event) =>
                      update("email", event.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-phone"
                    className="mb-2 block text-xs font-bold text-[#526C59]"
                  >
                    {es ? "Teléfono" : "Phone"} *
                  </label>

                  <input
                    id="contact-phone"
                    type="tel"
                    className={fieldClass}
                    placeholder="+52 55 1234 5678"
                    autoComplete="tel"
                    required
                    minLength={8}
                    maxLength={30}
                    value={form.phone}
                    onChange={(event) =>
                      update("phone", event.target.value)
                    }
                  />
                </div>
              </div>

              <fieldset>
                <legend className="mb-3 text-xs font-bold text-[#526C59]">
                  {es
                    ? "¿Cómo prefieres que te contactemos?"
                    : "How would you like us to reach you?"}
                </legend>

                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["whatsapp", "WhatsApp"],
                      ["email", es ? "Correo" : "Email"],
                      ["call", es ? "Llamada" : "Phone call"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition ${
                        form.method === value
                          ? "border-[#244D38] bg-[#EAF3E8] text-[#244D38]"
                          : "border-[#E2E8DD] bg-[#FAFBF8] text-[#78877C] hover:border-[#B9CCB9]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="contactMethod"
                        value={value}
                        checked={form.method === value}
                        onChange={() =>
                          update("method", value)
                        }
                        className="accent-[#244D38]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label
                  htmlFor="contact-message"
                  className="mb-2 block text-xs font-bold text-[#526C59]"
                >
                  {es
                    ? "Cuéntanos sobre tu negocio (opcional)"
                    : "Tell us about your business (optional)"}
                </label>

                <textarea
                  id="contact-message"
                  className={`${fieldClass} min-h-32 resize-y`}
                  placeholder={
                    es
                      ? "Me interesa conocer más sobre la plataforma..."
                      : "I'd like to learn more about the platform..."
                  }
                  maxLength={2000}
                  rows={4}
                  value={form.message}
                  onChange={(event) =>
                    update("message", event.target.value)
                  }
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#F6F8F4] p-4">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(event) =>
                    setConsent(event.target.checked)
                  }
                  className="mt-1 accent-[#244D38]"
                />

                <span className="text-xs leading-6 text-[#6D7F70]">
                  {es
                    ? "Autorizo que el equipo de ¿Todavía hay? utilice mis datos únicamente para responder mi solicitud de información."
                    : "I agree that the ¿Todavía hay? team may use my information only to respond to this inquiry."}
                </span>
              </label>

              {status === "success" && (
                <div
                  role="status"
                  className="rounded-2xl border border-[#BEDCC3] bg-[#EDF8EE] p-4 text-sm font-semibold text-[#327446]"
                >
                  {es
                    ? "¡Solicitud enviada! Gracias por escribirnos. Nuestro equipo recibió tu mensaje."
                    : "Your request has been sent. Thanks for reaching out!"}
                </div>
              )}

              {status === "error" && (
                <div
                  role="alert"
                  className="rounded-2xl border border-[#F0CFC7] bg-[#FFF1ED] p-4 text-sm font-semibold text-[#A64C40]"
                >
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={sending || !consent}
                className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#244D38] px-6 py-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(36,77,56,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#32684C] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? es
                    ? "Enviando solicitud..."
                    : "Sending request..."
                  : es
                    ? "Enviar mi solicitud"
                    : "Send my request"}

                {!sending && (
                  <span className="transition-transform group-hover:translate-x-1">
                    ↗
                  </span>
                )}
              </button>

              <p className="text-center text-xs leading-6 text-[#98A59A]">
                {es
                  ? "Tus datos se usarán únicamente para atender tu solicitud."
                  : "Your information will be used only to respond to your request."}
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
