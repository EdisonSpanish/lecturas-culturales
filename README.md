# Lecturas culturales — plantilla web (piloto)

Sitio estático, sin compilación ni dependencias (HTML + CSS + JS vanilla). Todas las rutas son relativas:
funciona en la raíz de un dominio o en una subruta (p. ej. `usuario.github.io/lecturas-culturales/`).

## Abrir en local
    cd /workspace/lecturas/web && python3 -m http.server 8765
    # http://localhost:8765/?l=lectura01   (una lectura)   ·   http://localhost:8765/  (catálogo)
No funciona con file:// (el navegador bloquea fetch del JSON).

## Lengua
Español latino neutro (ver /workspace/lecturas/criterios_lengua.md). Voz del navegador: es-US → es-MX → es-419 → otra es-* de América; nunca es-ES
(si solo hay es-ES, la página muestra «Ver la frase»). Reconocimiento de voz: es-US.

## Añadir una lectura
1. `lecturas/<carpeta>/<carpeta>.json` (mismo formato que lectura01) + imágenes.
2. `ejercicios.json` y `"ejercicios_archivo": "ejercicios.json"` en el JSON.
3. Entrada en `lecturas/indice.json`.
4. Audio: sin MP3; la lectura se escucha con la voz del navegador de cada alumno (es-US, es-MX…).

## Ejercicios (ejercicios.json, version 2)
Campos comunes: `id`, `tipo`, `titulo`, `consigna`, `habilidades` (Leer · Escuchar · Escribir · Hablar · Cultura),
`seccion: "mas_practica"` (opcional → bloque plegable, no cuenta en la barra de progreso).

| tipo | datos |
|---|---|
| opcion_multiple / situaciones | items[{pregunta | situacion+icono, opciones[], correcta, explicacion}] — corrección instantánea |
| verdadero_falso | items[{afirmacion, correcta, justificacion}] |
| clasificar | categorias[], items[{texto, categoria, explicacion}] |
| escuchar_elegir | items[{decir, pregunta, opciones[], correcta, explicacion}] — voz del navegador |
| escuchar_imagen | opciones[{imagen, respaldo, texto, alt}], items[{decir, correcta, explicacion}] |
| dictado | items[{decir, antes, despues, respuesta[], explicacion}] — tolera tildes/ñ |
| arrastrar | imagen, respaldo, alt, zonas[{palabra, x%, y%, explicacion}], distractores[{palabra, explicacion}] |
| hablar | requiere: "reconocimiento_voz", idioma, items[{contexto, frase}] — se oculta si no hay soporte |
| relacionar | pares[{izquierda, derecha, explicacion}] |
| ordenar | pasos[] (orden correcto), explicacion, pista |
| completar | banco[], items[{antes, respuesta[], despues, explicacion}] |
| reflexion | pregunta, ayuda[], minimo_caracteres, modelo, guia |

## Prueba automática
`pruebas/prueba.js` (puppeteer-core + Chrome; simula speechSynthesis y SpeechRecognition).
Servir `/workspace/lecturas` en el puerto 8765 y ejecutar `node prueba.js` (abre `/web/` como subruta).
