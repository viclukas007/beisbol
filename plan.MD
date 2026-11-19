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

## Captura en tabla de jugadores

Reemplazar el desplegable individual de Captura de estadísticas por una tabla de todos los jugadores activos, con filtros por equipo y nombre, paginación y columnas de bateo/pitcheo. Permitir editar las cifras en cada fila y guardar o descartar por jugador. Conservar borradores al filtrar o cambiar de página, advertir antes de cambiar de jornada y proteger las versiones ante actualizaciones en tiempo real. AVG y ERA se calculan en la tabla; las jornadas siguen aplicando diferencias al acumulado. Actualizar Docker local, documentación y publicar los cambios en el repositorio autorizado.

Implementado: tabla de 337 jugadores con nombre por defecto, opción para incluir espacios de plantilla, edición en celdas, guardado por fila y protección de borradores. Compilación TypeScript/Vite completada y presentación revisada en escritorio y celular sin escribir estadísticas reales.


## Rol V11, segunda vuelta y reglamento de desempate

Solicitud del 22 de octubre de 2026: actualizar los datos con `ROL 2026-2027 LISTO V11.xlsx` y aplicar los criterios de desempate del reglamento (punto 4).

- [x] Lectura del V11: `Primera Vuelta` sin cambios de fechas (solo desaparecen las notas con asterisco), `Segunda Vuelta` con 120 juegos (jornadas 17–31, del 11 de enero al 20 de mayo de 2027) y `Captura de Resultados` con 41 marcadores, 1 forfeit (`ff`) y 2 juegos suspendidos por luz (`Susp Luz`). Sin hits ni errores capturados todavía.
- [x] `read_schedule.py` e `import_schedule.py` reescritos con openpyxl: generan `data/schedule.json` con ambas vueltas, resultados y la huella SHA-256 del archivo. Los códigos desconocidos detienen la importación.
- [x] `server/schedule-sync.ts`: aplica cada versión del Excel una sola vez sobre la base existente, identificando juegos por celda de origen, con historial y sin pisar resultados capturados en la app cuando el Excel no los tiene.
- [x] Esquema: `turn` 1 o 2, jornadas hasta 40, columnas `home_hits`, `away_hits`, `home_errors` y `away_errors`.
- [x] Rol de juegos con filtro por vuelta, hits y errores por equipo en el marcador y en el formulario de edición.
- [x] Tabla de posiciones con el reglamento (`src/standings-rules.ts`): PCT = G / JJ; empates de dos equipos por incisos a–d; tres o más por dominio y, sin dominio, inciso c. Columna Desempate con el inciso aplicado; los volados pendientes comparten posición. Filtro por temporada o vuelta.
- [x] Liga y reglamento: se retiran los criterios configurables; quedan nombre, imagen y observaciones.
- [x] Verificación: la tabla calculada coincide con la hoja `Tabla de Posiciones` del V11 (JJ, JG, JP, CF, CC y DIF de los 16 equipos).

Interpretación registrada de “dominio” para grupos de tres o más: el equipo que enfrentó a todos los demás empatados y tiene el mejor porcentaje frente a ellos. Si la liga usa otra lectura, se ajusta en `src/standings-rules.ts`. El resultado del volado (inciso d) se captura cuando la liga lo realice.

## Libro de estadísticas del 22 de octubre de 2026

- [x] `Estadisticas_Softbol_Torneo_Completo vfinal.xlsx` actualizado por la liga: mismas 352 plazas y mismo orden, jornadas 1–8 con actividad, 2,548 AB y 1,029 hits acumulados; dos espacios ocupados (Fernando Canto en Tigres y Manuel Rodríguez en Cebolleros).
- [x] `read_workbook.py` acepta la ruta del archivo; `data/seed.json` regenerado con la huella nueva.
- [x] `server/stats-sync.ts`: aplica cada versión del libro una sola vez sobre la base existente por ID estable, con historial; conserva nombres editados en la app y avisa.
- [x] El snapshot toma la última importación registrada como fuente de las estadísticas.

## Libro de estadísticas del 29 de octubre de 2026

- [x] `Estadisticas_Softbol_Torneo_Completo vfinal.xlsx` con las 8 jornadas completas: 86 jugadores cambian en la jornada 8; acumulados de 893 → 972 JJ, 2,548 → 2,792 AB, 1,029 → 1,132 hits, 76 → 83 HR, 703 → 776 RBI. Mínimo de AVG: 7.93 → 8 AB. Sin plazas nuevas; en Robins la plaza de Jorge Caballero Córdova aparece ahora como Maximiliano Ríos (mismo ID estable, conserva el historial de esa plaza).
- [x] `data/seed.json` regenerado con la huella nueva; la versión anterior del libro se conserva localmente como `Estadisticas_Softbol_Torneo_Completo vfinal (2026-10-22).xlsx` (fuera del repositorio).
- [x] `ROL 2026-2027 LISTO V11.xlsx` del 29 de octubre: mismo calendario (240 juegos, sin cambios de fechas ni equipos) y 8 marcadores nuevos en `Captura de Resultados`: los 4 de la jornada 8 (21 y 22 de octubre, con código `cap`) y los 4 de la jornada 9 (26 y 27 de octubre, con marcador y sin código). Pasa de 41 a 49 juegos finalizados; siguen 1 forfeit y 2 suspendidos por luz. `data/schedule.json` regenerado; la versión anterior se conserva como `ROL 2026-2027 LISTO V11 (2026-10-22).xlsx`.

## Ajustes de la vista pública del 29 de octubre de 2026

- [x] Resumen sin la tarjeta de Jugadores; quedan hits, home runs y carreras impulsadas.
- [x] Se retiran los checkboxes “Mínimo de N AB” y “Espacios de plantilla”. Primero la tabla ocultaba a quien no alcanzaba el mínimo; al entrar a un equipo solo salían 9 de sus jugadores, así que ahora la tabla muestra a todos y el mínimo solo decide el orden por AVG/ERA (los que no lo alcanzan van después, con el valor atenuado) y quién compite en los líderes.
- [x] La columna Desempate de la tabla de posiciones es información reservada: solo se muestra en administración. El bloque “4. Criterios de desempate” se retira por completo de la vista pública (tabla de posiciones y Reglamento del torneo); queda únicamente en la tabla de posiciones de administración. Reglamento del torneo conserva las observaciones de la liga, el origen de AVG/ERA y la fuente.
- [x] Las columnas H y ERR (hits y errores por equipo de la hoja de resultados) se retiran de la tabla de posiciones pública; quedan en administración.
- [x] Mínimo de ERA dinámico: promedio de IP entre los jugadores que han lanzado (IP > 0), en lugar del valor fijo de 4 IP de `Top 5 Líderes!O5`, porque no todos los jugadores son pitchers. Se aplica en tablas, líderes y textos explicativos; el servidor y `import_data.py` lo calculan con la misma regla. El mínimo de AVG se confirma como promedio de AB de todas las plazas activas, redondeado hacia arriba.
- [x] Orden manual de la tabla de posiciones en administración: columna `standings_order` (JSONB por alcance) en `league_settings`, endpoint `PUT /api/admin/league/standings-order` con versión y bitácora, flechas ↑/↓ por equipo y botón para volver al orden automático (`src/Standings.tsx`, `applyManualOrder` en `src/standings-rules.ts`). La tabla pública respeta el orden manual y lo indica como “Orden definido por la liga”. Probado el rechazo sin sesión; el flujo con sesión de administrador queda por probar en el navegador.
- [x] Tabla de posiciones: nombre del equipo en 14 px, alineado a la izquierda y sin la barra de color que reservaba espacio para logos.
- [x] Logos de los 16 equipos (4 de noviembre de 2026, `Logos liga.zip`): se cuadraron a 320 × 320 rellenando con el color del borde y se guardaron como `public/teams/<id>.jpg` (302 KB en total). Identificación por imagen: LR = Renacidos, la iguana = Toloks (tolok en maya), el monograma verde estilo Expos = Montejos y GB = Guayaberos; los demás llevan el nombre. Se muestran en tabla de posiciones, rol, tarjetas de Equipos y fichas (`src/teams.ts`).
- [x] Reglamento del torneo se oculta del menú público (y su botón de ayuda al pie del menú); el menú público queda en Tabla de posiciones, Estadísticas, Equipos y Rol de juegos. La sección sigue en administración.
- [x] Hits por partido deja de aparecer en el menú público y en la ficha pública del jugador; sigue en administración.
- [x] Ficha del jugador: columna Rival junto a cada jornada, con el marcador si el juego está finalizado. Se empareja la jornada de estadísticas con la jornada del rol del equipo actual del jugador; si hay cero o más de un juego, se muestra “—” o “Varios”.
- [x] Logo oficial (Liga de Sóftbol Club Campestre) en `public/league-logo.png` como imagen predeterminada; la cargada desde administración lo reemplaza. Se recibió como JPG de 1280 × 996 con fondo blanco; se convirtió a PNG de 900 × 700 con el fondo exterior transparente (el blanco de la pelota se conserva).
- [x] Menú público simplificado a cinco secciones: Tabla de posiciones (inicio), Estadísticas (líderes Top 5 + tabla completa), Equipos, Rol de juegos y Reglamento del torneo. Desaparecen Resumen, Líderes y Datos del torneo como pantallas separadas; el reglamento (`src/Regulation.tsx`) se comparte con el pie de la tabla de posiciones.
- [x] Pantalla de carga con three.js (`src/Loader.tsx`): pelota de sóftbol con costura girando sobre el diamante. Solo al abrir la página, durante 5 segundos como mínimo, para que se vea la animación. El bundle pasa de 332 KB a 815 KB (224 KB gzip) por la librería.
- [x] Al cambiar de sección se vuelve al inicio de la página.
- [x] La marca “diamante” del menú lateral se reemplaza por el logo oficial de la liga (también en la pantalla de carga). El nombre de la liga, equipos y temporada siguen al pie del menú.

## Exportar la base de datos (19 de noviembre de 2026)

Solicitud: agregar en administración la exportación de la base de datos.

- [x] Página **Exportar base de datos** en `/admin` (`src/ExportData.tsx`), con dos descargas.
- [x] Respaldo completo en SQL (`GET /api/admin/export/database.sql`, `server/export.ts`): esquema y datos de las 10 tablas del torneo en una lectura consistente, restaurable con `psql` sobre una base vacía o en uso. Sin `pg_dump`, para no depender de la versión de PostgreSQL del servidor. Quedan fuera cuentas de administración, sesiones, límites de inicio de sesión y vistas previas de cargas.
- [x] Libro de Excel (`GET /api/admin/export/database.xlsx`): Equipos, Jugadores, Acumulados, Jornadas, Rol de juegos, Hits por partido e Historial.
- [x] Cada descarga se registra en `audit_log` (`database` / `export`) con el correo de la sesión.
- [x] Verificación en Docker local: sin sesión responde 401; el respaldo se restauró dos veces en una base de prueba (vacía y con datos) y las 10 tablas quedaron idénticas a la original (conteo y huella MD5 por tabla), con los contadores de ID en su valor. La pantalla se probó en Chrome con las dos descargas. La base de prueba, la sesión temporal y los registros de exportación de la prueba se eliminaron.
- [ ] Restauración desde la app (subir un respaldo): no solicitada; por ahora se restaura con `psql`, como describe el README.

### Corrección de seguridad encontrada en la revisión previa al push (19 de noviembre de 2026)

- [x] La protección de la API comparaba las rutas de administración una por una, distinguiendo mayúsculas, mientras Express las atiende sin distinguirlas ni exigir la diagonal final. Sin iniciar sesión, `/api/Changes` o `/api/changes/` devolvían el historial y `/api/Admin/roster.csv`, `/api/Admin/templates/*.csv` y `/api/Admin/imports` sus datos. Existía desde que se agregó el inicio de sesión; las escrituras no estaban afectadas (método y token CSRF).
- [x] `server/auth.ts` ahora exige sesión en toda la API salvo una lista de consultas públicas (`/health`, `/snapshot`, `/events`, `/ads`, `/league/logo`). Probado en Docker local: 15 variantes sin sesión responden 401, las públicas y el inicio de sesión siguen funcionando, y la administración con sesión (consultas, descargas y cierre de sesión con CSRF) funciona igual.
