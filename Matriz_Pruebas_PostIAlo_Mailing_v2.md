# MATRIZ DE PRUEBAS GRANULAR (QA) — PostIAlo Mailing v2

Esta matriz cubre **todos** los puntos críticos de funcionalidad, usabilidad e integridad técnica de la plataforma. Diseñada para ejecución por un tester que no conoce el sistema.

---

## Credenciales de Prueba

| Dato | Valor |
|---|---|
| URL Desarrollo | [URL del Repl en desarrollo] |
| URL Producción | https://mailing.postialo.com |
| Usuario SuperAdmin | admin@postialo.com |
| Contraseña SuperAdmin | SuperAdmin2026! |

---

## 1. Registro, Verificación de Email y Login

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| L01 | Acceso | Carga de la URL | Colocar la URL de la plataforma en el navegador y presionar Enter. | La página de Login carga completamente sin errores 404, 500 ni pantallas en blanco. Se muestra el formulario de inicio de sesión con el logo PostIAlo Mailing y el favicon personalizado (sobre con insignia IA). |
| L02 | Login | Login exitoso | Ingresar admin@postialo.com y la contraseña correcta. Hacer clic en "Iniciar Sesión". | Redirige a la página de Inicio (/). Se muestra el saludo personalizado con el nombre del usuario y el dashboard principal. |
| L03 | Login | Login con credenciales inválidas | Ingresar un email correcto pero contraseña incorrecta. | Se muestra un mensaje de error indicando que las credenciales son inválidas. No redirige. |
| L04 | Login | Login con campos vacíos | Intentar hacer clic en "Iniciar Sesión" sin llenar ningún campo. | El formulario muestra mensajes de validación en los campos vacíos. No se envía la solicitud. |
| L05 | Registro | Registro de nueva cuenta | Cambiar al modo "Registrarse". Llenar nombre, email nuevo, empresa y contraseña. Hacer clic en "Crear Cuenta". | Se muestra la pantalla de "Verifica tu correo electrónico" con mensaje de espera. NO se hace auto-login. Se recibe un correo de verificación en el buzón del email ingresado. |
| L06 | Registro | Correo de verificación recibido | Revisar la bandeja de entrada del email registrado. | Se recibe un correo con diseño PostIAlo Mailing (fondo azul #002073, logo con IA en rojo, sobre blanco). Contiene saludo personalizado, botón "Verificar mi cuenta" y enlace de respaldo. |
| L07 | Verificación | Clic en "Verificar mi cuenta" | Hacer clic en el botón "Verificar mi cuenta" del correo recibido. | El navegador redirige a la app. El usuario queda automáticamente logueado (auto-login) y se muestra la página de Inicio. La cuenta pasa a estado verificada. |
| L08 | Verificación | Polling en pantalla de espera | Sin hacer clic en el correo, esperar en la pantalla "Verifica tu correo" y observar. | La pantalla realiza polling cada 3 segundos. Al verificar la cuenta desde otro dispositivo/pestaña, la pantalla detecta el cambio automáticamente y redirige a la página de inicio. |
| L09 | Verificación | Reenvío de correo | En la pantalla de verificación pendiente, hacer clic en "Reenviar correo de verificación". | Se envía un nuevo correo de verificación. Se muestra un toast confirmando el reenvío. El enlace anterior queda invalidado. |
| L10 | Verificación | Token expirado | Esperar más de 24 horas sin verificar (o simular expiración). Hacer clic en el enlace del correo. | Se redirige a la página /verify/error con el mensaje "El enlace de verificación ha expirado. Solicita uno nuevo desde la pantalla de inicio de sesión." |
| L11 | Verificación | Token inválido | Modificar manualmente el token en la URL de verificación y acceder. | Se redirige a la página /verify/error con el mensaje "El enlace de verificación es inválido o ya fue utilizado." y un botón "Ir al inicio de sesión". |
| L12 | Verificación | Login de usuario no verificado | Registrar una cuenta pero NO verificarla. Intentar hacer login con esas credenciales. | El sistema muestra un mensaje "Cuenta no verificada" y abre la pantalla de verificación pendiente con opción de reenviar correo. NO permite el acceso al dashboard. |
| L13 | Registro | Registro con email duplicado | Intentar registrarse con un email que ya existe en el sistema. | El sistema muestra un error indicando que el email ya está registrado. No crea cuenta duplicada. |
| L14 | Seguridad | Acceso sin sesión | Cerrar sesión y luego intentar acceder directamente a /calendar o /brand escribiendo la URL en el navegador. | Redirige automáticamente a /login. No permite acceso a rutas protegidas sin autenticación. |
| L15 | Seguridad | Rate Limiting | Intentar hacer login 11 veces seguidas con contraseña incorrecta en menos de 15 minutos. | Después del intento 10, el sistema bloquea temporalmente con un mensaje de "Demasiados intentos". |
| L16 | Branding | Título y Favicon | Verificar la pestaña del navegador. | La pestaña muestra "PostIAlo Mailing" como título y un favicon SVG con un sobre sobre fondo azul con insignia "IA" en rojo. NO muestra el logo de Replit. |

---

## 2. Página de Inicio (Home)

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| H01 | Home | Saludo personalizado | Verificar el encabezado superior tras iniciar sesión. | Muestra un saludo acorde a la hora del día ("Buenos días", "Buenas tardes" o "Buenas noches") seguido del nombre del usuario. |
| H02 | Home | Tarjetas de acciones rápidas | Verificar la presencia de 4 tarjetas de acción en el grid principal. | Se muestran las 4 tarjetas: "Crear Campaña" (azul), "Mi Marca" (violeta), "Plantillas" (esmeralda), "Contactos" (ámbar), cada una con su ícono correspondiente. |
| H03 | Home | Navegación desde tarjetas | Hacer clic en cada una de las 4 tarjetas de acción. | "Crear Campaña" lleva a /calendar. "Mi Marca" lleva a /brand. "Plantillas" lleva a /templates. "Contactos" lleva a /contacts. |
| H04 | Home | Botón "Nueva Campaña" | Hacer clic en el botón "Nueva Campaña" del encabezado. | Redirige al calendario (/calendar). |
| H05 | Home | Animaciones de entrada | Recargar la página y observar la carga de elementos. | Los elementos aparecen progresivamente con efecto fade-in de abajo hacia arriba, con delays escalonados. Sin saltos ni parpadeos. |
| H06 | Home | Hover en tarjetas | Pasar el cursor sobre cada tarjeta de acción rápida. | La tarjeta se eleva ligeramente y aparece una sombra sutil. La transición es suave. |
| H07 | Home | Indicadores estadísticos | Verificar las 3 tarjetas de estadísticas en el panel lateral derecho. | Se muestran: "Total Campañas", "Correos Enviados" y "Programados" con conteos numéricos que coinciden con los datos reales del usuario. |
| H08 | Home | Feed de actividad reciente | Verificar la sección "Actividad Reciente" en el panel lateral. | Muestra las 4 campañas más recientes con su asunto, fecha formateada y badge de estado coloreado (Borrador/Programado/Enviado/etc.). |
| H09 | Home | Enlace "Ver historial completo" | Hacer clic en "Ver historial completo" en la sección de actividad. | Redirige a /emails (Mis Correos). |
| H10 | Home | Tarjeta de onboarding condicional | Iniciar sesión con un usuario nuevo que no tenga identidad de marca configurada. | Aparece una tarjeta con gradiente invitando a configurar la identidad de marca, con un botón que lleva a /brand. |
| H11 | Home | Ocultamiento de tarjeta onboarding | Iniciar sesión con un usuario que ya tiene identidad de marca configurada. | La tarjeta de onboarding NO aparece. |
| H12 | Home | Secciones educativas | Verificar las tarjetas "¿Cómo funciona?" y "Funcionalidades". | Ambas tarjetas se muestran lado a lado con su contenido: pasos numerados de uso y lista de funcionalidades respectivamente. |

---

## 3. Identidad de Marca

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| B01 | Marca | Carga de la página | Navegar a /brand desde el sidebar o una tarjeta de Home. | La página carga mostrando dos columnas: "Mi Empresa" (izquierda) y "Lineamientos y Branding" (derecha), con la barra de progreso en la parte superior. |
| B02 | Marca | Barra de progreso vacía | Acceder con un usuario nuevo sin campos completados. | La barra de progreso muestra 0% en color rojo con la etiqueta "Apenas comenzando". |
| B03 | Marca | Llenar campos básicos | Llenar los campos: Nombre de la empresa, Industria, Sitio web y WhatsApp. | Los campos se guardan correctamente. La barra de progreso sube proporcionalmente y cambia de color (rojo -> naranja). |
| B04 | Marca | Llenar Misión y Visión | Expandir la sección "Misión y Visión" y llenar ambos campos con texto. | Las secciones colapsables se expanden y contraen correctamente. Los datos se guardan. La barra sigue subiendo. |
| B05 | Marca | Llenar Productos e Historia | Escribir en los textareas de Productos/Servicios e Historia. | Los datos se persisten al guardar. Verificar recargando la página y confirmando que los valores permanecen. |
| B06 | Marca | Configurar Remitente | Llenar "Nombre del remitente" y "Email verificado" en la sección de remitente. | Los campos se guardan. Estos valores se usarán como sender_name y sender_email al enviar campañas. |
| B07 | Marca | Dropdown de Tono | Hacer clic en el selector de "Tono de comunicación" y seleccionar cada opción. | El dropdown muestra todas las opciones: Profesional, Amigable, Formal, Casual, Inspirador, Urgente, Educativo. La selección se guarda correctamente. |
| B08 | Marca | Dropdown de Estilo Visual | Hacer clic en el selector de "Estilo visual" y seleccionar cada opción. | Muestra: Minimalista, Corporativo, Moderno, Creativo, Elegante. La selección se guarda y afecta directamente el estilo de las plantillas generadas por IA. |
| B09 | Marca | Selectores de Color | Modificar los 3 colores (primario, secundario, acento) ingresando códigos hexadecimales. | Cada campo muestra una previsualización del color seleccionado (cuadrado coloreado). Los valores se guardan en formato hexadecimal. |
| B10 | Marca | Dropdowns de Tipografía | Seleccionar fuentes para títulos y cuerpo. | Cada dropdown muestra las opciones: Inter, Roboto, Open Sans, Montserrat, Playfair Display, Merriweather, Lato, Poppins, Plus Jakarta Sans, Arial. La selección se guarda. |
| B11 | Marca | Subida de Logo | Subir una imagen de logo (PNG o JPG). | La imagen se carga y muestra una previsualización. Se almacena correctamente. Al recargar la página, el logo sigue visible. |
| B12 | Marca | Barra de progreso completa | Llenar todos los campos disponibles de identidad de marca. | La barra llega a 100% en color verde con la etiqueta "¡Completo!". |
| B13 | Marca | Persistencia de datos | Llenar varios campos, recargar la página completamente (F5). | Todos los campos mantienen los valores previamente guardados. Ningún dato se pierde. |
| B14 | Marca | Secciones colapsables | Expandir y contraer cada sección (Información básica, Misión y Visión, Productos, etc.). | Las secciones se expanden y contraen con animación suave sin afectar el layout ni los datos de otros campos. |
| B15 | Marca | Guía de estilo de contenido | Llenar el campo "Guía de estilo de contenido" con instrucciones específicas (ej: "Siempre usar lenguaje formal, no usar jerga"). | El campo se guarda y este contenido se inyecta en el prompt de OpenAI al generar textos de campaña. |

---

## 4. Gestión de Plantillas

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| T01 | Plantillas | Carga de la página | Navegar a /templates. | La página carga mostrando dos secciones: "Plantillas Confirmadas" y "Borradores / Por Confirmar", cada una con su grid de plantillas. |
| T02 | Plantillas | Crear plantilla con IA | Hacer clic en "Crear con IA". Escribir un prompt descriptivo (ej: "Plantilla moderna para promociones de restaurante"). Confirmar. | Se genera una plantilla HTML completa con los estilos de la identidad de marca. Se muestra en la sección de borradores con badge "PostIAlo". El indicador muestra "Compatible" (verde) si los 6 placeholders están presentes. |
| T03 | Plantillas | Cargar plantilla manual | Hacer clic en "Cargar Plantilla". Ingresar un nombre y pegar código HTML válido con los 6 placeholders. | La plantilla se guarda y aparece en la sección de borradores. Se marca como "Compatible" si tiene todos los placeholders. |
| T04 | Plantillas | Cargar plantilla sin placeholders | Cargar una plantilla HTML que NO contenga los 6 placeholders obligatorios. | La plantilla se guarda pero se marca como "Incompleta" con badge ámbar. |
| T05 | Plantillas | Analizar placeholders | Seleccionar una plantilla marcada como "Incompleta" y ejecutar "Analizar Placeholders". | La IA inserta automáticamente los placeholders faltantes sin alterar el diseño original. El badge cambia a "Compatible" (verde). |
| T06 | Plantillas | Vista previa | Hacer clic en el ícono de ojo de cualquier plantilla. | Se abre una vista previa a pantalla completa del HTML de la plantilla. Los placeholders se muestran como texto literal ({{ASUNTO}}, {{CONTENIDO}}, etc.). |
| T07 | Plantillas | Edición con IA | Hacer clic en el ícono Sparkles de una plantilla. Escribir instrucciones (ej: "Cambia el color del header a azul marino"). | La IA aplica los cambios solicitados sin perder los placeholders ni romper la estructura. Se muestra la versión editada para confirmar. |
| T08 | Plantillas | Edición manual de HTML | Hacer clic en el ícono de código. Modificar directamente el HTML. Guardar. | Los cambios se persisten. La previsualización refleja las modificaciones. |
| T09 | Plantillas | Edición de textos | Hacer clic en el ícono Aa. Modificar solo los textos sin tocar HTML. Guardar. | Solo se modifican los nodos de texto. La estructura HTML, estilos y placeholders permanecen intactos. |
| T10 | Plantillas | Renombrar plantilla | Hacer clic en el ícono de lápiz. Cambiar el nombre. Confirmar. | El nombre se actualiza inmediatamente en la tarjeta de la plantilla. Persiste al recargar. |
| T11 | Plantillas | Marcar como favorita | Hacer clic en el ícono de estrella de una plantilla. | La plantilla se marca como favorita y se reordena al inicio de la lista. El ícono de estrella cambia a estado activo (relleno). |
| T12 | Plantillas | Eliminar plantilla | Hacer clic en el ícono de basura de una plantilla. Confirmar eliminación en el AlertDialog. | Se muestra un AlertDialog de confirmación (NO window.confirm nativo). Al confirmar, la plantilla desaparece del grid. |
| T13 | Plantillas | Confirmar borrador | Seleccionar una plantilla de la sección "Borradores" y confirmarla. | La plantilla se mueve a la sección "Plantillas Confirmadas". Solo las confirmadas aparecen como opciones al crear campañas. |
| T14 | Plantillas | Campos bloqueados (lockedFields) | Verificar que una plantilla con campo "imagen" bloqueado muestre el indicador de candado. | Se muestra un ícono de candado junto al campo. Cuando se usa esta plantilla en una campaña, la imagen no requiere aprobación manual. |
| T15 | Plantillas | Sistema de versiones | Generar ediciones con IA de una plantilla. Verificar que aparezcan versiones no confirmadas. | Se muestran las versiones con opción de previsualizar cada una. Al hacer clic en "Confirmar esta versión", las alternativas se eliminan. |

---

## 5. Gestión de Contactos

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| C01 | Contactos | Carga de la página | Navegar a /contacts. | La página carga mostrando las bases de datos existentes como tarjetas expandibles con su nombre y conteo de contactos. |
| C02 | Contactos | Crear nueva base de datos | Hacer clic en "Nueva Base de Datos". Ingresar un nombre (ej: "Clientes VIP"). Confirmar. | Se crea una base de datos vacía que aparece en la lista. Muestra "0 contactos". |
| C03 | Contactos | Importar desde Excel | Expandir una base de datos. Hacer clic en importar. Seleccionar un archivo .xlsx con columnas "nombre" y "correo". | Los contactos se importan correctamente. Se muestra un toast indicando la cantidad importada (ej: "15 contactos importados"). Los contactos aparecen en la tabla. |
| C04 | Contactos | Importar desde CSV | Repetir el proceso de importación pero con un archivo .csv. | Funciona de igual manera que con Excel. Los contactos se cargan correctamente. |
| C05 | Contactos | Importación con duplicados | Importar un archivo que contenga emails ya existentes en la base de datos. | El sistema omite los duplicados automáticamente y notifica cuántos fueron omitidos (ej: "10 importados, 3 duplicados omitidos"). |
| C06 | Contactos | Importación con emails inválidos | Incluir en el archivo emails con formato incorrecto (sin @, sin dominio, etc.). | Los registros con email inválido se omiten. Se importan solo los válidos. Se notifica la cantidad de errores. |
| C07 | Contactos | Mapeo automático de columnas | Importar un archivo con columnas en español (ej: "Correo electrónico", "Nombre completo") y otro con columnas en inglés ("Email", "Full Name"). | El sistema mapea automáticamente ambas variantes correctamente sin intervención del usuario. |
| C08 | Contactos | Importar más de 5,000 contactos | Intentar importar un archivo con más de 5,000 registros. | El sistema rechaza la importación con un mensaje indicando que el límite es 5,000 contactos por operación. |
| C09 | Contactos | Agregar contacto manual | Expandir una base de datos. Activar modo edición. Hacer clic en "Agregar contacto". Llenar email y nombre. Guardar. | El contacto se agrega a la tabla y persiste al recargar la página. |
| C10 | Contactos | Agregar contacto sin email | Intentar agregar un contacto sin llenar el campo de email. | El sistema no permite guardarlo. Muestra validación de campo obligatorio. |
| C11 | Contactos | Editar contacto existente | En modo edición, hacer clic en un contacto. Modificar el nombre o email. Guardar. | Los cambios se persisten inmediatamente. La tabla refleja la actualización. |
| C12 | Contactos | Eliminar contacto | En modo edición, hacer clic en el ícono de eliminar de un contacto. | El contacto se elimina de la tabla. No es posible recuperarlo. |
| C13 | Contactos | Eliminar base de datos completa | Hacer clic en el botón de eliminar de una base de datos. Confirmar en el AlertDialog. | Se muestra AlertDialog de confirmación. La base de datos y TODOS sus contactos se eliminan permanentemente en cascada. |
| C14 | Contactos | Búsqueda de contactos | Expandir una base de datos con múltiples contactos. Escribir un nombre o email en la barra de búsqueda. | La tabla se filtra en tiempo real mostrando solo los contactos que coinciden con el texto buscado. |
| C15 | Contactos | Modo sobrescribir | Importar contactos en modo "Sobrescribir" a una base de datos que ya tiene registros. | Todos los contactos anteriores se eliminan y se reemplazan por los del nuevo archivo. |

---

## 6. Calendario y Creación de Campañas

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| K01 | Calendario | Carga de la vista | Navegar a /calendar. | Se muestra un calendario mensual con los días de la semana (L-D). Se visualizan miniaturas de campañas existentes en sus fechas correspondientes. |
| K02 | Calendario | Navegación entre meses | Hacer clic en las flechas de navegación para cambiar de mes (adelante y atrás). | El calendario se actualiza mostrando el mes correcto con sus campañas correspondientes. |
| K03 | Calendario | Crear campaña desde día vacío | Hacer clic en un día sin campañas en el calendario. | Se abre directamente el asistente de creación de campaña (diálogo modal). |
| K04 | Calendario | Crear campaña desde día ocupado | Hacer clic en un día que ya tiene campañas programadas. | Se abre un diálogo de elección: "Nuevo Correo" o seleccionar una campaña existente para editar. |
| K05 | Calendario | Wizard: Idea y Objetivo | En el wizard de creación, llenar el campo "Idea" y "Objetivo" con texto descriptivo. | Los campos aceptan el texto sin problemas. Ambos son obligatorios. |
| K06 | Calendario | Wizard: Público Objetivo | Llenar el campo opcional de "Público Objetivo" con una descripción. | El campo se acepta y se enviará a la IA como contexto adicional para adaptar el tono del contenido. |
| K07 | Calendario | Wizard: Selección de plantilla | Hacer clic en el selector de plantilla y elegir una de las plantillas disponibles. | Se muestra la lista de plantillas confirmadas del usuario con previsualizaciones. Solo se muestran las que tienen todos los placeholders ("Compatible"). La plantilla aparece ANTES de la opción de imagen en el formulario. |
| K08 | Calendario | Wizard: Imagen oculta con plantilla bloqueada | Seleccionar una plantilla que tiene el campo "imagen" bloqueado (lockedFields incluye "imagen"). | El selector de imagen/prompt de imagen se OCULTA automáticamente del formulario, ya que la plantilla maneja la imagen internamente. |
| K09 | Calendario | Wizard: Prompt de imagen | Con una plantilla sin imagen bloqueada, seleccionar "Prompt de Imagen" y escribir una descripción para la IA. | El campo acepta texto hasta 1,200 caracteres. Se usará para generar la imagen con Gemini. |
| K10 | Calendario | Wizard: Subir imagen manual | Seleccionar "Subir Imagen" y cargar un archivo JPG o PNG. | La imagen se sube correctamente y se usa como imagen de la campaña en lugar de generar una con IA. |
| K11 | Calendario | Wizard: Selección de base de datos | Hacer clic en el selector de base de datos y elegir una. | Se muestra la lista de bases de datos del usuario con la cantidad de contactos de cada una. |
| K12 | Calendario | Wizard: Programar fecha y hora | Seleccionar una fecha futura y una hora específica. | Los selectores de fecha y hora funcionan correctamente. La campaña se programará para esa fecha. |
| K13 | Calendario | Generar campaña con IA | Llenar todos los campos del wizard y hacer clic en "Generar Correo". | Se muestra una barra de progreso durante la generación. OpenAI (gpt-4.1-mini) genera el texto (asunto, preheader, cuerpo, CTA) y simultáneamente Gemini (gemini-2.0-flash-exp) genera la imagen. Al completarse, se abre el editor con el contenido generado. |
| K14 | Calendario | Error de generación por campos vacíos | Intentar generar una campaña sin llenar Idea u Objetivo. | El sistema muestra validación indicando los campos obligatorios faltantes. No permite avanzar. |

---

## 7. Editor de Campaña

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| E01 | Editor | Visualización del contenido generado | Tras generar una campaña, verificar que todos los campos estén poblados. | Se muestran: imagen generada (izquierda), asunto, preheader, cuerpo del correo en editor TipTap, texto del CTA y URL del CTA (derecha). |
| E02 | Editor | Edición del asunto | Modificar manualmente el texto del campo "Asunto". | El campo es editable. Los cambios se persisten al guardar. |
| E03 | Editor | Edición del preheader | Modificar el campo "Preheader". | Editable y persistente. |
| E04 | Editor | Edición del cuerpo con TipTap | Modificar el texto del cuerpo usando el editor de texto enriquecido: aplicar negritas, cursivas, listas, agregar párrafos. | El editor TipTap funciona correctamente. Todas las herramientas de formato aplican los estilos esperados. El contenido se guarda como HTML limpio. |
| E05 | Editor | Edición del CTA | Modificar el texto y la URL del botón de acción (CTA). | Ambos campos son editables. Los cambios se reflejan en la vista previa. |
| E06 | Editor | CTA bloqueado por plantilla | Usar una plantilla con lockedFields que incluya "cta" o "cta_url". | Los campos CTA correspondientes aparecen como no editables con indicador de candado. |
| E07 | Editor | Regenerar texto (correcciones) | Hacer clic en "Regenerar Texto". Escribir correcciones (ej: "Hazlo más corto y urgente"). Confirmar. | La IA genera una nueva versión del texto aplicando las correcciones. Se crea una versión V2. El contenido anterior se puede recuperar desde el historial. |
| E08 | Editor | Límite de 3 regeneraciones de texto | Regenerar el texto 3 veces seguidas. Intentar una 4ta. | Las primeras 3 funcionan normalmente. Al intentar la 4ta, el botón se deshabilita o muestra un mensaje de "Máximo 3 regeneraciones alcanzado". |
| E09 | Editor | Historial de texto | Hacer clic en "Historial de Texto". | Se muestra una lista de versiones (V1, V2, V3). Al hacer clic en cualquier versión, se restaura ese contenido en el editor. |
| E10 | Editor | Aprobar texto | Hacer clic en "Aprobar Texto". | El texto se marca como aprobado. Es un requisito para poder publicar la campaña. |
| E11 | Editor | Regenerar imagen | Hacer clic en "Regenerar Imagen". Escribir un nuevo prompt de imagen. Confirmar. | Gemini genera una nueva imagen. Se crea una versión de imagen nueva. La imagen anterior se puede recuperar desde el historial. |
| E12 | Editor | Límite de 3 regeneraciones de imagen | Regenerar la imagen 3 veces. Intentar una 4ta. | Se bloquea al alcanzar el máximo de 3 regeneraciones. |
| E13 | Editor | Cargar imagen manual | Hacer clic en "Cargar Imagen". Seleccionar un archivo JPG/PNG desde el equipo. | La imagen se carga y reemplaza la imagen actual de la campaña. |
| E14 | Editor | Historial de imágenes | Hacer clic en "Historial de Imágenes". | Se muestra una galería visual con las versiones de imagen generadas. Al hacer clic en cualquiera, se restaura como imagen activa. |
| E15 | Editor | Aprobar imagen | Hacer clic en "Aprobar Imagen". | La imagen se marca como aprobada. Es un requisito para poder publicar la campaña. |
| E16 | Editor | Imagen auto-aprobada (lockedFields) | Usar una plantilla con lockedFields incluyendo "imagen". | La imagen se considera automáticamente aprobada (imageEffectivelyApproved = true). No se requiere aprobación manual ni se muestra el botón de aprobar imagen. |
| E17 | Editor | Nano Banana: Agregar | Abrir Nano Banana. Seleccionar acción "Agregar". Subir una imagen de referencia. Escribir instrucciones. Ejecutar. | Gemini integra el elemento de la imagen de referencia en la imagen principal de forma natural. |
| E18 | Editor | Nano Banana: Reemplazar | Seleccionar "Reemplazar". Indicar qué elemento reemplazar. Subir referencia. | Gemini reemplaza solo el elemento indicado manteniendo el resto intacto. |
| E19 | Editor | Nano Banana: Fusionar | Seleccionar "Fusionar". Subir imagen de referencia. Dar instrucciones. | Gemini combina ambas imágenes en una composición coherente. |
| E20 | Editor | Nano Banana: Estilo | Seleccionar "Estilo". Subir imagen de referencia con un estilo artístico. | Gemini aplica la estética de la referencia a la imagen principal. |
| E21 | Editor | Nano Banana: Borrar elemento | Seleccionar "Borrar elemento". Indicar qué eliminar. | Gemini borra el elemento y rellena el espacio con inpainting automático. |
| E22 | Editor | Vista Previa del Correo | Hacer clic en "Vista Previa" (previa rápida). | Se abre un iframe con la previsualización del contenido actual del correo. |
| E23 | Editor | Vista Previa Final | Hacer clic en "Vista Previa Final". | Se genera la previsualización completa: plantilla HTML + contenido + imagen + CTA renderizados. Si hay campos faltantes, muestra advertencia indicando cuáles. |
| E24 | Editor | Programar campaña | Configurar fecha y hora futura. Hacer clic en "Programar". | La campaña pasa a status "scheduled" (Programado). Aparece en el calendario en la fecha correspondiente con badge azul. |
| E25 | Editor | Publicar Ahora | Aprobar texto e imagen. Hacer clic en "Publicar Ahora". | El botón solo se habilita cuando ambos están aprobados (o imagen es effectively approved por lockedFields). Al hacer clic, se dispara el envío inmediato. La barra de progreso de envío aparece. |
| E26 | Editor | Publicar sin aprobación | Intentar hacer clic en "Publicar Ahora" sin haber aprobado texto e imagen. | El botón está deshabilitado o muestra mensaje indicando que se requiere aprobación. |
| E27 | Editor | Progreso de envío en tiempo real | Tras publicar, observar la barra de progreso de envío. | La barra se actualiza en tiempo real mostrando: enviados, fallidos y total. Al completarse, cambia el status a "Enviado", "Parcial" o "Fallido". |
| E28 | Editor | Log detallado de envío | Hacer clic en el toggle de detalle durante o después del envío. | Se muestra una lista con el estado individual por contacto: pendiente, enviado o fallido (con mensaje de error si aplica). |
| E29 | Editor | Cambiar plantilla después de generar | En el editor, hacer clic en "Cambiar" plantilla y seleccionar otra. | La plantilla se actualiza. La Vista Previa Final refleja la nueva plantilla con el mismo contenido. |
| E30 | Editor | Cambiar base de datos después de generar | En el editor, cambiar la base de datos de destino. | Se actualiza la base de datos destino. El conteo de contactos en la información de envío refleja la nueva BD. |
| E31 | Editor | Volver al calendario | Hacer clic en "Volver al Calendario". | Regresa a la vista de calendario mensual. La campaña aparece en la fecha correspondiente. |
| E32 | Editor | Cancelar campaña programada | Con una campaña en status "Programado", hacer clic en "Cancelar". | La campaña pasa a status "Cancelado". Los controles de edición se bloquean. |

---

## 8. Mis Correos (Historial)

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| M01 | Emails | Carga de la página | Navegar a /emails. | Se muestra la lista cronológica de campañas enviadas y programadas, de más reciente a más antigua. |
| M02 | Emails | Información de cada correo | Verificar los datos mostrados por cada entrada. | Cada correo muestra: ícono de estado, asunto del correo, fecha y hora formateada, y badge de estado coloreado. |
| M03 | Emails | Badges de estado | Verificar los colores de los badges según el estado. | Programado: azul. Enviado: verde esmeralda. Borrador: gris. Los colores coinciden y los íconos son los correctos. |
| M04 | Emails | Expandir detalle de campaña | Hacer clic en una campaña de la lista. | Se expande con animación suave mostrando: Idea, Objetivo, Tono, Layout, Público Objetivo, Prompt de Imagen y Base de Datos utilizada. |
| M05 | Emails | Filtro por fechas | Hacer clic en "Filtrar". Seleccionar una fecha "Desde" y una fecha "Hasta". | La lista se filtra mostrando solo las campañas dentro del rango de fechas seleccionado. |
| M06 | Emails | Indicador de filtro activo | Con un filtro de fechas activo, verificar el botón de filtrar. | Aparece un punto blanco indicador en el botón de "Filtrar" señalando que hay filtros activos. |
| M07 | Emails | Limpiar filtros | Con filtros activos, hacer clic en "Limpiar". | Los filtros se resetean y se muestra la lista completa nuevamente. El indicador del botón desaparece. |
| M08 | Emails | Botón Reenviar Campaña | Expandir una campaña con status "Enviado". | Aparece el botón "Reenviar Campaña". Para campañas con otros estados, el botón NO aparece. |
| M09 | Emails | Abrir modal de reenvío | Hacer clic en "Reenviar Campaña". | Se abre un diálogo modal mostrando: imagen original (solo lectura), campos editables de asunto, preheader, editor TipTap con el cuerpo, CTA texto y URL, selector de base de datos destino, y selectores de fecha y hora. |
| M10 | Emails | Editar campos en reenvío | Modificar el asunto, cuerpo (usando TipTap) y CTA en el modal de reenvío. | Todos los campos son editables. El editor TipTap funciona correctamente con formato enriquecido. |
| M11 | Emails | Confirmar reenvío | Llenar los campos del reenvío y confirmar. | Se crea una nueva campaña con el sufijo "(reenvío)" en el nombre. Se redirige al calendario con la nueva campaña abierta en modo reenvío (UI simplificada). |
| M12 | Emails | Modo reenvío en calendario | Tras confirmar un reenvío, verificar la UI en el calendario. | Se muestra UI simplificada: sin botones de regenerar imagen/texto, sin Nano Banana, sin historial. Solo editor TipTap, Guardar, Aprobar, Vista Previa y Publicar. La imagen aparece como "no editable". |

---

## 9. Dashboard Analítico

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| D01 | Dashboard | Carga de la página | Navegar a /dashboard. | La página carga mostrando 4 tarjetas de KPIs, gráficas y listas de ranking. |
| D02 | Dashboard | KPI: Total Campañas | Verificar la tarjeta "Total Campañas". | Muestra el conteo total correcto con desglose por estado: Borrador, Programado, Enviado, Cancelado. Los números coinciden con la realidad del usuario. |
| D03 | Dashboard | KPI: Contactos Alcanzados | Verificar la tarjeta "Contactos Alcanzados". | Muestra el total de contactos únicos en bases de datos asociadas a campañas enviadas. |
| D04 | Dashboard | KPI: Bases de Datos | Verificar la tarjeta "Bases de Datos". | Muestra el conteo correcto de bases de datos del usuario. |
| D05 | Dashboard | KPI: Promedio Versiones IA | Verificar la tarjeta "Promedio Versiones IA". | Muestra el promedio de iteraciones de IA por campaña. El número tiene sentido (entre 1.0 y 3.0). |
| D06 | Dashboard | Gráfica de Actividad del Mes | Verificar el gráfico de línea. | Muestra la tendencia diaria de campañas del mes actual. Los puntos de datos coinciden con las fechas reales de las campañas. |
| D07 | Dashboard | Gráfica de Campañas por Mes | Verificar el gráfico de barras. | Muestra el volumen de campañas de los últimos 6 meses. Las barras reflejan la actividad real. |
| D08 | Dashboard | Ranking de Bases de Datos | Verificar la lista "Bases de Datos Más Usadas". | Muestra el top 5 ordenado por frecuencia de uso en campañas. |
| D09 | Dashboard | Ranking de Plantillas | Verificar la lista "Plantillas Más Usadas". | Muestra el top 5 ordenado por frecuencia de uso. |
| D10 | Dashboard | Actividad Reciente | Verificar la lista de actividad reciente. | Muestra las 5 campañas más recientes con estado y fecha correctos. |
| D11 | Dashboard | Filtro de fechas | Seleccionar un rango de fechas "Desde" y "Hasta". | Todas las métricas, gráficas y listas se recalculan mostrando solo datos del período seleccionado. |
| D12 | Dashboard | Congruencia de datos | Comparar los números del Dashboard con los de la página de Mis Correos y la sección de Contactos. | Los totales deben coincidir exactamente. No hay discrepancias entre las diferentes secciones. |

---

## 10. Panel de Administración

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| A01 | Admin | Acceso como superadmin | Iniciar sesión con admin@postialo.com (rol superadmin). Navegar a /admin. | El panel de administración carga mostrando estadísticas globales, barra de búsqueda y tabla de usuarios. |
| A02 | Admin | Acceso no autorizado | Iniciar sesión con un usuario sin rol admin. Intentar navegar directamente a /admin/users. | Se muestra un mensaje de "Acceso Denegado". No se expone la interfaz de administración. |
| A03 | Admin | Estadísticas globales | Verificar las tarjetas de estadísticas en la parte superior. | Muestran: Total de Usuarios, Total de Campañas, Plantillas, Contactos, Bases de Datos y Correos Enviados de toda la plataforma. |
| A04 | Admin | Tabla de usuarios | Verificar la tabla con la lista de usuarios. | Muestra cada usuario con: nombre, email, fecha de registro, badge de rol (SuperAdmin/Admin/Usuario), badge de estado (Activo/Inactivo), y conteos de campañas, plantillas, contactos y bases de datos. |
| A05 | Admin | Búsqueda de usuarios | Escribir un nombre, email o empresa en la barra de búsqueda. | La tabla se filtra en tiempo real mostrando solo los usuarios que coinciden. |
| A06 | Admin | Crear nuevo usuario | Hacer clic en "Nuevo Usuario". Llenar nombre, email, empresa, contraseña y rol. Confirmar. | El usuario se crea exitosamente y aparece en la tabla. Puede iniciar sesión con las credenciales proporcionadas. El nuevo usuario se crea como VERIFICADO (no requiere verificación por email). |
| A07 | Admin | Editar usuario | Hacer clic en el ícono de lápiz de un usuario. Modificar nombre, email o empresa. Guardar. | Los cambios se persisten y se reflejan inmediatamente en la tabla. |
| A08 | Admin | Restablecer contraseña | Hacer clic en el ícono de llave de un usuario. Escribir una nueva contraseña. Confirmar. | La contraseña se actualiza sin necesidad de conocer la anterior. El usuario puede iniciar sesión con la nueva contraseña. |
| A09 | Admin | Cambiar rol | Hacer clic en el ícono de flechas de un usuario "user". | El rol cambia a "admin". El badge se actualiza a violeta. Si se cambia de admin a user, el badge cambia a gris. |
| A10 | Admin | Protección de superadmin | Intentar cambiar rol, desactivar o eliminar al usuario superadmin. | El sistema NO permite ninguna de estas acciones sobre el superadmin. Los botones están deshabilitados o no aparecen. |
| A11 | Admin | Desactivar usuario | Hacer clic en el ícono de encendido de un usuario activo. | El usuario pasa a estado "Inactivo" (badge rojo). Al intentar iniciar sesión con esa cuenta, se deniega el acceso con mensaje "Cuenta desactivada". |
| A12 | Admin | Reactivar usuario | Hacer clic en el ícono de encendido de un usuario inactivo. | El usuario pasa a estado "Activo" (badge verde). Puede iniciar sesión nuevamente. |
| A13 | Admin | Impersonar usuario | Hacer clic en el ícono de ojo de un usuario. | La sesión del admin cambia temporalmente a la del usuario seleccionado. El admin ve exactamente lo que ese usuario ve (sus campañas, plantillas, contactos, marca). Aparece un banner de impersonación en la parte superior. |
| A14 | Admin | Banner de impersonación | Mientras se impersona un usuario, verificar el banner superior. | Se muestra un banner con el nombre del usuario impersonado y un botón "Volver al Panel" para detener la impersonación. |
| A15 | Admin | Detener impersonación | Hacer clic en "Volver al Panel" en el banner de impersonación. | La sesión regresa al admin original. Se redirige al panel de administración. El banner desaparece. |
| A16 | Admin | Eliminar usuario | Hacer clic en el ícono de basura de un usuario. Confirmar la eliminación en el AlertDialog. | Se muestra AlertDialog de confirmación (NO window.confirm nativo). El usuario y TODOS sus datos se eliminan permanentemente: campañas, versiones, plantillas, contactos, bases de datos, identidad de marca. |
| A17 | Admin | Exportar CSV | Hacer clic en el botón de exportación. | Se descarga un archivo CSV con la lista completa de usuarios y sus estadísticas de uso. El archivo se abre correctamente en Excel. |

---

## 11. Navegación Global y Sidebar

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| N01 | Sidebar | Presencia de enlaces | Verificar que el sidebar muestre todos los enlaces de navegación. | Se muestran: Inicio, Identidad de Marca, Plantillas, Base de Datos, Calendario, Historial, Dashboard. Para admin/superadmin, también "Usuarios". |
| N02 | Sidebar | Navegación entre secciones | Hacer clic en cada enlace del sidebar secuencialmente. | Cada enlace redirige a su página correspondiente sin recargar la aplicación (SPA). La transición es fluida. |
| N03 | Sidebar | Indicador de página activa | Navegar a diferentes páginas y verificar el sidebar. | El enlace de la página actual está resaltado/destacado visualmente respecto a los demás. |
| N04 | Sidebar | Branding del sidebar | Verificar la parte superior del sidebar. | Muestra el logo "PostIAlo Mailing" con "IA" en color rojo (#e3001b). Fondo del sidebar en azul oscuro (#002073). |
| N05 | Sidebar | Botón de cerrar sesión | Hacer clic en el botón de cerrar sesión en el sidebar. | La sesión se cierra. Redirige a /login. No es posible navegar a rutas protegidas. |
| N06 | Sidebar | Sistema de onboarding (niveles) | Con un usuario nuevo sin configuración, verificar el sidebar. | Los enlaces de Plantillas, Base de Datos, Calendario, Historial y Dashboard aparecen bloqueados (con candado). Se desbloquean progresivamente: Marca -> Plantillas -> Contactos -> el resto. |
| N07 | Global | Redirección de onboarding | Con un usuario nuevo, intentar navegar directamente a /calendar escribiendo la URL. | El sistema redirige al usuario al paso previo que debe completar (ej: si no tiene marca, redirige a /brand). No permite saltar pasos. |
| N08 | Global | Fluidez de navegación | Navegar rápidamente entre todas las secciones haciendo clic en el sidebar. | No hay bloqueos de UI, no hay pantallas en blanco, no hay errores de carga. Todas las transiciones son suaves. |

---

## 12. Sistema de Tutorial Guiado

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| TU01 | Tutorial | Activar tutorial | Hacer clic en el botón de tutorial desde el sidebar. | El modo tutorial se activa. Los elementos de la página actual se resaltan con un borde luminoso y aparece un tooltip informativo. |
| TU02 | Tutorial | Navegación entre pasos | Con el tutorial activo, hacer clic en "Siguiente" repetidamente. | El highlight se mueve de un elemento al siguiente en orden lógico. Cada paso muestra una descripción diferente y relevante. |
| TU03 | Tutorial | Navegación hacia atrás | Hacer clic en "Anterior" durante el tutorial. | El highlight retrocede al elemento anterior con su descripción correspondiente. |
| TU04 | Tutorial | Tutorial por sección | Navegar a diferentes páginas con el tutorial activo. | El tutorial se adapta a la sección visible, mostrando los pasos relevantes para esa página (ej: en /brand muestra campos de marca, en /calendar muestra controles del calendario). |
| TU05 | Tutorial | Persistencia del tutorial | Con el tutorial activo, recargar la página (F5). | El tutorial mantiene su estado (activo/inactivo) y la posición actual del paso. No se reinicia al recargar. |
| TU06 | Tutorial | Desactivar tutorial | Hacer clic en "Saltar" o desactivar el tutorial. | Los highlights y tooltips desaparecen. La UI vuelve a su estado normal. |

---

## 13. Integración y Automatización (Make.com y Envío)

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| I01 | Envío | Envío completo de campaña | Crear una campaña con todos los campos, aprobar texto e imagen, asignar plantilla y base de datos. Hacer clic en "Publicar Ahora". | El correo se envía a Make.com vía webhook. El progreso de envío se actualiza en tiempo real. Al completarse, el status cambia a "Enviado" (si todos exitosos) o "Parcial" (si algunos fallaron). |
| I02 | Envío | Progreso en tiempo real | Durante un envío activo, observar la barra de progreso sin recargar la página. | Los contadores de enviados/fallidos se incrementan en tiempo real. La actualización es fluida. |
| I03 | Envío | Campaña programada auto-envío | Crear una campaña programada para 1-2 minutos en el futuro. Esperar. | El scheduler automático (cada 60s) detecta la campaña al pasar la hora programada y dispara el envío automáticamente. El status cambia de "scheduled" a "sending" y luego a "sent". |
| I04 | Envío | Botón CTA en email recibido | Tras un envío exitoso, abrir el correo en el buzón del destinatario (Gmail, Outlook, etc.). | El botón CTA muestra el texto correcto (no vacío), con fondo de color sólido visible, y al hacer clic redirige a la URL configurada. |
| I05 | Envío | Imagen en email recibido | Verificar la imagen del correo en el buzón del destinatario. | La imagen hero/banner se muestra correctamente dentro de la plantilla, sin enlaces rotos ni imágenes faltantes. |
| I06 | Envío | Contenido renderizado en email | Verificar el contenido completo del correo recibido. | El asunto coincide con lo configurado. El preheader se ve en la vista previa del buzón. El cuerpo del correo muestra el contenido HTML generado. La plantilla visual se ve correctamente. |
| I07 | Envío | Verificación de email en registro | Registrar un nuevo usuario y verificar que se reciba el correo de verificación. | El correo de verificación llega al buzón con el diseño de PostIAlo Mailing. El enlace de verificación apunta a /api/auth/verify/:token con el dominio correcto (desarrollo o producción según el entorno). |

---

## 14. Edge Cases y Validaciones de Seguridad

| ID | Área | Caso de Prueba | Detalle de Validación | Resultado Esperado |
|---|---|---|---|---|
| S01 | Seguridad | Acceso a ruta /admin sin sesión | Escribir directamente /admin/users en la barra del navegador sin estar logueado. | Redirige a /login. No expone datos de administración. |
| S02 | Seguridad | Rate limiting de IA | Hacer más de 10 solicitudes de generación de contenido en menos de 5 minutos. | Después de la solicitud 10, el sistema bloquea temporalmente con un mensaje de límite alcanzado. |
| S03 | Validación | Campaña sin plantilla | Intentar enviar una campaña que no tiene plantilla asignada. | El sistema muestra un error indicando que se requiere una plantilla. No permite el envío. |
| S04 | Validación | Campaña sin base de datos | Intentar enviar una campaña sin base de datos de contactos asignada. | El sistema muestra un error indicando que se requiere una base de datos. No permite el envío. |
| S05 | Validación | Campaña sin versiones | Intentar enviar una campaña que no tiene contenido generado (sin versiones). | El sistema muestra un error indicando que no hay versiones generadas. |
| S06 | Validación | Prompt de imagen mayor a 1,200 caracteres | Intentar escribir un prompt de imagen que exceda los 1,200 caracteres. | El sistema trunca o muestra validación de límite de caracteres. |
| S07 | Validación | Edición de campaña enviada | Intentar modificar los campos de contenido (idea, objetivo, tono) de una campaña con status "sent". | El sistema rechaza los cambios con un mensaje indicando que no se puede editar un correo ya enviado. |
| S08 | Validación | Base de datos vacía | Asignar una base de datos sin contactos a una campaña e intentar enviarla. | El sistema muestra un error indicando que la base de datos está vacía. No dispara el envío. |
| S09 | Seguridad | AlertDialog en eliminaciones | Intentar eliminar una plantilla, base de datos o usuario. | Todas las acciones destructivas muestran un AlertDialog de confirmación (componente de la app, NO window.confirm del navegador). |
| S10 | Seguridad | Token de verificación único | Reenviar el correo de verificación y luego intentar usar el enlace del primer correo. | El enlace anterior está invalidado (token rotado). Solo funciona el enlace más reciente. |
| S11 | Seguridad | Verificación-status no filtra usuarios | Hacer una petición GET a /api/auth/verification-status/email-inexistente@test.com. | Responde { verified: false } independientemente de si el email existe o no. No permite enumerar cuentas. |

---

## PRIORIDAD DE EJECUCIÓN

1. **CRÍTICA** — Series L (Login/Verificación), E (Editor), I (Integración) y K (Calendario): funcionalidad principal de la plataforma.
2. **ALTA** — Series A (Admin) y S (Seguridad): integridad y protección del sistema.
3. **MEDIA** — Series T (Plantillas), C (Contactos), D (Dashboard), M (Mis Correos): funcionalidad complementaria.
4. **BAJA** — Series H (Home), N (Navegación), TU (Tutorial): experiencia de usuario y guía.

---

## RESUMEN DE COBERTURA

**Total de casos de prueba: 152**

| Sección | Cantidad |
|---|---|
| 1. Registro, Verificación y Login | 16 |
| 2. Página de Inicio | 12 |
| 3. Identidad de Marca | 15 |
| 4. Gestión de Plantillas | 15 |
| 5. Gestión de Contactos | 15 |
| 6. Calendario y Creación | 14 |
| 7. Editor de Campaña | 32 |
| 8. Mis Correos | 12 |
| 9. Dashboard | 12 |
| 10. Panel de Administración | 17 |
| 11. Navegación y Sidebar | 8 |
| 12. Tutorial Guiado | 6 |
| 13. Integración y Envío | 7 |
| 14. Edge Cases y Seguridad | 11 |
