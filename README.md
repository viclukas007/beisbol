# Diamante

Aplicación local para consultar y administrar las estadísticas del torneo de sóftbol del Excel original. Frontend en React y TypeScript, backend en Node.js y PostgreSQL.

## Abrir

http://localhost:3080

Administración: http://localhost:3080/admin

## Arranque en Docker

Desde esta carpeta:

```powershell
docker compose up -d --build
docker compose ps
```

Si se clona el proyecto en otra computadora, copiar `.env.example` a `.env` y definir `POSTGRES_PASSWORD`, `ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH` antes de arrancar. Ejecutar `python create_admin_hash.py` para generar la línea del hash y copiarla a `.env`; la contraseña se introduce sin mostrarla. La configuración local ya está en `.env`, excluido de Git. El puerto se puede cambiar con `APP_PORT`.

## Despliegue en EasyPanel con PostgreSQL existente

1. En el mismo proyecto que PostgreSQL, crear un servicio **App**.
2. En **Source → GitHub**, usar `viclukas007/beisbol`, rama `main` y Build Path `/`.
3. En **Build**, elegir **Dockerfile**, ruta `Dockerfile`.
4. En PostgreSQL → **Credentials**, copiar la **URL interna** de conexión.
5. En **Environment** de la app, configurar:

```dotenv
DATABASE_URL=URL_INTERNA_COPIADA_DE_POSTGRESQL
ADMIN_EMAIL=victor@cuatromonos.mx
ADMIN_PASSWORD_HASH=HASH_SCRYPT_DE_LA_INSTALACION_LOCAL_O_GENERADO_CON_create_admin_hash.py
PORT=3080
SECURE_COOKIE=true
```

6. Configurar un dominio con HTTPS y puerto de destino **3080**. `SECURE_COOKIE=true` corresponde al acceso por HTTPS.
7. Desplegar la app. En el primer arranque crea las tablas, importa los datos y crea la cuenta inicial. Entrar en `https://TU_DOMINIO/admin`.

El valor local de `ADMIN_PASSWORD_HASH` está en `.env`; copiar únicamente esa configuración permite usar la contraseña inicial indicada para esta instalación. Si se genera otra huella, entrar con la contraseña utilizada al generarla. Los cambios posteriores de contraseña se conservan en la base.

Los MP4 se incluyen dentro de la imagen en `/app/public/ads`, por lo que el banner funciona al desplegar este servicio App. Las estadísticas y sesiones quedan en PostgreSQL. Las credenciales se configuran en EasyPanel y permanecen fuera del repositorio.

Referencias: [Servicio App](https://easypanel.io/docs/services/app) y [Servicio PostgreSQL](https://easypanel.io/docs/services/postgres).

## Detener la instalación local

```powershell
docker compose stop
```

La base se guarda en el volumen `postgres_data`. Reiniciar o reconstruir la app no reemplaza los datos guardados. PostgreSQL está en la red interna de Docker; el único puerto publicado es el de la web, accesible desde esta computadora.

## Pantallas

El menú público tiene cuatro secciones; la primera que se abre es la tabla de posiciones. Al abrir la página se muestra durante 5 segundos una pantalla de carga con una pelota de sóftbol en 3D (three.js, `src/Loader.tsx`), que respeta la preferencia de movimiento reducido; no vuelve a aparecer al cambiar de sección.

- **Tabla de posiciones** calculada a partir de partidos finalizados, ordenada con el reglamento de la liga (porcentaje de victorias y criterios de desempate a–d); se puede ver por temporada o por vuelta. Las columnas H y ERR (hits y errores por equipo), la columna Desempate y el texto de los criterios al pie de la tabla solo se muestran en administración; la tabla pública muestra Pos., Equipo, JJ, G, P, E, PCT, CF, CC y DIF. Si la liga fijó un orden manual desde administración, la tabla lo muestra con la nota “Orden definido por la liga”.
- **Estadísticas**: arriba el cuadro de honor con Top 5 de HITS, HR, RBI, AVG, K, ERA y W; abajo la tabla completa de bateo y pitcheo con búsqueda por nombre o equipo, filtro por equipo y jornada, ordenamiento, paginación y exportación CSV. La tabla muestra a todos los jugadores con nombre (en pitcheo, a quienes han lanzado); al ordenar por AVG o ERA, quienes no alcanzan el mínimo de participación (promedio de AB del torneo para bateo, promedio de IP de quienes han lanzado para pitcheo) se listan después de los que sí lo alcanzan, con el valor atenuado. Los espacios de plantilla sin nombre no se muestran.
- **Equipos**: los 16 equipos y sus plantillas.
- **Rol de juegos**: 240 juegos de Primera y Segunda Vuelta (jornadas 1–16 y 17–31), con filtros por vuelta, equipo y jornada, marcadores y hits/errores por equipo.
- **Reglamento del torneo** (solo en administración): observaciones de la liga, origen de AVG y ERA con sus mínimos, fuente del Excel y estado de la sincronización. El texto de los criterios de desempate (`src/Regulation.tsx`) solo se muestra en la tabla de posiciones de administración.
- Fichas individuales (al tocar un jugador) con acumulado y jornadas con actividad; cada jornada muestra el rival y el marcador tomados del rol de juegos de esa jornada para el equipo del jugador.
- Hits de cada jugador por partido: consulta y captura únicamente en administración.

## Backend de administración

En `/admin`:

- **Captura de estadísticas:** tabla editable de todos los jugadores activos, con búsqueda, filtro por equipo, jornadas 1–30 y corrección de acumulados. Escribir en las celdas y guardar por fila; cambiar entre Bateo y Pitcheo conserva el borrador. Campos JJ, AB, H, 1B, 2B, 3B, HR, RBI, IP, ER, BB, K, W y L; AVG y ERA se calculan. Se pueden mostrar todos los jugadores o páginas de 25, 50 o 100 registros.
- **Plantillas:** alta, edición, baja y restauración de jugadores de cada equipo. Selector de socio: sí, no o sin registrar. Los jugadores importados empiezan sin registrar esta condición porque no está en el Excel.
- **Rol de juegos:** agregar, editar, quitar y restaurar juegos; vuelta, jornada, fecha, hora, equipos, estado, marcador, hits y errores por equipo y observaciones. La vista pública permite consultar el calendario.
- **Historial:** responsable, fecha y valores antes/después de los movimientos.
- **Carga masiva:** jugadores y estadísticas en CSV/XLSX, plantillas con datos actuales, errores por fila, vista previa y aplicación conjunta.
- **Listas de jugadores:** plantilla activa por equipo, condición de socio y espacios de firma; descargar CSV o imprimir/guardar PDF.
- **Liga y reglamento:** cargar la imagen oficial, editar el nombre y las observaciones que se muestran en Reglamento del torneo.
- **Tabla de posiciones (orden manual):** la tabla de administración muestra flechas ↑/↓ en cada equipo. El primer movimiento fija el orden visible como orden manual de ese alcance (temporada, primera o segunda vuelta) y a partir de ahí la tabla pública lo respeta aunque lleguen nuevos resultados; el botón **Volver al orden automático** restablece el reglamento. Es un respaldo para cuando el criterio automático no aplique (por ejemplo, tras un volado). Cada cambio queda en el historial.
- **Hits por partido:** capturar los hits de cada jugador de un partido finalizado.

La captura por jornada aplica únicamente la diferencia contra la versión anterior al acumulado, conservando los ajustes históricos importados. Un guardado sin cambios no suma estadísticas de nuevo. La corrección directa del acumulado conserva los registros de jornadas. Las versiones evitan sobrescribir cambios de otra ventana.

Las bajas de jugadores conservan sus estadísticas y los retiran de las consultas públicas. Un alta crea acumulados y 30 jornadas en cero. Los juegos retirados pueden recuperarse desde “Juegos retirados”.

En la tabla de captura, los borradores se conservan al buscar, filtrar por equipo o cambiar de página. Las filas modificadas se resaltan y avisan si hay una versión más reciente. Cambiar de jornada o salir de la pantalla pide descartar los cambios pendientes; una fila se puede descartar para cargar sus cifras actuales. Los espacios sin nombre se muestran al activar “Espacios de plantilla”.

La actualización está disponible por captura manual y por carga masiva desde el navegador.

## Carga masiva de jugadores y estadísticas

1. En **Carga masiva**, seleccionar Jugadores o Estadísticas. Para estadísticas, elegir Jornadas o Acumulados.
2. Descargar la plantilla con datos actuales del equipo seleccionado. Para jornadas, elegir el número de jornada; la plantilla vacía contiene los encabezados para nuevas filas.
3. Editar en Excel y guardar como CSV UTF-8 o XLSX. Conservar `ID_JUGADOR` en las actualizaciones. Para dar de alta un jugador, dejar ese ID vacío e indicar nombre y equipo.
4. Seleccionar el archivo y **Generar vista previa**. Corregir los errores antes de continuar.
5. Revisar los registros y pulsar **Aplicar registros**. Se guardan todas las filas en una transacción; un conflicto de versiones impide aplicar el lote completo.

Los archivos admiten hasta 10 MB y 20,000 filas. La vista previa muestra hasta 100 registros y vence después de 60 minutos. El historial conserva las cargas aplicadas. Repetir la aplicación de la misma vista previa devuelve el resultado guardado, sin volver a sumar.

En jugadores, `SOCIO` acepta Sí, No o vacío; `ACTIVO` acepta Sí o No. Omitir filas no da de baja jugadores. Sin ID, equipo y nombre deben identificar un único jugador; las coincidencias ambiguas requieren ID.

En estadísticas se requieren los 14 conteos, incluido cero. AVG y ERA se calculan. La jornada reemplaza ese registro y aplica únicamente su diferencia al acumulado. El acumulado reemplaza el resumen sin cambiar las jornadas. Si modificas el desglose de hits, H debe ser igual a 1B + 2B + 3B + HR y no superar AB.

También se puede cargar `Estadisticas_Softbol_Torneo_Completo vfinal.xlsx`: se leen las hojas de cada equipo y se seleccionan sus resúmenes o jornadas según el tipo elegido. Las fórmulas deben tener resultados guardados por Excel; la app no ejecuta fórmulas. Los espacios vacíos de conteos del formato original se interpretan como cero, conservando el método de la importación inicial.

No mezclar en una misma carga acumulados y jornadas del mismo jugador. Si los ajustes históricos dejan un acumulado negativo al cambiar una jornada, corregir primero el acumulado histórico.

## Tabla de posiciones, imagen y listas

**Tabla de posiciones** usa únicamente juegos finalizados, con los dos marcadores, que no estén retirados. No utiliza W/L de los pitchers. Se puede ver la temporada completa o una vuelta.

El orden aplica el punto 4 del reglamento de la liga, implementado en `src/standings-rules.ts`:

1. Porcentaje de victorias: partidos ganados entre partidos jugados (los empates cuentan como jugados y se muestran en E).
2. Con el mismo porcentaje entre dos equipos: a) resultados frente a frente; b) diferencia de carreras en los partidos entre ambos; c) carreras anotadas en toda la temporada; d) volado con moneda.
3. Con tres o más equipos empatados: si uno tiene dominio toma el primer lugar del grupo y el resto se vuelve a desempatar desde a); si no hay dominio, se pasa a c).

Lectura aplicada de “dominio”: el equipo que enfrentó a todos los demás empatados y tiene el mejor porcentaje de victorias frente a ellos. Si dos equipos no se han enfrentado, se pasa a c). Los equipos que quedan empatados tras c) comparten posición y se marcan como volado pendiente; el resultado del volado se registra cuando la liga lo realice. La columna **Desempate** indica el inciso que decidió cada lugar. Con el filtro por vuelta, las carreras anotadas del inciso c) son las de esa vuelta. Los líderes individuales comparten posición por valores idénticos y el Top 5 incluye a quienes empaten con el quinto.

Los logos de los 16 equipos están en `public/teams/<id>.jpg` (320 × 320, cuadrados; el ID es el de la tabla `teams`: 1 Bucaneros, 2 Tigres, 3 Colegas, 4 NorthSide, 5 Renacidos, 6 Capitanes, 7 Lobos, 8 Titanes, 9 Tiburones, 10 Montejos, 11 Rookies, 12 Toloks, 13 Robins, 14 Cheleros, 15 Cebolleros, 16 Guayaberos). Se muestran en la tabla de posiciones, el rol de juegos, las tarjetas de Equipos y las fichas; si falta un archivo, se ven las iniciales con el color del equipo. Para cambiar un logo basta reemplazar el archivo (`src/teams.ts`).

El logo oficial de la liga (Liga de Sóftbol Club Campestre) está en `public/league-logo.png` (900 × 700 px, fondo transparente): encabeza el menú lateral y la pantalla de carga, y se usa mientras no se cargue otra imagen desde administración. Si el archivo no existiera, el menú mostraría la marca Diamante. Para reemplazarlo, en **Liga y reglamento** se admite PNG, JPG o WebP, recomendado 512 × 512 px y hasta 2 MB; la imagen cargada se almacena en PostgreSQL y se conserva al reconstruir Docker o desplegar EasyPanel.

En **Listas de jugadores**, seleccionar equipo y descargar CSV o usar Imprimir / guardar PDF. Se incluyen solo jugadores activos con nombre, condición de socio y espacios de firma y validación. El documento se presenta como lista para validación; la aprobación corresponde a la liga.

## Inicio de sesión

El backend `/admin` requiere inicio de sesión. El administrador de esta instalación es `victor@cuatromonos.mx`; la contraseña inicial es la indicada por el usuario y no se guarda en esta documentación.

Para cambiarla: **Mi cuenta → Cambiar contraseña**. Se pide la contraseña actual, la nueva y su confirmación. La nueva clave debe tener entre 8 y 128 caracteres. El cambio cierra las otras sesiones y conserva la sesión actual. Reiniciar Docker conserva la contraseña guardada en PostgreSQL.

Las claves se almacenan con scrypt y sal aleatoria. Las sesiones de 12 horas usan cookies HttpOnly y SameSite Strict; la base guarda una huella del token de sesión. Las escrituras, los datos de administración y la bitácora requieren sesión, y las escrituras llevan un token CSRF. La bitácora usa el correo del administrador como responsable. Hay límite de intentos de inicio de sesión.

`ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH` en `.env` se usan únicamente para crear la primera cuenta si la base todavía no tiene un administrador. No reemplazan una contraseña cambiada desde la app. Para otra instalación, definirlos junto con `POSTGRES_PASSWORD`. El hash tiene el formato `scrypt:salt_hex:hash_hex`, con N=32768, r=8, p=1, clave de 64 bytes y sal de 16 bytes codificada como texto hexadecimal.

## Marcadores de los juegos

En **Backend → Rol de juegos → Editar**, seleccionar **Finalizado** y capturar **Carreras del local** y **Carreras del visitante**. Se requieren ambas cifras, enteras de 0 a 9999. Opcionalmente se capturan los hits y errores de cada equipo, que corresponden a las columnas H y E de la hoja Captura de Resultados y alimentan las columnas H y ERR de la tabla de posiciones. Los resultados guardados se muestran en el calendario público y quedan en el historial. El marcador de equipos y las estadísticas individuales se capturan por separado.

Los marcadores de la hoja **Captura de Resultados** del Excel se importan al desplegar cada versión del archivo (ver más abajo). Un marcador vacío significa resultado sin registrar; un cero significa cero carreras. Los códigos de la columna A de esa hoja se interpretan así: `cap` finaliza el juego con su marcador; `ff` lo finaliza como forfeit y lo anota en las observaciones; `Susp Luz` lo deja como pospuesto con la nota “Suspendido por luz”. Un código distinto detiene la importación hasta que se agregue a `import_schedule.py`.

## Hits de cada jugador por partido

Esta pantalla es exclusiva de administración; la vista pública no la muestra porque los resultados ya aparecen en el rol. En **Hits por partido** o **Rol de juegos → Ver / capturar hits**, elegir un juego finalizado y capturar los hits del jugador. Cada fila se guarda por separado. Cero indica una captura sin hits; un campo vacío retira esa captura y conserva su historial. El equipo de la participación se conserva si posteriormente el jugador cambia de plantilla.

Los hits por partido complementan el detalle histórico del Excel. No se vuelven a sumar a los acumulados ni jornadas, porque el Excel no vincula cada jornada a un juego específico. Para actualizar los resúmenes y AVG, utilizar los conteos completos en Captura de estadísticas o Carga masiva. Los totales de hits del rol y la tabla son sumas de las capturas por partido y pueden estar incompletos mientras falten jugadores por capturar.

Retirar un juego lo oculta de las consultas públicas y conserva sus hits para restaurarlo. Para cambiar los equipos o reabrir un partido con hits, primero retirar las capturas de ese partido.

## Publicidad en MP4

El banner se integra debajo de los indicadores del resumen y arriba en Estadísticas, Equipos, Líderes y Rol de juegos. No flota ni cubre las tablas. Se reproduce automáticamente en bucle, sin audio ni controles de pausa. Al hacer clic abre https://agentesmonos.com/ en una pestaña nueva.

El anuncio de prueba de Agentes AI ya está instalado: 8 segundos, H.264, 30 fps, 196 KB para escritorio y 117 KB para celular. Sus composiciones HyperFrames están en `videos/agentes-ai-publicidad` y `videos/agentes-ai-publicidad-mobile`, con los recursos locales para volver a renderizarlas. Los MP4 usados por la app están incluidos en `public/ads`.

| Versión | Archivo en `public/ads` | Resolución del MP4 | Tamaño máximo mostrado |
| --- | --- | --- | --- |
| Escritorio | `banner-desktop.mp4` | **1920 × 320 px** (6:1) | 960 × 160 px |
| Celular | `banner-mobile.mp4` | **768 × 256 px** (3:1) | 384 × 128 px |

MP4 con H.264, preferentemente 24–30 fps, sin audio y de hasta 5 MB para facilitar la carga. Evitar destellos y mantener el texto dentro de un margen del 5%. El contenedor adapta el ancho conservando el video completo.

Copiar los MP4 a `public/ads` y recargar la página. La carpeta está montada en Docker: **no se necesita reconstruir ni reiniciar**. Si aún no hay un archivo, se conserva un espacio discreto para patrocinadores. Si solo se entrega una versión, se utiliza también en el otro tamaño sin recortar.

## Datos y tiempo real

Se importan 339 jugadores con nombre y 13 espacios `Jugador N`, además de 10,560 filas de jornadas. La versión del 29 de octubre de 2026 del libro de estadísticas tiene las jornadas 1–8 completas (972 JJ, 2,792 AB y 1,132 hits acumulados). La semilla completa está en `data/seed.json`; el informe está en `data/import-report.json`.

El servidor importa la semilla completa en una transacción cuando la base está vacía. Cuando la base ya existe y `data/seed.json` lleva una huella SHA-256 nueva, aplica esa versión del libro una sola vez (`server/stats-sync.ts`): identifica a cada jugador por su ID estable (equipo × 100 + fila de la plantilla), reemplaza acumulados y jornadas con los valores del Excel, da nombre a los espacios que la liga haya ocupado y crea los jugadores nuevos. Un nombre cambiado desde la app se conserva y se avisa en la consola; un jugador cambiado de equipo en la app no se toca. Las estadísticas acumuladas y las jornadas se guardan por separado para conservar los valores del archivo. El Excel no se modifica.

Un trigger en PostgreSQL emite `NOTIFY` al cambiar estadísticas. La API escucha y envía un evento SSE al navegador, que consulta los datos actuales. La conexión se restablece automáticamente, y hay una consulta adicional cada minuto y un botón de actualización manual.

Los datos históricos no se muestran como partidos en curso. Los cambios guardados desde `/admin` se reflejan en las consultas públicas.

El calendario y los resultados se importan de `ROL 2026-2027 LISTO V11.xlsx` (versión del 29 de octubre de 2026, con 49 marcadores capturados hasta la jornada 9): `Primera Vuelta` (120 juegos, jornadas 1–16, del 31 de agosto al 17 de diciembre de 2026), `Segunda Vuelta` (120 juegos, jornadas 17–31, del 11 de enero al 20 de mayo de 2027) y `Captura de Resultados` (marcadores, hits y errores por equipo, códigos `cap`, `ff` y `Susp Luz`). Cada juego conserva la celda de origen (`sourceCell`), que es la clave para actualizar la base sin duplicar juegos. La fecha del juego corresponde a la columna Fecha del Excel; la versión V11 ya no trae las notas con asterisco de la primera importación.

AVG es H / AB (`Bucaneros!K2`). El mínimo de AVG sale de `Top 5 Líderes!O3`, cuyo promedio es `Líderes y Maestra!D2:D353`: 1,412 AB / 352 plazas = 4.01136, equivalente a 5 AB enteros. La app aplica este promedio a los espacios activos actuales, incluidos los espacios sin nombre; las bajas dejan de contar. Al elegir jornada, usa los AB de esa jornada de toda la liga, antes de filtrar por equipo. El mínimo no es una opción del usuario, porque lo marca la propia estadística: decide quién compite por el liderato y el orden por AVG/ERA en la tabla, pero no oculta a nadie de la tabla ni de la plantilla de su equipo.

ERA es (ER × 7) / IP (`Bucaneros!P2`). El mínimo de IP no es fijo: es el promedio de entradas lanzadas entre los jugadores activos que han lanzado (IP > 0), porque no todos son pitchers; con el libro del 29 de octubre son 474.1 IP entre 46 jugadores = 10.31 IP. No se usa el valor fijo de 4 IP de `Top 5 Líderes!O5`. Se aplica al acumulado o jornada seleccionado, igual que el mínimo de AB. Las IP se conservan como valores numéricos del Excel; no se convierten automáticamente .1 o .2 en outs. Estas procedencias también se explican en **Reglamento del torneo**.

La cifra de Alejandro Millet difiere entre la hoja maestra y Bucaneros; se usa el resumen de Bucaneros. No se deduce una clasificación de equipos a partir de W/L individuales de pitchers.

## Desarrollo

```powershell
npm.cmd install
npm.cmd run dev
```

Vite abre el frontend en el puerto 5173 y redirige `/api` a la app de Docker en el 3080. El despliegue de Docker compila TypeScript y Vite y sirve el resultado estático desde Node.js.

## API

- `GET /api/health`: disponibilidad de PostgreSQL.
- `GET /api/snapshot`: equipos, jugadores, acumulados, jornadas y metadata en una lectura consistente.
- `GET /api/events`: avisos de cambio de estadísticas mediante SSE.
- `GET /api/ads`: videos de publicidad disponibles.
- `POST /api/players`: alta de jugador con acumulados y jornadas en cero.
- `PUT /api/players/:id`: nombre, equipo y condición de socio.
- `DELETE /api/players/:id` y `POST /api/players/:id/restore`: baja y restauración.
- `PUT /api/players/:id/stats`: corregir acumulado.
- `PUT /api/players/:id/rounds/:round`: guardar jornada y aplicar diferencia al acumulado.
- `POST /api/games` y `PUT /api/games/:id`: agregar y editar juego (`turn` 1 o 2, `round` 1–40, marcador, `homeHits`, `awayHits`, `homeErrors` y `awayErrors` opcionales en juegos finalizados).
- `DELETE /api/games/:id` y `POST /api/games/:id/restore`: quitar y restaurar.
- `GET /api/changes`: últimos 100 movimientos; filtros opcionales `entity` y `entityId`.
- `GET /api/admin/snapshot`: datos completos de administración, incluidos jugadores y juegos retirados; requiere sesión.
- `GET /api/auth/me`: cuenta y token CSRF de la sesión actual.
- `POST /api/auth/login`: iniciar sesión con correo y contraseña.
- `POST /api/auth/logout`: cerrar sesión.
- `PUT /api/auth/password`: cambiar contraseña actual por una nueva.
- `POST /api/admin/imports/preview`: leer CSV/XLSX y guardar una vista previa validada.
- `POST /api/admin/imports/:id/apply`: aplicar el lote revisado, con versiones y transacción.
- `GET /api/admin/imports`: historial de 30 cargas recientes.
- `GET /api/admin/templates/players.csv` y `/api/admin/templates/stats.csv`: plantillas con datos actuales; filtros `teamId`, `round` y `blank=1`.
- `GET /api/admin/roster.csv`: lista de jugadores activos para el equipo seleccionado.
- `PUT /api/admin/league/settings`: nombre de la liga y observaciones del reglamento.
- `PUT /api/admin/league/logo`: imagen oficial; `GET /api/league/logo` la sirve públicamente.
- `PUT /api/admin/league/standings-order`: orden manual de la tabla de posiciones (`scope` `all`, `1` o `2`; `order` con los 16 IDs de equipo o `null` para volver al automático; `version` de la liga).
- `PUT /api/games/:gameId/players/:playerId/hits`: capturar o retirar hits individuales, con `version` y `gameVersion`.

Los cambios usan JSON con `responsible` y, para registros existentes, `version`. En jugadores, enviar `rosterVersion` del snapshot como `version` al modificar la plantilla; la versión de estadísticas es independiente. Los conflictos devuelven HTTP 409.

## Regenerar la semilla desde el archivo

```powershell
python read_workbook.py "Estadisticas_Softbol_Torneo_Completo vfinal.xlsx"
python import_data.py
```

Esto regenera `data/seed.json` con la huella del archivo. Al desplegar, el servidor aplica la versión nueva sobre la base existente como se describe en **Datos y tiempo real**; también se puede cargar desde el navegador con **Carga masiva**. La gestión de nuevas temporadas permanece pendiente.

## Actualizar el rol y los resultados desde el Excel

Cuando llegue una versión nueva del rol (por ejemplo V12), copiarla a esta carpeta y regenerar `data/schedule.json`:

```powershell
python read_schedule.py "ROL 2026-2027 LISTO V12.xlsx"
python import_schedule.py
```

Requiere `openpyxl` y que el archivo tenga las pestañas `Equipos`, `Primera Vuelta`, `Segunda Vuelta` y `Captura de Resultados` con los valores calculados guardados por Excel. El JSON lleva la huella SHA-256 del archivo. Al arrancar, el servidor compara esa huella con las registradas en `schedule_imports`; si es nueva, aplica el archivo en una transacción (`server/schedule-sync.ts`) y la registra, así que basta con desplegar para actualizar la base local o la de EasyPanel:

- Los juegos se identifican por su celda de origen: los existentes se actualizan y los nuevos se insertan.
- Calendario (vuelta, jornada, fecha, hora, equipos y observaciones) manda siempre el Excel.
- Resultados: si la hoja tiene marcador o código, se aplica; si no tiene nada para ese juego, se conserva lo capturado en la app.
- Un juego con hits individuales capturados conserva equipos, estado y marcador aunque el Excel difiera; el arranque lo avisa en la bitácora de consola.
- Los juegos de esas pestañas que ya no aparecen en el Excel se retiran (recuperables en “Juegos retirados”); los juegos agregados a mano no se tocan.
- Cada cambio queda en el historial con el responsable `Importación <archivo>`.

Referencias del stack: [React](https://react.dev/versions), [Vite](https://vite.dev/guide/), [PostgreSQL NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html).
