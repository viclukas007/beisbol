---
workflow: motion-graphics
flow: automation
storyboard: no
message: "Agentes AI responde a tus clientes y organiza el seguimiento comercial."
destination: "Banner de patrocinador en la app Diamante, prueba local"
aspect: "6:1 escritorio y 3:1 móvil"
language: es-MX
audience: "Usuarios de la app del torneo que tienen un negocio"
length: 8s
category: kinetic-type
audio: none
---

## Intent

Solicitud: crear con HyperFrames un video del proyecto local agentes-ai-web para probar la publicidad en la app de béisbol. El MP4 y su instalación en el banner son el resultado solicitado y están autorizados en esta conversación. Después se desarrollará el backend de captura y la interfaz para mantener las estadísticas actualizadas.

## Source

Contenido: index.html y README.md del proyecto agentes-ai-web. Identidad: Agentes AI by Cuatro Monos. Azul noche #05070f, índigo #4f63ff, cian #22d3ee, verde #22c55e. Logo existente assets/img/logo-white.png. Tipografía del sitio: Plus Jakarta Sans; congelar un archivo local para el render.

## Outputs

- renders/banner-desktop.mp4: 1920 × 320, 30 fps, 8 segundos, H.264 y sin audio.
- renders/banner-mobile.mp4: 768 × 256, 30 fps, 8 segundos, H.264 y sin audio; recomponer la información para móvil, no recortar el video de escritorio.
- Colocar las versiones en Beisbol/public/ads con los nombres que espera el banner.

## Design

Un solo banner con logo estable, dos mensajes cortos que se relevan suavemente y una invitación a solicitar una demo. Mantener legibilidad al mostrarse a la mitad de la resolución. Motion sutil, sin destellos, sin grandes pulsaciones ni sonido. Arranque y final compatibles con repetición en bucle. Usar los mensajes y servicios reales del proyecto, sin cifras, precios o resultados inventados.

## Decisions

La duración de 8 segundos, el copy resumido y la composición tipográfica se eligen para esta prueba de banner. No se necesita una grabación del sitio ni fotografías: el material proporcionado ya identifica marca, mensaje y uso. Exportar directamente para probar el MP4 solicitado, después de checks y revisión de fotogramas.
