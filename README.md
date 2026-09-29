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

## Detener

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

## Backend de administración

En `/admin`:

- **Captura de estadísticas:** equipo, jugador, jornadas 1–30 y corrección de acumulados. Campos JJ, AB, H, 1B, 2B, 3B, HR, RBI, IP, ER, BB, K, W y L; AVG y ERA se calculan al guardar.
- **Plantillas:** alta, edición, baja y restauración de jugadores de cada equipo. Selector de socio: sí, no o sin registrar. Los jugadores importados empiezan sin registrar esta condición porque no está en el Excel.
- **Rol de juegos:** agregar, editar, quitar y restaurar juegos; fecha, hora, equipos, jornada, estado y observaciones. La vista pública permite consultar el calendario.
- **Historial:** responsable, fecha y valores antes/después de los movimientos.

La captura por jornada aplica únicamente la diferencia contra la versión anterior al acumulado, conservando los ajustes históricos importados. Un guardado sin cambios no suma estadísticas de nuevo. La corrección directa del acumulado conserva los registros de jornadas. Las versiones evitan sobrescribir cambios de otra ventana.

Las bajas de jugadores conservan sus estadísticas y los retiran de las consultas públicas. Un alta crea acumulados y 30 jornadas en cero. Los juegos retirados pueden recuperarse desde “Juegos retirados”.

Actualmente la actualización es por captura manual. La carga de un Excel actualizado desde el navegador aún no está implementada.

## Inicio de sesión

El backend `/admin` requiere inicio de sesión. El administrador de esta instalación es `victor@cuatromonos.mx`; la contraseña inicial es la indicada por el usuario y no se guarda en esta documentación.

Para cambiarla: **Mi cuenta → Cambiar contraseña**. Se pide la contraseña actual, la nueva y su confirmación. La nueva clave debe tener entre 8 y 128 caracteres. El cambio cierra las otras sesiones y conserva la sesión actual. Reiniciar Docker conserva la contraseña guardada en PostgreSQL.

Las claves se almacenan con scrypt y sal aleatoria. Las sesiones de 12 horas usan cookies HttpOnly y SameSite Strict; la base guarda una huella del token de sesión. Las escrituras, los datos de administración y la bitácora requieren sesión, y las escrituras llevan un token CSRF. La bitácora usa el correo del administrador como responsable. Hay límite de intentos de inicio de sesión.

`ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH` en `.env` se usan únicamente para crear la primera cuenta si la base todavía no tiene un administrador. No reemplazan una contraseña cambiada desde la app. Para otra instalación, definirlos junto con `POSTGRES_PASSWORD`. El hash tiene el formato `scrypt:salt_hex:hash_hex`, con N=32768, r=8, p=1, clave de 64 bytes y sal de 16 bytes codificada como texto hexadecimal.

## Marcadores de los juegos

En **Backend → Rol de juegos → Editar**, seleccionar **Finalizado** y capturar **Carreras del local** y **Carreras del visitante**. Se requieren ambas cifras, enteras de 0 a 9999. Los resultados guardados se muestran en el calendario público y quedan en el historial. El marcador de equipos y las estadísticas individuales se capturan por separado.

Los juegos del Excel empiezan sin marcador porque el rol no incluye resultados. Un marcador vacío significa resultado sin registrar; un cero significa cero carreras.

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

El ERA usa 7 entradas según las fórmulas del archivo. El líder de AVG requiere al menos el promedio de AB de todas las plazas de plantilla: inicialmente 4.0113, equivalente a 5 AB enteros. ERA requiere 4 IP. Los valores de IP se conservan tal como aparecen en el Excel.

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

Los cambios usan JSON con `responsible` y, para registros existentes, `version`. En jugadores, enviar `rosterVersion` del snapshot como `version` al modificar la plantilla; la versión de estadísticas es independiente. Los conflictos devuelven HTTP 409.

## Regenerar la semilla desde el archivo

```powershell
python read_workbook.py
python import_data.py
```

Esto genera los archivos de importación; no reemplaza una base ya importada. La actualización de temporadas con vista previa queda para la siguiente fase.

Referencias del stack: [React](https://react.dev/versions), [Vite](https://vite.dev/guide/), [PostgreSQL NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html).
