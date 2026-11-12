
import Link from "next/link";
import { notFound } from "next/navigation";

type Lang = "es" | "en";
type Role = "customer" | "employee" | "owner";

type Section = {
  title: string;
  paragraphs: string[];
};

const LEGAL = {
  version: "2026-11-12",

  // COMPLETAR ANTES DE PUBLICAR
  operator: "[NOMBRE O RAZÓN SOCIAL]",
  email: "[CORREO DE CONTACTO LEGAL]",
  address: "[DOMICILIO DEL RESPONSABLE]",
};

const COMMON_ES: Section[] = [
  {
    title: "Aceptación de los términos",
    paragraphs: [
      "Al crear una cuenta, aceptar una invitación o utilizar las funciones de Todavía Hay, el usuario reconoce haber leído y aceptado las condiciones aplicables a su tipo de cuenta.",
      "La aceptación se registra electrónicamente con el identificador del usuario, la versión del documento y la fecha correspondiente.",
      "Cuando sea necesario actualizar estas condiciones, la plataforma podrá solicitar una nueva aceptación antes de permitir el acceso a determinadas funciones.",
    ],
  },
  {
    title: "Cuentas y seguridad",
    paragraphs: [
      "El usuario es responsable de proporcionar información correcta y mantener sus credenciales de acceso protegidas.",
      "No está permitido compartir credenciales, suplantar identidades, acceder a cuentas ajenas o utilizar la plataforma para actividades ilícitas.",
      "Los usuarios deberán informar sobre accesos no autorizados mediante los canales oficiales de soporte.",
    ],
  },
  {
    title: "Uso permitido",
    paragraphs: [
      "La plataforma debe utilizarse conforme a la legislación aplicable, las funciones autorizadas y estos términos.",
      "Queda prohibido intentar vulnerar la seguridad, acceder a información sin autorización, distribuir código malicioso o interferir deliberadamente con el funcionamiento del servicio.",
      "Todavía Hay podrá restringir accesos cuando existan indicios razonables de uso indebido, procurando aplicar medidas proporcionales y respetar los derechos correspondientes.",
    ],
  },
  {
    title: "Disponibilidad y modificaciones",
    paragraphs: [
      "Todavía Hay puede realizar mantenimiento, correcciones de errores, actualizaciones de seguridad y mejoras de funcionamiento.",
      "La disponibilidad de determinadas funciones dependerá del plan contratado, la configuración del restaurante y el estado del desarrollo de cada herramienta.",
      "No se garantiza una operación ininterrumpida. Las incidencias se atenderán conforme a las condiciones de soporte que hayan sido comunicadas o contratadas.",
    ],
  },
  {
    title: "Protección de datos personales",
    paragraphs: [
      "El tratamiento de datos personales se describe en el Aviso de privacidad de Todavía Hay.",
      "Cuando un restaurante trate datos de sus propios clientes mediante la plataforma, deberán respetarse las responsabilidades legales que correspondan a cada participante.",
      "Los datos personales no podrán utilizarse para finalidades distintas de las informadas sin contar con una base legal válida.",
    ],
  },
  {
    title: "Propiedad intelectual",
    paragraphs: [
      "La plataforma, su código, diseño, funcionalidades, elementos gráficos y documentación pertenecen a sus titulares legítimos.",
      "El acceso a Todavía Hay concede únicamente los permisos de uso correspondientes al servicio y no implica la adquisición del código fuente ni de derechos de propiedad intelectual.",
      "Los restaurantes conservan los derechos que legalmente les correspondan sobre sus marcas, fotografías, menús y demás materiales propios.",
    ],
  },
  {
    title: "Responsabilidad",
    paragraphs: [
      "Cada parte será responsable de sus propios actos, obligaciones y del cumplimiento de la legislación que le resulte aplicable.",
      "Nada de lo establecido en estos términos elimina derechos irrenunciables de consumidores, usuarios o titulares de datos personales, ni excluye responsabilidades que legalmente no puedan limitarse.",
      "Los problemas relativos a preparación de alimentos, información de productos, alérgenos, horarios y atención en el establecimiento corresponden al restaurante que ofrece dichos productos, sin perjuicio de otras responsabilidades legales aplicables.",
    ],
  },
  {
    title: "Modificaciones de los términos",
    paragraphs: [
        "Todavía Hay podrá actualizar estos términos cuando existan cambios en las funcionalidades, condiciones del servicio o disposiciones legales aplicables.",
        "Los cambios importantes se comunicarán mediante la plataforma o los canales de contacto disponibles.",
        "Cuando corresponda, se solicitará una nueva aceptación de los términos actualizados.",
    ],
    },
];

const CUSTOMER_ES: Section[] = [
  {
    title: "Objeto del servicio",
    paragraphs: [
      "Todavía Hay facilita herramientas digitales para consultar menús, interactuar con restaurantes, gestionar cuentas de usuario y solicitar pedidos o reservaciones cuando el establecimiento tenga habilitadas esas funciones.",
      "La disponibilidad de productos, precios, promociones, horarios y modalidades de entrega depende del restaurante correspondiente.",
    ],
  },
  {
    title: "Pedidos y reservaciones",
    paragraphs: [
      "El cliente debe revisar la información del pedido, cantidades, precios, horario, modalidad de consumo o recolección y cualquier indicación antes de confirmarlo.",
      "Las solicitudes sujetas a confirmación no se consideran aceptadas por el restaurante hasta que este comunique su aprobación.",
      "Los cambios o cancelaciones dependen del estado del pedido y de las condiciones informadas por el restaurante, sin afectar los derechos previstos por la ley.",
    ],
  },
  {
    title: "Productos, alergias e información alimentaria",
    paragraphs: [
      "El restaurante es quien ofrece y prepara los alimentos y quien debe proporcionar información precisa sobre los productos que comercializa.",
      "Si el cliente tiene alergias, intolerancias o necesidades alimentarias, deberá comunicarlo al restaurante antes de confirmar su pedido.",
      "La información mostrada en la plataforma puede actualizarse. Cuando exista alguna duda relevante, debe verificarse directamente con el establecimiento.",
    ],
  },
  {
    title: "Precios, pagos y comprobantes",
    paragraphs: [
      "Los precios aplicables son los informados en el proceso de compra, conforme a las condiciones del restaurante y la legislación correspondiente.",
      "Las formas de pago disponibles pueden variar según el establecimiento y las funciones habilitadas.",
      "Los comprobantes de la venta de alimentos y las obligaciones fiscales relacionadas corresponderán a quien efectivamente realice la operación comercial.",
    ],
  },
  {
    title: "Programa de sellos y beneficios",
    paragraphs: [
      "Cuando un restaurante ofrezca sellos o recompensas mediante Todavía Hay, las reglas de acumulación y canje deberán comunicarse claramente.",
      "Los beneficios pueden estar sujetos a condiciones específicas del establecimiento, siempre respetando los derechos previamente adquiridos por el consumidor.",
      "No está permitido alterar indebidamente los registros de sellos ni utilizar cuentas de terceros para obtener beneficios no autorizados.",
    ],
  },
  {
    title: "Baja de cuenta",
    paragraphs: [
      "El cliente puede solicitar la baja de su cuenta y ejercer los derechos que le correspondan respecto de sus datos personales.",
      "La eliminación de información estará sujeta a las obligaciones de conservación que resulten legalmente aplicables.",
    ],
  },
];

const EMPLOYEE_ES: Section[] = [
  {
    title: "Acceso por invitación",
    paragraphs: [
      "Los empleados acceden a Todavía Hay mediante invitación o autorización de un restaurante.",
      "La cuenta de empleado solo permite utilizar las herramientas asignadas a su función y a los permisos establecidos para su perfil.",
      "La invitación o el acceso a la plataforma no constituyen, por sí solos, una relación laboral con el operador de Todavía Hay.",
    ],
  },
  {
    title: "Operación del restaurante",
    paragraphs: [
      "Según su perfil, el empleado puede visualizar pedidos, gestionar mesas, registrar operaciones o realizar otras actividades que el restaurante tenga habilitadas.",
      "El empleado debe capturar información correcta y evitar modificaciones o cancelaciones no autorizadas.",
      "El acceso a funciones de cobro, inventario o datos de clientes deberá utilizarse exclusivamente para las operaciones legítimas del restaurante.",
    ],
  },
  {
    title: "Confidencialidad y datos de clientes",
    paragraphs: [
      "La información de clientes, pedidos, teléfonos y operaciones comerciales debe utilizarse únicamente para cumplir las funciones autorizadas.",
      "No está permitido copiar, difundir, vender o utilizar para fines personales la información obtenida mediante el sistema.",
      "El empleado deberá informar a su responsable sobre incidentes de seguridad o uso indebido de información.",
    ],
  },
  {
    title: "Supervisión y revocación de acceso",
    paragraphs: [
      "El restaurante podrá administrar los permisos de su personal y revocar accesos cuando deje de existir la autorización correspondiente.",
      "Las operaciones realizadas podrán conservar registros de auditoría cuando sean necesarios y legalmente procedentes.",
      "La revocación del acceso a la plataforma no determina por sí misma la situación laboral del empleado.",
    ],
  },
  {
    title: "Obligaciones del establecimiento",
    paragraphs: [
      "El restaurante es responsable de asignar permisos adecuados, capacitar a su personal y supervisar el uso del sistema.",
      "Las obligaciones laborales y de administración de personal corresponden al restaurante empleador, no automáticamente a Todavía Hay.",
    ],
  },
];

const OWNER_ES: Section[] = [
  {
    title: "Contratación del servicio",
    paragraphs: [
      "Todavía Hay ofrece herramientas digitales para la operación y administración de negocios de alimentos.",
      "Las funciones concretas disponibles dependerán del plan contratado y de las características comunicadas al momento de la contratación.",
      "El precio, periodicidad de pago, renovación, impuestos aplicables, soporte, período de prueba y condiciones particulares deberán constar en la oferta o acuerdo comercial aceptado por el restaurante.",
    ],
  },
  {
    title: "Planes y funcionalidades",
    paragraphs: [
      "La plataforma puede ofrecer distintos planes con funciones de menús, pedidos, administración de ventas, inventario, personal, mesas y otras herramientas.",
      "No todas las funciones están disponibles en todos los planes. Las características incluidas deberán indicarse antes de contratar.",
      "Las funcionalidades anunciadas como futuras o en desarrollo no se considerarán incluidas como servicio disponible hasta su habilitación expresa.",
    ],
  },
  {
    title: "Pagos y cancelación",
    paragraphs: [
      "El restaurante deberá pagar los importes correspondientes al plan contratado conforme a las fechas y condiciones informadas.",
      "No se aplicarán cargos recurrentes o renovaciones automáticas sin comunicar sus condiciones y obtener la autorización que corresponda.",
      "Las condiciones de cancelación, reembolso y suspensión deben indicarse de forma clara antes de contratar, respetando los derechos y obligaciones legales aplicables.",
    ],
  },
  {
    title: "Configuración y contenido del restaurante",
    paragraphs: [
      "El propietario es responsable de la exactitud de los productos, precios, fotografías, horarios, promociones, existencias y demás información que publique.",
      "También deberá informar correctamente a sus clientes sobre condiciones de compra, alérgenos, cambios, cancelaciones y demás aspectos de su servicio.",
      "El restaurante declara contar con los derechos o autorizaciones necesarios sobre los materiales que incorpora a la plataforma.",
    ],
  },
  {
    title: "Empleados y permisos",
    paragraphs: [
      "El propietario o administrador autorizado es responsable de invitar a su personal y asignar permisos acordes con sus funciones.",
      "El restaurante deberá revocar oportunamente el acceso de quienes ya no estén autorizados.",
      "Las acciones realizadas con cuentas del personal podrán generar registros operativos necesarios para administrar el servicio.",
    ],
  },
  {
    title: "Ventas, inventario y reportes",
    paragraphs: [
      "Todavía Hay proporciona herramientas informáticas de apoyo a la administración del restaurante.",
      "El propietario debe revisar los importes, movimientos, existencias y reportes generados y mantener sus procesos de verificación correspondientes.",
      "Los reportes de la plataforma no sustituyen la contabilidad oficial, la asesoría fiscal ni las obligaciones de emisión de comprobantes cuando estas sean exigibles.",
    ],
  },
  {
    title: "Datos personales del restaurante",
    paragraphs: [
      "Cuando el restaurante determine las finalidades y medios del tratamiento de datos de sus clientes o empleados, deberá cumplir las obligaciones que le correspondan como responsable.",
      "Todavía Hay podrá actuar como proveedor tecnológico o encargado respecto de ciertos tratamientos, sujeto al acuerdo de tratamiento de datos aplicable.",
      "El restaurante deberá proporcionar a sus clientes y trabajadores los avisos de privacidad que le correspondan y contar con las autorizaciones legalmente necesarias.",
    ],
  },
  {
    title: "Suspensión del servicio",
    paragraphs: [
      "Podrán establecerse medidas proporcionales de suspensión por incumplimientos de pago, riesgos de seguridad o uso ilícito, conforme a lo informado en la contratación.",
      "Cuando sea posible y adecuado, se comunicará previamente el motivo de la suspensión y las acciones necesarias para regularizar el servicio.",
      "La suspensión o terminación no elimina las obligaciones legales pendientes ni los derechos que correspondan a las partes.",
    ],
  },
  {
    title: "Terminación y datos",
    paragraphs: [
      "Al finalizar el servicio se aplicarán las condiciones de terminación y, en su caso, exportación, conservación o eliminación de datos que hayan sido pactadas.",
      "No deberán eliminarse datos sujetos a obligaciones legales de conservación.",
      "El procedimiento de recuperación de información y los plazos aplicables deberán formar parte del acuerdo comercial.",
    ],
  },
];

const EN_INTRO: Record<Role, string> = {
  customer:
    "This document governs customer access to Todavía Hay. Before publication, the complete English version must be reviewed and approved.",
  employee:
    "This document governs employee access to Todavía Hay. Before publication, the complete English version must be reviewed and approved.",
  owner:
    "This document governs restaurant owner access to Todavía Hay. Before publication, the complete English version must be reviewed and approved.",
};

export default async function TermsPage({
  params,
}: {
  params: Promise<{
    lang: string;
    role: string;
  }>;
}) {
  const { lang, role } = await params;

  if (
    (lang !== "es" && lang !== "en") ||
    !["customer", "employee", "owner"].includes(role)
  ) {
    notFound();
  }

  const language = lang as Lang;
  const userRole = role as Role;

  const titles: Record<Role, string> = {
    customer: "Términos y condiciones para clientes",
    employee: "Condiciones de uso para empleados",
    owner: "Términos de servicio para restaurantes",
  };

  const descriptions: Record<Role, string> = {
    customer:
      "Condiciones aplicables a quienes consultan restaurantes, crean cuentas y realizan pedidos.",
    employee:
      "Reglas aplicables al personal autorizado por los restaurantes.",
    owner:
      "Condiciones de uso y contratación de las herramientas de administración.",
  };

  const specificSections =
    userRole === "customer"
      ? CUSTOMER_ES
      : userRole === "employee"
        ? EMPLOYEE_ES
        : OWNER_ES;

  const sections = [
    ...specificSections,
    ...COMMON_ES,
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-14">
      <Link
        href={`/${language}`}
        className="text-sm font-semibold text-brand hover:underline"
      >
        ← {language === "es"
          ? "Volver a Todavía Hay"
          : "Back to Todavía Hay"}
      </Link>

      <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          Todavía Hay · Legal
        </p>

        <h1 className="mt-3 text-3xl font-black leading-tight">
          {language === "es"
            ? titles[userRole]
            : "Terms of Use"}
        </h1>

        <p className="mt-4 text-muted">
          {language === "es"
            ? descriptions[userRole]
            : EN_INTRO[userRole]}
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted">
          <span className="rounded-full border border-line px-3 py-2">
            Versión: {LEGAL.version}
          </span>
          <span className="rounded-full border border-line px-3 py-2">
            México
          </span>
        </div>

        {language === "en" ? (
          <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <p className="font-bold">
              English version pending
            </p>
            <p className="mt-2 text-sm">
              The complete English legal text has
              not yet been approved. Please do not
              accept this incomplete translation as
              a final agreement.
            </p>
            <Link
              href={`/es/legal/terminos/${userRole}`}
              className="mt-3 inline-block font-semibold underline"
            >
              Consultar versión en español
            </Link>
          </div>
        ) : (
          <>
            

            <div className="mt-8 space-y-8">
              {sections.map((section, index) => (
                <section key={`${userRole}-${index}`}>
                  <h2 className="text-xl font-bold">
                    {index + 1}. {section.title}
                  </h2>

                  <div className="mt-3 space-y-3">
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

            <div className="mt-10 rounded-2xl border border-line bg-background p-5">
              <h2 className="font-bold">
                Aviso de privacidad
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted">
                Consulta cómo se recopilan,
                utilizan y protegen los datos
                personales en Todavía Hay.
              </p>

              <Link
                href={`/${language}/legal/privacidad`}
                className="mt-3 inline-block font-semibold text-brand underline"
              >
                Consultar aviso de privacidad
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
