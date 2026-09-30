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

- Resumen con cifras acumuladas y líderes.
- Estadísticas de bateo y pitcheo, búsqueda por nombre o equipo, filtro por equipo y jornada, mínimos de participación, ordenamiento, paginación y exportación CSV.
- Los 16 equipos y sus plantillas.
- Cuadro de honor con Top 5 de HITS, HR, RBI, AVG, K, ERA y W.
- Fichas individuales con acumulado y jornadas con actividad.
- Datos del torneo con fuente, metodología y observaciones de importación.
- Rol de juegos en el menú izquierdo: 120 juegos de Primera Vuelta, con filtros por equipo y jornada.
- Tabla de posiciones calculada a partir de partidos finalizados: JJ, G, P, E, CF, CC, DIF, PCT y hits capturados por partido.
- Hits de cada jugador por partido, accesibles desde el rol y su ficha.

## Backend de administración

En `/admin`:

- **Captura de estadísticas:** tabla editable de todos los jugadores activos, con búsqueda, filtro por equipo, jornadas 1–30 y corrección de acumulados. Escribir en las celdas y guardar por fila; cambiar entre Bateo y Pitcheo conserva el borrador. Campos JJ, AB, H, 1B, 2B, 3B, HR, RBI, IP, ER, BB, K, W y L; AVG y ERA se calculan. Se pueden mostrar todos los jugadores o páginas de 25, 50 o 100 registros.
- **Plantillas:** alta, edición, baja y restauración de jugadores de cada equipo. Selector de socio: sí, no o sin registrar. Los jugadores importados empiezan sin registrar esta condición porque no está en el Excel.
- **Rol de juegos:** agregar, editar, quitar y restaurar juegos; fecha, hora, equipos, jornada, estado y observaciones. La vista pública permite consultar el calendario.
- **Historial:** responsable, fecha y valores antes/después de los movimientos.
- **Carga masiva:** jugadores y estadísticas en CSV/XLSX, plantillas con datos actuales, errores por fila, vista previa y aplicación conjunta.
- **Listas de jugadores:** plantilla activa por equipo, condición de socio y espacios de firma; descargar CSV o imprimir/guardar PDF.
- **Liga y reglamento:** cargar la imagen oficial, editar el nombre y configurar los criterios de clasificación de equipos.
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

**Tabla de posiciones** usa únicamente juegos finalizados, con los dos marcadores, que no estén retirados. No utiliza W/L de los pitchers. Los empates se cuentan en E y el PCT mostrado es G / (G + P), excluyendo empates.

El usuario confirmó que enviará los desempates. Hasta recibir y confirmar el reglamento, los equipos aparecen por nombre y sin posición oficial. En **Liga y reglamento** se puede ordenar por porcentaje, juegos ganados, diferencia de carreras, carreras a favor y menos carreras en contra. Los criterios se aplican en el orden indicado; los empates restantes comparten posición. Reglas de puntos, juego directo u otras fórmulas requieren incorporarse cuando se entregue el reglamento. Los líderes individuales comparten posición por valores idénticos y el Top 5 incluye a quienes empaten con el quinto.

El espacio para la imagen oficial está preparado en **Liga y reglamento**: PNG, JPG o WebP, recomendado 512 × 512 px y hasta 2 MB. La imagen se almacena en PostgreSQL y se conserva al reconstruir Docker o desplegar EasyPanel.

En **Listas de jugadores**, seleccionar equipo y descargar CSV o usar Imprimir / guardar PDF. Se incluyen solo jugadores activos con nombre, condición de socio y espacios de firma y validación. El documento se presenta como lista para validación; la aprobación corresponde a la liga.

## Inicio de sesión

El backend `/admin` requiere inicio de sesión. El administrador de esta instalación es `victor@cuatromonos.mx`; la contraseña inicial es la indicada por el usuario y no se guarda en esta documentación.

Para cambiarla: **Mi cuenta → Cambiar contraseña**. Se pide la contraseña actual, la nueva y su confirmación. La nueva clave debe tener entre 8 y 128 caracteres. El cambio cierra las otras sesiones y conserva la sesión actual. Reiniciar Docker conserva la contraseña guardada en PostgreSQL.

Las claves se almacenan con scrypt y sal aleatoria. Las sesiones de 12 horas usan cookies HttpOnly y SameSite Strict; la base guarda una huella del token de sesión. Las escrituras, los datos de administración y la bitácora requieren sesión, y las escrituras llevan un token CSRF. La bitácora usa el correo del administrador como responsable. Hay límite de intentos de inicio de sesión.

`ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH` en `.env` se usan únicamente para crear la primera cuenta si la base todavía no tiene un administrador. No reemplazan una contraseña cambiada desde la app. Para otra instalación, definirlos junto con `POSTGRES_PASSWORD`. El hash tiene el formato `scrypt:salt_hex:hash_hex`, con N=32768, r=8, p=1, clave de 64 bytes y sal de 16 bytes codificada como texto hexadecimal.

## Marcadores de los juegos

En **Backend → Rol de juegos → Editar**, seleccionar **Finalizado** y capturar **Carreras del local** y **Carreras del visitante**. Se requieren ambas cifras, enteras de 0 a 9999. Los resultados guardados se muestran en el calendario público y quedan en el historial. El marcador de equipos y las estadísticas individuales se capturan por separado.

Los juegos del Excel empiezan sin marcador porque el rol no incluye resultados. Un marcador vacío significa resultado sin registrar; un cero significa cero carreras.

## Hits de cada jugador por partido

En **Hits por partido** o **Rol de juegos → Ver / capturar hits**, elegir un juego finalizado y capturar los hits del jugador. Cada fila se guarda por separado. Cero indica una captura sin hits; un campo vacío retira esa captura y conserva su historial. El equipo de la participación se conserva si posteriormente el jugador cambia de plantilla.

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

Se importan 337 jugadores con nombre y 15 espacios `Jugador N`, además de 10,560 filas de jornadas. Hay actividad en las jornadas 1–4. La semilla completa está en `data/seed.json`; el informe está en `data/import-report.json`.

El servidor importa la semilla en una transacción únicamente cuando la base no tiene una importación inicial. Las estadísticas acumuladas y las jornadas se guardan por separado para conservar los valores del archivo. El Excel no se modifica.

Un trigger en PostgreSQL emite `NOTIFY` al cambiar estadísticas. La API escucha y envía un evento SSE al navegador, que consulta los datos actuales. La conexión se restablece automáticamente, y hay una consulta adicional cada minuto y un botón de actualización manual.

Los datos históricos no se muestran como partidos en curso. Los cambios guardados desde `/admin` se reflejan en las consultas públicas.

El calendario se importó exclusivamente de `ROL 2026-2027 LISTO.xlsx`, pestaña `Primera Vuelta`: 120 juegos y 16 jornadas. No se importó Segunda Vuelta. Las tres fechas adicionales con asterisco se conservaron como observaciones; la fecha del juego corresponde a la columna Fecha del Excel.

AVG es H / AB (`Bucaneros!K2`). El mínimo de AVG sale de `Top 5 Líderes!O3`, cuyo promedio es `Líderes y Maestra!D2:D353`: 1,412 AB / 352 plazas = 4.01136, equivalente a 5 AB enteros. La app aplica este promedio a los espacios activos actuales, incluidos los espacios sin nombre; las bajas dejan de contar. Al elegir jornada, usa los AB de esa jornada de toda la liga, antes de filtrar por equipo.

ERA es (ER × 7) / IP (`Bucaneros!P2`). El mínimo de 4 IP es el valor fijo de `Top 5 Líderes!O5`. Se aplica al acumulado o jornada seleccionado. Las IP se conservan como valores numéricos del Excel; no se convierten automáticamente .1 o .2 en outs. Estas procedencias también se explican en **Datos del torneo**.

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
- `POST /api/games` y `PUT /api/games/:id`: agregar y editar juego.
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
- `PUT /api/admin/league/settings`: nombre, reglamento y criterios de clasificación.
- `PUT /api/admin/league/logo`: imagen oficial; `GET /api/league/logo` la sirve públicamente.
- `PUT /api/games/:gameId/players/:playerId/hits`: capturar o retirar hits individuales, con `version` y `gameVersion`.

Los cambios usan JSON con `responsible` y, para registros existentes, `version`. En jugadores, enviar `rosterVersion` del snapshot como `version` al modificar la plantilla; la versión de estadísticas es independiente. Los conflictos devuelven HTTP 409.

## Regenerar la semilla desde el archivo

```powershell
python read_workbook.py
python import_data.py
```

Esto genera los archivos de importación; no reemplaza una base ya importada. La carga desde el navegador actualiza el torneo actual; la gestión de nuevas temporadas permanece pendiente.

Referencias del stack: [React](https://react.dev/versions), [Vite](https://vite.dev/guide/), [PostgreSQL NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html).
