
import Link from "next/link";
import { notFound } from "next/navigation";

type Section = {
  title: string;
  paragraphs: string[];
};

const PRIVACY = {
  version: "2026-11-12",

  // DATOS REALES OBLIGATORIOS
  responsible: "[NOMBRE O RAZÓN SOCIAL]",
  address: "[DOMICILIO DEL RESPONSABLE]",
  email: "[CORREO DE PRIVACIDAD]",

  // DEFINIR CONFORME A LOS PROCESOS REALES
  arcoEmail: "[CORREO PARA SOLICITUDES ARCO]",
};

const SECTIONS: Section[] = [
  {
    title: "Identidad y domicilio del responsable",
    paragraphs: [
      `Todavía Hay es una plataforma tecnológica operada por ${PRIVACY.responsible}, con domicilio en ${PRIVACY.address}.`,
      `Para asuntos relacionados con protección de datos personales, puedes comunicarte al correo ${PRIVACY.email}.`,
      "Este aviso aplica al tratamiento realizado por el operador de Todavía Hay en los casos en que determine las finalidades y medios correspondientes. Cuando un restaurante determine el tratamiento de los datos de sus clientes o empleados, dicho establecimiento podrá ser el responsable y deberá proporcionar su propio aviso de privacidad.",
    ],
  },
  {
    title: "Personas a quienes se dirige",
    paragraphs: [
      "Este aviso contempla a clientes que consultan restaurantes, crean cuentas, realizan solicitudes de pedidos o participan en programas de recompensas.",
      "También contempla a empleados y colaboradores autorizados para utilizar las herramientas de operación de un restaurante.",
      "Finalmente, contempla a propietarios, administradores y representantes de negocios que utilizan o contratan las herramientas de Todavía Hay.",
    ],
  },
  {
    title: "Datos personales que podemos tratar",
    paragraphs: [
      "Datos de identificación y contacto: nombre, apellidos, dirección de correo electrónico y número telefónico, según corresponda.",
      "Datos de cuenta: identificador de usuario, método de autenticación, información de acceso y preferencias de idioma.",
      "Datos de actividad: fecha y tipo de operaciones realizadas en la plataforma, pedidos, solicitudes, reservaciones, sellos, movimientos autorizados y registros técnicos de seguridad.",
      "Datos relacionados con el restaurante: nombre del negocio, datos de contacto de sus representantes, perfiles de acceso de empleados y configuraciones comerciales.",
      "Información técnica: datos que resulten necesarios para el funcionamiento, seguridad, diagnóstico de fallos y prevención de uso indebido, conforme a las tecnologías efectivamente implementadas.",
      "Los datos concretos tratados dependerán de las funcionalidades utilizadas. La plataforma debe limitar su recopilación a la información necesaria para cada finalidad.",
    ],
  },
  {
    title: "Datos que no solicitamos como requisito general",
    paragraphs: [
      "Todavía Hay no solicita de manera general información médica, biométrica o datos personales sensibles para crear una cuenta ordinaria.",
      "No se debe introducir información sensible en campos libres salvo que exista una necesidad legítima, una finalidad informada y se cumplan los requisitos legales aplicables.",
      "Si en el futuro se incorporan funciones que requieran categorías especiales de datos, el aviso y los mecanismos de consentimiento deberán actualizarse antes de su tratamiento.",
    ],
  },
  {
    title: "Finalidades necesarias del tratamiento",
    paragraphs: [
      "Crear, verificar, administrar y proteger las cuentas de usuario.",
      "Autenticar el acceso mediante correo y contraseña o proveedores de autenticación habilitados.",
      "Gestionar invitaciones, permisos y perfiles de propietarios y empleados.",
      "Permitir la consulta de menús, el envío y seguimiento de solicitudes de pedidos, reservaciones y otras operaciones habilitadas.",
      "Administrar programas de sellos y recompensas cuando el restaurante tenga activada esa funcionalidad.",
      "Prestar los servicios de administración de restaurantes contratados, incluidas herramientas de operación, ventas e inventario.",
      "Atender consultas, solicitudes de soporte y reportes de incidencias.",
      "Mantener la seguridad, investigar fallos técnicos, prevenir accesos no autorizados y conservar los registros estrictamente necesarios.",
      "Cumplir obligaciones legales aplicables y atender requerimientos válidos de autoridades competentes.",
    ],
  },
  {
    title: "Finalidades adicionales u opcionales",
    paragraphs: [
      "El envío de publicidad, promociones personalizadas, encuestas comerciales o comunicaciones de mercadotecnia que no sean indispensables para prestar el servicio se considerará una finalidad adicional.",
      "Cuando se requiera consentimiento, dichas finalidades deberán contar con controles de aceptación independientes y opciones para rechazarlas o revocarlas.",
      "El rechazo de finalidades opcionales no impedirá el acceso a las funciones esenciales para las que el usuario se haya registrado.",
      "Estas actividades solo deberán realizarse cuando estén efectivamente implementadas y se haya informado de manera adecuada a las personas titulares.",
    ],
  },
  {
    title: "Información relacionada con pedidos",
    paragraphs: [
      "Cuando un cliente realiza un pedido, el restaurante puede recibir la información necesaria para identificarlo, preparar los productos y proporcionar el servicio.",
      "Los datos visibles para el personal deben limitarse a aquellos necesarios para realizar sus funciones.",
      "Los pedidos, montos, estados de cuenta y registros operativos pueden conservarse durante los períodos necesarios para la gestión del servicio y el cumplimiento de obligaciones legales.",
      "Los restaurantes deberán informar de sus propios tratamientos cuando actúen como responsables de los datos personales de sus consumidores.",
    ],
  },
  {
    title: "Información de empleados",
    paragraphs: [
      "El sistema puede tratar nombre, correo electrónico, perfil, permisos y registros de operaciones realizadas por empleados autorizados.",
      "La información se utiliza para controlar accesos, administrar funciones de trabajo y mantener registros operativos cuando corresponda.",
      "El restaurante empleador es responsable de informar a sus trabajadores sobre los tratamientos de datos que determine y de cumplir sus obligaciones legales.",
      "Todavía Hay no debe utilizar la información del personal para fines ajenos al servicio sin la base legal correspondiente.",
    ],
  },
  {
    title: "Información de propietarios",
    paragraphs: [
      "La plataforma puede utilizar los datos de contacto de propietarios, administradores y representantes para gestionar cuentas empresariales, invitaciones, contratación, soporte y comunicaciones necesarias.",
      "Si se habilitan procesos de facturación, cobros o verificación comercial, se informarán previamente los datos adicionales que sean necesarios.",
    ],
  },
  {
    title: "Proveedores tecnológicos y terceros",
    paragraphs: [
      "Para operar la plataforma pueden intervenir proveedores tecnológicos que proporcionan servicios de autenticación, alojamiento, bases de datos, comunicaciones y procesamiento de operaciones.",
      "Su participación deberá ajustarse a los contratos, medidas de seguridad y obligaciones de confidencialidad que correspondan.",
      "Antes de publicar este aviso deben identificarse los flujos reales de datos, incluidos los que involucren servicios de Supabase, proveedores de correo, autenticación con Google y cualquier otro proveedor efectivamente utilizado.",
      "Cuando exista una transferencia que deba informarse o requiera consentimiento, se deberán describir sus características y obtener las autorizaciones correspondientes.",
      "No todos los accesos de un proveedor tecnológico a información constituyen necesariamente la misma figura jurídica. Deben distinguirse los tratamientos por encargo de las transferencias que legalmente correspondan.",
    ],
  },
  {
    title: "Conservación y eliminación de datos",
    paragraphs: [
      "Los datos personales se conservarán durante el tiempo necesario para cumplir las finalidades informadas y las obligaciones legales aplicables.",
      "Al concluir una relación con un usuario o restaurante, la información se eliminará, bloqueará o conservará según corresponda a su naturaleza, finalidad y obligaciones legales.",
      "Los plazos específicos de conservación y los procedimientos de exportación o eliminación deberán definirse conforme a los procesos reales de Todavía Hay.",
    ],
  },
  {
    title: "Medidas de seguridad",
    paragraphs: [
      "Todavía Hay debe aplicar medidas administrativas, técnicas y físicas apropiadas para proteger la información contra pérdida, alteración, destrucción, acceso o tratamiento no autorizado.",
      "Entre las medidas previstas para la operación de la plataforma se encuentran controles de autenticación, separación de permisos por usuario, restricciones de acceso y mecanismos de seguimiento de incidentes.",
      "Las medidas implementadas deberán revisarse periódicamente y adaptarse a los riesgos reales de la operación.",
      "Ningún sistema tecnológico puede garantizar la eliminación absoluta de todos los riesgos de seguridad.",
    ],
  },
  {
    title: "Derechos ARCO",
    paragraphs: [
      "Las personas titulares pueden solicitar, cuando proceda, el acceso, rectificación, cancelación u oposición al tratamiento de sus datos personales, conforme a la legislación mexicana aplicable.",
      `Las solicitudes deberán enviarse a ${PRIVACY.arcoEmail}.`,
      "Para tramitar una solicitud se podrá requerir información razonable para identificar a la persona titular o a su representante legal, así como una descripción clara de los datos y del derecho que desea ejercer.",
      "Las solicitudes serán atendidas dentro de los plazos y conforme a los procedimientos establecidos por la legislación vigente.",
      "Cuando el tratamiento corresponda directamente a un restaurante como responsable, la solicitud podrá requerir su intervención.",
    ],
  },
  {
    title: "Revocación del consentimiento",
    paragraphs: [
      "Cuando el tratamiento se base en el consentimiento y la legislación lo permita, la persona titular podrá solicitar su revocación por los canales de privacidad habilitados.",
      "La revocación no afectará necesariamente operaciones realizadas previamente de manera legítima ni eliminará obligaciones legales de conservación.",
    ],
  },
  {
    title: "Limitación del uso o divulgación",
    paragraphs: [
      "Los usuarios podrán solicitar la limitación del uso o divulgación de sus datos personales en los supuestos y mediante los procedimientos establecidos por la legislación aplicable.",
      `Las solicitudes deberán dirigirse a ${PRIVACY.arcoEmail}, especificando el tratamiento respecto del cual se solicita la limitación.`,
      "Las preferencias sobre comunicaciones promocionales deberán poder modificarse independientemente de los tratamientos indispensables para prestar el servicio.",
    ],
  },
  {
    title: "Cookies y tecnologías similares",
    paragraphs: [
      "La plataforma puede utilizar cookies o mecanismos equivalentes necesarios para mantener sesiones autenticadas, conservar preferencias o proporcionar funciones técnicas.",
      "El uso de herramientas de medición, publicidad o seguimiento no esencial deberá informarse conforme a su implementación real y a las obligaciones legales aplicables.",
      "Antes de publicar este aviso deben verificarse las cookies efectivamente utilizadas en el sitio y las opciones disponibles para los usuarios.",
    ],
  },
  {
    title: "Datos de menores de edad",
    paragraphs: [
      "Todavía Hay no está diseñado para recopilar deliberadamente información personal de menores sin la autorización o base jurídica que corresponda.",
      "Cuando un tratamiento involucre a menores de edad deberán aplicarse las salvaguardas legales pertinentes.",
    ],
  },
  {
    title: "Cambios al aviso de privacidad",
    paragraphs: [
      "Este aviso podrá actualizarse cuando cambien las funcionalidades, proveedores, finalidades del tratamiento o disposiciones legales aplicables.",
      "Las modificaciones se publicarán en la sección de privacidad de la plataforma y, cuando corresponda, se comunicarán por otros medios adecuados.",
      "Cuando una modificación requiera obtener nuevamente el consentimiento, se habilitará el mecanismo correspondiente antes de continuar con el tratamiento afectado.",
    ],
  },
];

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (lang !== "es" && lang !== "en") {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-14">
      <Link
        href={`/${lang}`}
        className="text-sm font-semibold text-brand hover:underline"
      >
        ← {lang === "es"
          ? "Volver a Todavía Hay"
          : "Back to Todavía Hay"}
      </Link>

      <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          Todavía Hay · Privacidad
        </p>

        <h1 className="mt-3 text-3xl font-black">
          {lang === "es"
            ? "Aviso de privacidad integral"
            : "Comprehensive Privacy Notice"}
        </h1>

        <p className="mt-3 leading-7 text-muted">
          {lang === "es"
            ? "Información sobre cómo se tratan los datos personales de clientes, empleados y propietarios que utilizan Todavía Hay."
            : "Information about the processing of personal data belonging to customers, employees and restaurant owners."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted">
          <span className="rounded-full border border-line px-3 py-2">
            Versión: {PRIVACY.version}
          </span>
          <span className="rounded-full border border-line px-3 py-2">
            México
          </span>
        </div>

        {lang === "en" ? (
          <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <h2 className="font-bold">
              English translation pending
            </h2>

            <p className="mt-2 text-sm">
              The complete English translation
              has not been finalized. This page
              should not be presented as an
              approved English privacy notice.
            </p>

            <Link
              href="/es/legal/privacidad"
              className="mt-3 inline-block font-semibold underline"
            >
              Consultar aviso en español
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-9 space-y-9">
              {SECTIONS.map((section, index) => (
                <section
                  key={index}
                  className="border-b border-line pb-8 last:border-b-0"
                >
                  <h2 className="text-xl font-bold leading-snug">
                    {index + 1}. {section.title}
                  </h2>

                  <div className="mt-4 space-y-3">
                    {section.paragraphs.map(
                      (paragraph, paragraphIndex) => (
                        <p
                          key={paragraphIndex}
                          className="leading-7 text-foreground"
                        >
                          {paragraph}
                        </p>
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-line bg-background p-5">
              <h2 className="font-bold">
                Documentos relacionados
              </h2>

              <div className="mt-4 flex flex-col gap-3 text-sm">
                <Link
                  href="/es/legal/terminos/customer"
                  className="font-semibold text-brand underline"
                >
                  Términos para clientes
                </Link>

                <Link
                  href="/es/legal/terminos/employee"
                  className="font-semibold text-brand underline"
                >
                  Condiciones para empleados
                </Link>

                <Link
                  href="/es/legal/terminos/owner"
                  className="font-semibold text-brand underline"
                >
                  Términos para propietarios
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
