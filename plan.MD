# Plan de la aplicación de béisbol

Fecha: 29 de septiembre de 2026.

## Objetivo

Construir primero una interfaz web en español para consultar a las personas y las estadísticas del archivo `Estadisticas_Softbol_Torneo_Completo vfinal.xlsx`, y dejarla ejecutándose en Docker con PostgreSQL y actualización automática de datos.

## Fuente y decisiones sobre los datos

- El archivo contiene 18 hojas: Top 5 Líderes, Líderes y Maestra y 16 equipos.
- Equipos: Bucaneros, Tigres, Colegas, NorthSide, Renacidos, Capitanes, Lobos, Titanes, Tiburones, Montejos, Rookies, Toloks, Robins, Cheleros, Cebolleros y Guayaberos.
- Existen 352 registros de plantilla (22 por equipo). Los nombres `Jugador N` son espacios de plantilla; se conservarán identificados y se ocultarán en la consulta normal.
- Cada equipo tiene un resumen acumulado y bloques de 30 jornadas. Importar ambos por separado: el acumulado guardado en el Excel es la referencia inicial; no sustituirlo con sumas de jornadas que podrían diferir.
- Campos: JJ, AB, HITS, 1B, 2B, 3B, HR, RBI, AVG, IP, ER, BB, K, ERA, W y L.
- Conservar los nombres originales y normalizar Unicode y espacios para búsquedas.
- El archivo corresponde a sóftbol. Su ERA usa `(ER × 7) / IP`; mantener este criterio. Confirmar el cambio a 9 entradas antes de adoptar reglas de béisbol.
- Conservar los valores guardados y la procedencia de cada fila. Las fórmulas del Excel no se ejecutarán en el navegador.
- Las IP se conservan como aparecen en el archivo. Antes de la captura de juegos debe definirse si representan entradas decimales o notación de outs (.1 y .2).
- AVG requiere el mínimo de AB que define la hoja Top 5: promedio de AB de los 352 registros. ERA requiere al menos 4 IP. Los empates se mostrarán con el mismo valor, sin inventar desempates deportivos.
- No hay calendario, enfrentamientos, resultados de equipos, fechas, posiciones defensivas ni logos en la fuente. No inventar partidos en vivo, clasificación de equipos ni fotografías de personas.

## Stack elegido

| Parte | Tecnología | Motivo |
| --- | --- | --- |
| Lenguaje | TypeScript | Tipos compartidos entre interfaz y API |
| Frontend | React 19, Vite, CSS propio, Lucide | Interfaz rápida, componentes reutilizables y diseño adaptable |
| Servidor | Node.js 24, Express | API pequeña y conexión persistente de eventos |
| Base de datos | PostgreSQL 17, driver pg | Datos persistentes y consultas consistentes |
| Tiempo real | Server-Sent Events y PostgreSQL LISTEN/NOTIFY | Actualizar consultas cuando cambian estadísticas, con reconexión automática |
| Infraestructura | Docker Compose | App y base de datos reproducibles con volumen persistente |

Referencias oficiales: https://react.dev/versions , https://vite.dev/guide/ , https://www.postgresql.org/docs/17/sql-notify.html . Las versiones exactas de paquetes quedan registradas en package-lock.json al instalar.

## Diseño del frontend

- Identidad deportiva sobria: azul marino, verde de campo, fondos claros, números tabulares y elementos inspirados en el diamante.
- Navegación: Resumen, Estadísticas, Equipos, Líderes y Datos del torneo.
- Resumen: indicadores calculados, líderes destacados, comparación de ofensiva por equipo y tabla de bateo.
- Estadísticas: bateo/pitcheo, búsqueda sin distinción de acentos, filtro por equipo y jornada, ordenamiento y exportación CSV del resultado filtrado.
- Equipos: las 16 plantillas con sus totales y acceso a jugadores.
- Líderes: Top 5 en HITS, HR, RBI, AVG, K, ERA y W, aplicando mínimos de participación.
- Ficha de jugador: cifras acumuladas y desglose de jornadas registradas.
- Estados de carga, error, conexión/reconexión y resultados vacíos; mostrar la procedencia del Excel y última sincronización.
- Adaptación a celular, navegación accesible, controles con etiquetas y tablas con desplazamiento horizontal.

## Modelo inicial de PostgreSQL

- `import_sources`: nombre de archivo, huella SHA-256, fecha de importación y metadata.
- `teams`: ID, nombre y color visual asignado.
- `players`: ID estable por equipo y fila de la plantilla, nombre, espacio de plantilla y referencia original.
- `player_stats`: acumulado por jugador, campos originales y fecha de modificación.
- `round_stats`: jugador, jornada (1–30), campos originales y referencia de fila.
- Trigger de cambios en estadísticas → NOTIFY → API SSE → consulta del estado actual desde el frontend.
- Importación transaccional e idempotente. No borrar datos existentes al reiniciar Docker; actualizar una importación nueva requiere un paso explícito posterior.

## Secuencia de trabajo

1. Leer y documentar el Excel. Crear este plan antes de programar la app.
2. Extraer los datos a una semilla JSON y un reporte de importación; conservar intacto el Excel.
3. Implementar primero pantallas, componentes, filtros, tablas y fichas con los datos de la semilla.
4. Añadir el soporte mínimo de lectura: esquema PostgreSQL, importación inicial, API y SSE. La captura y administración quedan para la siguiente fase.
5. Crear Dockerfile y docker-compose.yml, construir la app y levantar los dos servicios.
6. Confirmar el arranque y documentar URL, comandos y datos importados. Registrar el estado final en este plan.

## Publicidad solicitada durante esta fase

- Banner integrado, debajo de los indicadores del resumen y después de los datos en otras vistas.
- MP4 de escritorio: 1920 × 320 px (6:1), visualización máxima 960 × 160 px.
- MP4 de celular: 768 × 256 px (3:1), visualización máxima 384 × 128 px.
- Archivos `public/ads/banner-desktop.mp4` y `public/ads/banner-mobile.mp4`, con carpeta montada en Docker para reemplazarlos sin recompilar.
- Reproducción silenciosa y continua en bucle, sin controles de pausa, por instrucción del usuario. Clic abre https://agentesmonos.com/. Banner arriba en Estadísticas, Equipos, Líderes y Rol de juegos.

## Alcance posterior

- Captura y edición de estadísticas por jornada con validaciones deportivas y auditoría.
- Autenticación y roles administrador, anotador y visitante.
- Calendario, enfrentamientos y marcador por entradas cuando existan datos reales.
- Definir outs/IP, reglas de clasificación y temporada antes de recalcular resultados históricos.
- Importación de nuevos Excel con vista previa de diferencias y confirmación.

## Entrega de esta fase

Frontend funcional en `http://localhost:3080`, conectado a PostgreSQL dentro de Docker. La conexión en tiempo real refleja cambios guardados en la base; los resultados históricos del Excel no se presentarán como partidos en curso.

## Estado

- [x] Excel leído y plan creado antes del código de la app.
- [x] Datos normalizados e informe de importación: 337 jugadores, 15 espacios y 10,560 registros de jornadas.
- [x] Frontend implementado: resumen, estadísticas, equipos, líderes, fichas y fuente del torneo.
- [x] PostgreSQL, API de lectura y SSE conectados.
- [x] Docker levantado y documentación de uso. App disponible en http://localhost:3080.
- [x] Banner para MP4 incorporado con variantes de escritorio y celular. Videos de Agentes AI instalados.

La compilación TypeScript/Vite terminó correctamente. PostgreSQL y la app arrancaron con healthchecks saludables; la API devolvió los 16 equipos y 352 registros de plantilla. Se revisó la presentación de escritorio y celular mediante capturas del navegador.

## Fase 2 solicitada: captura, backend y rol de juegos

Orden solicitado: finalizar el banner HyperFrames de Agentes AI, después implementar backend de escritura y pantalla de captura, y agregar el rol de juegos editable.

- [x] Banner de prueba: Agentes AI, 8 segundos sin audio, escritorio 1920 × 320 y móvil 768 × 256. Instalar en public/ads.
- [x] Backend para editar estadísticas acumuladas y por jornada en PostgreSQL.
- [x] Pantalla de captura por equipo, jugador y jornada con validación de números y vista previa de AVG/ERA.
- [x] Actualización del acumulado por diferencia entre la jornada nueva y la anterior, conservando ajustes históricos del Excel. Repetir un guardado no debe duplicar cifras.
- [x] Guardado transaccional, control de versiones para evitar sobrescrituras y bitácora de antes/después.
- [x] Rol importado exclusivamente de `ROL 2026-2027 LISTO.xlsx`, pestaña `Primera Vuelta`: 120 partidos, 16 jornadas, del 31 de agosto al 17 de diciembre de 2026.
- [x] Preservar las tres notas de fechas adicionales del rol como observaciones, sin interpretarlas automáticamente como cambios de fecha.
- [x] Agregar, editar y quitar partidos desde la app, con baja recuperable y registro de cambios.
- [x] Filtrar el calendario por equipo y jornada. La segunda vuelta permanece sin importar y sin confirmar.
- [x] Reconstruir y levantar Docker con los nuevos endpoints y pantallas.

El uso actual es local en localhost. El administrador ya inicia sesión y puede cambiar su contraseña desde Mi cuenta. La gestión de múltiples usuarios y roles queda para una fase posterior.

## Ampliaciones entregadas

- [x] Rol de juegos visible en el menú izquierdo público.
- [x] Administración independiente en /admin, con captura, plantillas y edición del rol.
- [x] Altas, bajas y restauración de jugadores, conservando estadísticas.
- [x] Selector de socio por jugador: sí, no o sin registrar.
- [x] Banner continuo sin pausa, con enlace a https://agentesmonos.com/.

Estado de despliegue: compilación TypeScript/Vite completada y contenedores saludables. La API devolvió 120 juegos de Primera Vuelta y 352 registros iniciales de plantilla. Se revisaron las pantallas de calendario, captura y plantillas; no se realizaron pruebas de escritura sobre las estadísticas reales.

La carga de Excel actualizado desde el navegador se incorpora en la Fase 3. No se ha confirmado ni importado Segunda Vuelta.

## Inicio de sesión y marcadores

- [x] Cuenta inicial del administrador con el correo y la contraseña indicados por el usuario.
- [x] Contraseñas con scrypt y sal; sesiones de 12 horas con cookie HttpOnly, control CSRF y límite de intentos.
- [x] Escrituras, historial y snapshot de administración protegidos en el backend.
- [x] Mi cuenta: cambiar contraseña actual, nueva y confirmación; cerrar las otras sesiones al guardar.
- [x] Marcadores de local y visitante desde la edición del rol en el backend, al seleccionar Finalizado.
- [x] Resultados visibles en el rol público; los juegos sin resultado permanecen sin marcador.
- [x] Compilación y despliegue Docker actualizados. No se cambiaron resultados reales para hacer pruebas.

## Repositorio solicitado

Publicación del proyecto en https://github.com/viclukas007/beisbol, rama main. Se incluyen código, semillas normalizadas, MP4 y composiciones HyperFrames; .env, archivos de sesión y Excel originales quedan excluidos del repositorio.

## Adaptación para EasyPanel

El usuario creó un servicio PostgreSQL en EasyPanel. El despliegue usa un servicio App del mismo proyecto, construido con el Dockerfile del repositorio; DATABASE_URL toma la URL interna del servicio PostgreSQL. ADMIN_EMAIL y ADMIN_PASSWORD_HASH crean la cuenta inicial y PORT=3080 configura el destino del dominio. SECURE_COOKIE=true se usa con HTTPS.

- [x] Incluir public/ads en la imagen final para servir los videos sin depender del montaje local.
- [x] Documentar pasos y variables de EasyPanel en README.md.
- [ ] Configurar y desplegar los servicios en el panel del usuario; todavía no se tiene acceso al panel ni su configuración.

## Fase 3: reglas, listas e importación masiva

Solicitud del 30 de septiembre de 2026:

1. Explicar fórmula de AVG, denominador y mínimo de clasificación, con procedencia del Excel.
2. Explicar fórmula de ERA, entradas de referencia y mínimo IP; mantener el cálculo de sóftbol sobre 7 entradas.
3. Registrar hits por jugador y partido, según la confirmación del usuario.
4. Aplicar los criterios de desempate del reglamento de la liga. Mientras no se confirmen, conservar las posiciones empatadas y mostrar ese estado.
5. Tabla de posiciones en pantalla, confirmada por el usuario.
6. Imagen oficial de la liga: recibir el archivo o permitir cargarlo desde la administración.
7. Generar listas por equipo con jugadores activos, condición de socio y espacio de validación de la liga; descargar e imprimir.
8. Carga masiva de jugadores en CSV/XLSX con plantillas, vista previa, validación, control de versiones y aplicación transaccional.
9. Carga masiva de estadísticas por jornada o acumulado, y lectura del formato original de hojas por equipo. Guardar por diferencia para no duplicar estadísticas. Validar y mostrar errores antes de aplicar.

Las importaciones no darán de baja jugadores ni borrarán estadísticas por omisión de filas. Se usarán IDs estables para actualizar registros existentes; sin ID, se identificarán jugadores por equipo y nombre y se rechazarán las coincidencias ambiguas. No se deducirán datos de socio ni marcadores de campos inexistentes.

### Estado de la Fase 3

- [x] Explicación visible de AVG y ERA, con celdas de origen y cálculo de los mínimos.
- [x] Captura de hits por jugador y partido; consulta en el rol y en la ficha individual, con historial y versiones.
- [x] Tabla de posiciones derivada de marcadores finalizados; actualiza al editar, retirar o restaurar juegos.
- [x] Configuración de orden y criterios de desempate; sin orden oficial mientras no se confirme el reglamento.
- [ ] Aplicar el reglamento oficial que el usuario enviará; todavía no se recibió.
- [x] Espacio para cargar la imagen de la liga desde administración; almacenamiento en PostgreSQL.
- [x] Listas por equipo para imprimir/guardar PDF y descargar CSV, preparadas para firma y validación.
- [x] Carga masiva de jugadores CSV/XLSX, plantillas, vista previa y validación.
- [x] Carga masiva de estadísticas acumuladas o jornadas, lectura del formato original y actualización por diferencia.
- [x] Compilación TypeScript/Vite y actualización del Docker local. Ambos contenedores saludables; 352 jugadores y 120 juegos conservados. No se modificaron estadísticas ni marcadores reales para hacer pruebas.

El usuario solicitó dejar el espacio preparado para la imagen y enviará los desempates. Los hits por partido se registran como detalle complementario: no se suman automáticamente a los resúmenes del Excel para evitar duplicarlos sin datos completos de bateo.

