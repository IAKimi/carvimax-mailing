/**
 * Genera el Manual de Usuario de PostIAlo Mailing (Word).
 * Colores: #002073 (primario), #e3001b (acento IA). Tipografía: Montserrat.
 * Logo oficial: docs/assets/postialo-logo.png
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";

const PRIMARY = "002073";
const ACCENT = "E3001B";
const MUTED = "5A6577";
const LIGHT_BG = "F4F6FB";
const WHITE = "FFFFFF";
const FONT = "Montserrat";

const OUT =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || process.env.HOME || ".",
    "Downloads",
    "Manual_Usuario_PostIAlo_Mailing.docx"
  );

function t(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? 22, // 11pt
    bold: opts.bold,
    color: opts.color ?? "1A2332",
    italics: opts.italics,
  });
}

function p(children, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0, line: opts.line },
    alignment: opts.align,
    ...opts.para,
    children: Array.isArray(children) ? children : [children],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  const sizes = {
    [HeadingLevel.HEADING_1]: 32,
    [HeadingLevel.HEADING_2]: 26,
    [HeadingLevel.HEADING_3]: 24,
  };
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 260, after: 140 },
    border:
      level === HeadingLevel.HEADING_1
        ? {
            bottom: { style: BorderStyle.SINGLE, size: 12, color: PRIMARY, space: 8 },
          }
        : undefined,
    children: [
      new TextRun({
        text,
        font: FONT,
        bold: true,
        size: sizes[level] || 24,
        color: PRIMARY,
      }),
    ],
  });
}

function bullet(text, example) {
  const children = [t(text, { size: 21 })];
  if (example) {
    children.push(t("  ", { size: 21 }));
    children.push(t(`Ejemplo: ${example}`, { size: 20, italics: true, color: MUTED }));
  }
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children,
  });
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "steps", level },
    spacing: { after: 100 },
    children: [t(text, { size: 21 })],
  });
}

function callout(title, body) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: LIGHT_BG },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: PRIMARY },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: PRIMARY },
              left: { style: BorderStyle.SINGLE, size: 24, color: ACCENT },
              right: { style: BorderStyle.SINGLE, size: 8, color: PRIMARY },
            },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [
              p([t(title, { bold: true, size: 20, color: PRIMARY })], { after: 60 }),
              p([t(body, { size: 20, color: MUTED })], { after: 40 }),
            ],
          }),
        ],
      }),
    ],
  });
}

function simpleTable(headers, rows) {
  const colW = Math.floor(9000 / headers.length);
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          width: { size: colW, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: PRIMARY },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [p([t(h, { bold: true, size: 18, color: WHITE })], { after: 0 })],
        })
    ),
  });
  const bodyRows = rows.map(
    (row, i) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              width: { size: colW, type: WidthType.DXA },
              shading: {
                type: ShadingType.CLEAR,
                fill: i % 2 === 0 ? WHITE : LIGHT_BG,
              },
              margins: { top: 70, bottom: 70, left: 80, right: 80 },
              children: [p([t(cell, { size: 18 })], { after: 0 })],
            })
        ),
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

async function buildLogoBuffers() {
  const logoSrc = path.resolve("docs/assets/postialo-logo.png");
  const coverPng = await sharp(logoSrc)
    .resize({ width: 720, withoutEnlargement: true })
    .png()
    .toBuffer();
  const headerPng = await sharp(logoSrc)
    .resize({ width: 220, withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(coverPng).metadata();
  const headerMeta = await sharp(headerPng).metadata();
  return {
    coverPng,
    headerPng,
    coverW: meta.width || 720,
    coverH: meta.height || 146,
    headerW: headerMeta.width || 220,
    headerH: headerMeta.height || 45,
  };
}

async function main() {
  const logo = await buildLogoBuffers();
  // Display sizes in EMUs-friendly px for Word
  const coverDisplayW = 420;
  const coverDisplayH = Math.round((logo.coverH / logo.coverW) * coverDisplayW);
  const headerDisplayW = 120;
  const headerDisplayH = Math.round((logo.headerH / logo.headerW) * headerDisplayW);

  const cover = [
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: "000000" },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "000000" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "000000" },
                left: { style: BorderStyle.NONE, size: 0, color: "000000" },
                right: { style: BorderStyle.NONE, size: 0, color: "000000" },
              },
              margins: { top: 280, bottom: 280, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                  children: [
                    new ImageRun({
                      type: "png",
                      data: logo.coverPng,
                      transformation: { width: coverDisplayW, height: coverDisplayH },
                      altText: {
                        title: "PostIAlo",
                        description: "Logo oficial PostIAlo",
                        name: "postialo-logo",
                      },
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 280 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [t("Mailing", { size: 40, bold: true, color: PRIMARY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [t("Manual de usuario", { size: 32, bold: true, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: PRIMARY, space: 1 },
      },
      children: [
        t(
          "Guía paso a paso para ingresar, configurar y operar la plataforma de email marketing con inteligencia artificial.",
          { size: 20, color: MUTED }
        ),
      ],
    }),
    p([t("Documento destinado a usuarios, administradores y equipos de mercadeo autorizados.", { size: 19, color: MUTED })], {
      align: AlignmentType.CENTER,
      after: 80,
    }),
    p([t("Uso interno — PostIAlo Mailing", { size: 18, italics: true, color: PRIMARY })], {
      align: AlignmentType.CENTER,
      after: 400,
    }),
  ];

  const toc = [
    heading("Índice"),
    ...[
      "1. Destinatarios",
      "2. Qué es PostIAlo Mailing",
      "3. Acceso e inicio de sesión",
      "4. Orden recomendado de configuración",
      "5. Identidad de Marca",
      "6. Proveedor de Email",
      "7. Plantillas",
      "8. Contactos y bases de datos",
      "9. Calendario y creación de campañas",
      "10. Revisión, aprobación y envío",
      "11. Historial de correos",
      "12. Configuración y preferencias",
      "13. Roles y permisos",
      "14. Incidencias frecuentes",
      "15. Glosario",
    ].map((line) => p([t(line, { size: 21 })], { after: 60 })),
  ];

  const body = [
    heading("1. Destinatarios"),
    p(
      t(
        "Este manual está dirigido a quienes utilizarán PostIAlo Mailing para crear, revisar y enviar campañas de correo electrónico: equipos de mercadeo, administradores de cuenta y usuarios operativos autorizados. Explica cada sección principal, qué conviene configurar primero y ejemplos concretos de información que puede ingresarse en cada campo."
      )
    ),

    heading("2. Qué es PostIAlo Mailing"),
    p(
      t(
        "PostIAlo Mailing es una plataforma de email marketing asistida por inteligencia artificial. Permite definir la identidad de marca, conectar un proveedor de envío, diseñar o generar plantillas, administrar contactos y crear campañas desde un calendario. La IA propone textos e imágenes; el usuario revisa, aprueba y decide el envío."
      )
    ),
    heading("2.1 Qué hace la inteligencia artificial", HeadingLevel.HEADING_2),
    bullet("Redacta asunto, preheader, cuerpo y texto de botón a partir de la idea y el objetivo de la campaña, alineados a la identidad de marca."),
    bullet("Genera o edita la imagen principal del correo a partir de una descripción (prompt)."),
    bullet("Puede generar plantillas HTML con la estructura estándar de la plataforma y los colores de marca."),
    callout(
      "Importante",
      "La IA elabora propuestas. El envío ocurre solo cuando el usuario programa o dispara la campaña y existe un proveedor de email configurado correctamente."
    ),

    heading("2.2 Menú principal", HeadingLevel.HEADING_2),
    p(t("En el menú lateral (fondo azul #002073) encontrará, entre otras, las siguientes secciones:")),
    simpleTable(
      ["Sección", "Para qué sirve"],
      [
        ["Panel / Inicio", "Resumen y accesos rápidos"],
        ["Identidad de Marca", "Datos, tono, colores, logo y remitente"],
        ["Proveedor de Email", "Brevo, Mailchimp o API HTTP personalizada"],
        ["Plantillas", "Diseños HTML del correo"],
        ["Contactos", "Bases de datos y destinatarios"],
        ["Calendario", "Crear, programar y enviar campañas"],
        ["Historial / Mis correos", "Seguimiento de envíos"],
        ["Configuración", "Preferencias de la cuenta"],
      ]
    ),

    heading("3. Acceso e inicio de sesión"),
    heading("3.1 Cómo ingresar", HeadingLevel.HEADING_2),
    numbered("Abra la dirección web de la plataforma (facilitada por quien administra el sistema). En entorno local de pruebas suele ser http://localhost:5000."),
    numbered("En Correo electrónico, registre el usuario asignado."),
    numbered("En Contraseña, registre la clave asignada."),
    numbered("Seleccione Iniciar Sesión."),
    p(
      t(
        "Si los datos no coinciden, la plataforma mostrará un mensaje de error. Si la cuenta no está verificada o está desactivada, el ingreso no será posible; deberá contactar a un administrador."
      )
    ),
    heading("3.2 Registro (si está habilitado)", HeadingLevel.HEADING_2),
    p(
      t(
        "Algunas instalaciones permiten crear cuenta desde la pantalla de acceso. Se solicitarán nombre, correo, empresa y contraseña, y puede requerirse verificación por correo antes de operar."
      )
    ),
    heading("3.3 Cerrar sesión", HeadingLevel.HEADING_2),
    p(
      t(
        "En la parte inferior del menú lateral aparece Cerrar Sesión. Debe utilizarse al concluir el trabajo, en especial en equipos compartidos."
      )
    ),

    heading("4. Orden recomendado de configuración"),
    p(
      t(
        "Para que la plataforma funcione de punta a punta, se recomienda completar la configuración en este orden. Varias secciones del menú permanecen limitadas hasta avanzar en el onboarding."
      )
    ),
    numbered("Identidad de Marca — nombre, industria, tono, colores, logo y remitente."),
    numbered("Proveedor de Email — Brevo, Mailchimp o API HTTP personalizada (obligatorio para enviar)."),
    numbered("Plantillas — al menos una plantilla completa (con todos los placeholders)."),
    numbered("Contactos — una base de datos con destinatarios."),
    numbered("Calendario — crear la primera campaña, revisar y programar o enviar."),
    callout(
      "Consejo",
      "Active el Modo Tutorial (ícono de bombilla en el menú) la primera vez: resalta cada campo y explica qué se espera en cada paso."
    ),

    heading("5. Identidad de Marca"),
    p(
      t(
        "Esta sección alimenta a la IA y a las plantillas. Cuanto más clara y coherente sea la información, mejores serán los textos y el aspecto visual de los correos."
      )
    ),
    heading("5.1 Información general", HeadingLevel.HEADING_2),
    bullet("Nombre de la empresa (obligatorio).", "IAKimi"),
    bullet("Industria / rubro (obligatorio).", "Tecnología / Consultoría en inteligencia artificial"),
    bullet("Sitio web (opcional).", "https://www.iakimi.com/"),
    bullet("WhatsApp (opcional).", "79800025"),
    heading("5.2 Configuración de envío", HeadingLevel.HEADING_2),
    bullet("Nombre del remitente.", "IAKimi"),
    bullet("Correo del remitente (debe estar permitido/verificado en su proveedor de envío).", "info@iakimi.com"),
    heading("5.3 Productos y servicios", HeadingLevel.HEADING_2),
    p(
      t(
        "Describa qué ofrece la empresa. La IA usará esta información para hablar con precisión en los correos."
      )
    ),
    p(
      [
        t("Ejemplo: ", { italics: true, color: MUTED, size: 20 }),
        t(
          "Talleres prácticos de IA, coaching de automatización y plataformas SaaS para marketing.",
          { italics: true, color: MUTED, size: 20 }
        ),
      ],
      { after: 140 }
    ),
    heading("5.4 Sobre la empresa (opcional)", HeadingLevel.HEADING_2),
    p(
      t(
        "Campo libre para contexto adicional: trayectoria, a quién se dirige, diferenciadores u otros detalles útiles. Ya no es necesario cargar misión, visión ni público objetivo por separado; esa información puede ir aquí si lo considera relevante."
      )
    ),
    p(
      [
        t("Ejemplo: ", { italics: true, color: MUTED, size: 20 }),
        t(
          "Empresa latinoamericana enfocada en automatizar procesos con IA para medianas y grandes compañías; comunicación formal y orientada a resultados.",
          { italics: true, color: MUTED, size: 20 }
        ),
      ],
      { after: 140 }
    ),
    heading("5.5 Lineamientos y branding", HeadingLevel.HEADING_2),
    bullet("Guías y estilos de contenido.", "Lenguaje formal, claro, orientado a ROI; usted en El Salvador."),
    bullet("Tono de comunicación.", "Formal / Profesional / Inspirador"),
    bullet("Colores primario, secundario y de acento.", "Negro #000000, blanco #FFFFFF, naranja #F34B26"),
    bullet("Tipografías de títulos y cuerpo.", "Plus Jakarta Sans"),
    bullet("Logo (PNG, JPG o WebP, máximo 2 MB)."),
    bullet("Estilo visual de plantillas.", "Moderno / Corporativo / Minimalista"),
    callout(
      "Nota sobre imágenes en correos",
      "Las imágenes del correo se referencian desde la URL pública de la plataforma. En localhost el destinatario no podrá verlas; en un entorno publicado (VPS/dominio) sí, si APP_URL apunta correctamente."
    ),

    heading("6. Proveedor de Email"),
    p(
      t(
        "Sin un proveedor activo no se pueden enviar campañas. PostIAlo Mailing soporta tres opciones."
      )
    ),
    heading("6.1 Brevo", HeadingLevel.HEADING_2),
    numbered("Ingrese a Proveedor de Email y seleccione Brevo."),
    numbered("Pegue la API Key obtenida desde el panel de Brevo."),
    numbered("Conecte y seleccione un remitente verificado."),
    heading("6.2 Mailchimp", HeadingLevel.HEADING_2),
    numbered("Conecte con la API Key de Mailchimp."),
    numbered("Seleccione audiencia (lista) y remitente/dominio verificado."),
    heading("6.3 API HTTP personalizada", HeadingLevel.HEADING_2),
    p(
      t(
        "Para integraciones con un servicio propio de envío compatible con el contrato de la plataforma (POST JSON con to, subject, htmlContent)."
      )
    ),
    bullet("URL del endpoint (completa, incluyendo la ruta).", "https://api.ejemplo.com/mail"),
    bullet("Header de autenticación.", "X-API-Key (o el nombre que indique el proveedor)"),
    bullet("API Key (sin exponerla en capturas ni repositorios)."),
    bullet("Límite de peticiones por minuto.", "50"),
    callout(
      "Seguridad",
      "No incluya en la interfaz pública nombres, prefijos ni ejemplos que identifiquen clientes o proveedores internos. Use valores genéricos en documentación compartida."
    ),

    heading("7. Plantillas"),
    p(
      t(
        "Las plantillas definen el diseño HTML del correo. Deben incluir siete placeholders obligatorios para poder usarse en campañas:"
      )
    ),
    p(
      t(
        "{{ASUNTO}}, {{PREHEADER}}, {{IMAGEN_URL}}, {{CONTENIDO}}, {{CTA_TEXTO}}, {{CTA_URL}}, {{LOGO_URL}}."
      ),
      { after: 140 }
    ),
    heading("7.1 Generar con IA", HeadingLevel.HEADING_2),
    numbered("Vaya a Plantillas → Generar con IA."),
    numbered("Describa el estilo deseado (no el texto de una campaña concreta)."),
    numbered("Espere la generación y confirme la versión que desee usar."),
    p(
      [
        t("Ejemplo de indicación: ", { italics: true, color: MUTED, size: 20 }),
        t(
          "Quiero una plantilla para correos de promociones, llamativa, con diagramación que destaque la imagen y un botón de acción fuerte, usando los colores de mi marca.",
          { italics: true, color: MUTED, size: 20 }
        ),
      ],
      { after: 140 }
    ),
    heading("7.2 Subir HTML propio", HeadingLevel.HEADING_2),
    p(
      t(
        "Puede pegar o subir HTML. Si faltan placeholders, use el análisis asistido para completarlos. Una plantilla marcada como Incompleta no podrá seleccionarse en la campaña."
      )
    ),
    callout(
      "Estructura fija",
      "Todas las plantillas siguen el orden: Banner (logo + asunto) → Imagen → Contenido → Botón → Footer."
    ),

    heading("8. Contactos y bases de datos"),
    numbered("Cree una base de datos (por ejemplo: «Clientes activos El Salvador»)."),
    numbered("Agregue contactos manualmente o importe un archivo CSV/Excel."),
    numbered("Verifique que cada fila tenga al menos un correo válido."),
    p(
      [
        t("Ejemplo de contacto: ", { italics: true, color: MUTED, size: 20 }),
        t("Nombre: Ana López — Correo: ana.lopez@empresa.com — Cargo: Gerente de Operaciones", {
          italics: true,
          color: MUTED,
          size: 20,
        }),
      ],
      { after: 140 }
    ),
    p(
      t(
        "Para pruebas iniciales, se recomienda una base pequeña (por ejemplo, solo su propio correo) antes de enviar a listas amplias."
      )
    ),

    heading("9. Calendario y creación de campañas"),
    heading("9.1 Crear una campaña", HeadingLevel.HEADING_2),
    numbered("Abra Calendario y seleccione el día deseado."),
    numbered("Complete el nombre de la campaña."),
    numbered("Escriba la idea del correo (puede ser breve; la IA la expandirá)."),
    numbered("Defina el objetivo."),
    numbered("Opcional: active «Definir público objetivo» solo para esa campaña."),
    numbered("Elija si usará plantilla de diseño y selecciónela (debe estar completa)."),
    numbered("Indique el prompt de imagen o suba una imagen."),
    numbered("Seleccione la base de datos de destino y el proveedor (si hay más de uno)."),
    numbered("Defina fecha y hora de programación."),
    numbered("Guarde / genere el contenido."),
    heading("9.2 Ejemplos de campos de campaña", HeadingLevel.HEADING_2),
    simpleTable(
      ["Campo", "Ejemplo"],
      [
        ["Nombre", "Campaña de cobros — septiembre"],
        ["Idea", "Recordatorio amable de saldo pendiente con enlace de pago"],
        ["Objetivo", "Aumentar la recuperación de saldos en los próximos 7 días"],
        ["Público (opc.)", "Clientes con factura vencida de más de 15 días"],
        ["Prompt de imagen", "Dos profesionales de traje cerrando un acuerdo en oficina moderna, estilo corporativo"],
      ]
    ),

    heading("10. Revisión, aprobación y envío"),
    numbered("Revise el texto generado (asunto, cuerpo, CTA) y ajústelo si es necesario."),
    numbered("Apruebe el texto cuando esté conforme."),
    numbered("Revise la imagen; regenerela o súbala de nuevo si no encaja."),
    numbered("Apruebe la imagen."),
    numbered("Programe la campaña o envíela según las opciones disponibles."),
    p(
      t(
        "Durante el envío puede seguir el progreso. Si abandona la pantalla, el proceso puede continuar en segundo plano; el estado se consulta luego en el historial."
      )
    ),
    callout(
      "Buenas prácticas de envío",
      "Pruebe primero con una base de un solo contacto. Confirme remitente, plantilla completa y proveedor activo. En producción, asegúrese de que la plataforma tenga una URL pública para que las imágenes carguen en el buzón del destinatario."
    ),

    heading("11. Historial de correos"),
    p(
      t(
        "En Historial / Mis correos podrá ver campañas programadas, enviadas, parciales o fallidas; filtrar por fechas; reenviar o consultar el detalle de destinatarios (enviados / fallidos / pendientes)."
      )
    ),

    heading("12. Configuración y preferencias"),
    p(
      t(
        "Desde Configuración puede ajustar preferencias de la cuenta (por ejemplo, opciones de contenido como emojis, firma o tono formal). Los administradores y el superadministrador disponen de pantallas adicionales (usuarios, configuración avanzada de IA de plataforma, etc.), fuera del alcance operativo diario de un usuario estándar."
      )
    ),

    heading("13. Roles y permisos"),
    simpleTable(
      ["Rol", "Alcance típico"],
      [
        ["Usuario", "Opera su propia marca, campañas, contactos y proveedor"],
        ["Administrador", "Gestión ampliada de usuarios y operación de la cuenta"],
        ["Superadministrador", "Configuración global de la plataforma (por ejemplo, claves de IA)"],
      ]
    ),

    heading("14. Incidencias frecuentes"),
    simpleTable(
      ["Síntoma", "Qué revisar"],
      [
        ["No puede seleccionar una plantilla", "Que no esté marcada como Incompleta; debe tener los 7 placeholders"],
        ["La imagen no se ve en Gmail", "Si prueba en localhost, es esperado; publique la app con URL pública"],
        ["Falla la conexión del proveedor HTTP", "URL completa (incluye /mail si aplica), header y API key"],
        ["El correo no se envía", "Proveedor activo, base con contactos, texto e imagen aprobados"],
        ["Textos genéricos / poco de marca", "Completar Identidad de Marca y volver a generar"],
        ["No inicia sesión", "Credenciales, verificación de correo o cuenta desactivada"],
      ]
    ),

    heading("15. Glosario"),
    bullet("Campaña: correo (o conjunto de envíos) creado para una fecha, idea y base de contactos."),
    bullet("Placeholder: marcador en la plantilla (por ejemplo {{CONTENIDO}}) que se reemplaza al generar el correo final."),
    bullet("Proveedor de email: servicio que realmente despacha el mensaje (Brevo, Mailchimp u API HTTP)."),
    bullet("Identidad de marca: conjunto de datos y estilos que guían a la IA y al diseño."),
    bullet("Onboarding: secuencia inicial de configuración antes de operar con normalidad."),
    p([t("")], { after: 200 }),
    p([t("PostIAlo Mailing — Manual de usuario", { bold: true, color: PRIMARY, size: 20 })], {
      align: AlignmentType.CENTER,
      after: 40,
    }),
    p([t("Documento generado para uso operativo interno. Tipografía: Montserrat.", { size: 18, color: MUTED, italics: true })], {
      align: AlignmentType.CENTER,
    }),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          styles: [
            {
              id: "Normal",
              run: { font: FONT, size: 22, color: "1A2332" },
            },
          ],
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 420, hanging: 220 } } },
            },
          ],
        },
        {
          reference: "steps",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 420, hanging: 220 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.85),
              bottom: convertInchesToTwip(0.85),
              left: convertInchesToTwip(0.9),
              right: convertInchesToTwip(0.9),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { after: 60 },
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 8, color: PRIMARY, space: 4 },
                },
                children: [
                  new ImageRun({
                    type: "png",
                    data: logo.headerPng,
                    transformation: { width: headerDisplayW, height: headerDisplayH },
                    altText: {
                      title: "PostIAlo",
                      description: "Logo PostIAlo",
                      name: "postialo-header",
                    },
                  }),
                  new TextRun({ text: "   Manual de usuario", font: FONT, size: 16, color: MUTED }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  t("Página ", { size: 16, color: MUTED }),
                  new TextRun({
                    font: FONT,
                    size: 16,
                    color: MUTED,
                    children: [PageNumber.CURRENT],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [...cover, ...toc, ...body],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buffer);
  console.log("OK:", OUT, `(${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
