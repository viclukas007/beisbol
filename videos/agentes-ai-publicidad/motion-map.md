# Agentes AI — mapa de movimiento

Fuente: `shot-plan.json` final. Componente instalado: `line-swap`.

| Tiempo | Línea A | Línea B | Anclas |
| --- | --- | --- | --- |
| 0–3.6 s | Visible en y=0 | Oculta, y=14 / 8 px | Logo, soporte y CTA inmóviles |
| 3.6–4.0 s | Sube 14 / 8 px y desvanece | Entra desde abajo y aparece | Sin cambio |
| 4.0–7.2 s | Oculta | Visible en y=0 | Sin cambio |
| 7.2–7.6 s | Regresa desde abajo y aparece | Sube y desvanece | Sin cambio |
| 7.6–8.0 s | Estado inicial exacto | Estado inicial exacto | Sin cambio |

Todos los relevos duran 0.4 s con `power2.inOut`. Cada composición usa una única línea de tiempo GSAP pausada registrada con su id. Sin sonido, pulsos ni destellos. Archivos, fuentes y runtime locales.

Escritorio: `index.html`, 1920 × 320, 8 s, 30 fps.
Móvil: `compositions/mobile.html`, composición independiente, 768 × 256, 8 s, 30 fps. El móvil redistribuye el contenido.
