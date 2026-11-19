# Lecturas culturales — plantilla web (piloto)

Sitio estático, sin compilación ni dependencias (HTML + CSS + JS vanilla). Todas las rutas son relativas:
funciona en la raíz de un dominio o en una subruta (p. ej. `usuario.github.io/lecturas-culturales/`).

## Abrir en local
    cd /workspace/lecturas/web && python3 -m http.server 8765
    # http://localhost:8765/?l=lectura01   (una lectura)   ·   http://localhost:8765/  (catálogo)
No funciona con file:// (el navegador bloquea fetch del JSON).

## Lengua
Español latino neutro (ver /workspace/lecturas/criterios_lengua.md). Voz del navegador: es-US → es-MX → es-419 → otra es-* de América;
es-ES solo como último recurso, con nota; sin ninguna voz en español, los ejercicios muestran «Ver la frase». Reconocimiento de voz: es-US.

## Añadir una lectura
1. `lecturas/<carpeta>/<carpeta>.json` (mismo formato que lectura01) + imágenes.
2. `ejercicios.json` y `"ejercicios_archivo": "ejercicios.json"` en el JSON.
3. Entrada en `lecturas/indice.json` (`carpeta`, `titulo`, `nivel`, `etiqueta`, `pais`, `miniatura` webp + `respaldo` png).
   El catálogo (index.html sin `?l=`) agrupa las lecturas por nivel A1 → B2.
4. Audio: sin MP3; la lectura se escucha con la voz del navegador de cada alumno (es-US, es-MX…).
5. Gráfico (opcional): `"grafico": {archivo, webp, titulo, nota, datos[], columnas{}, alt, ancho, alto, icono}`.
   El bloque solo aparece si hay `archivo` o `datos`; `null`/`{}` lo ocultan. Ícono del título: 📊 por defecto,
   `"icono": "🕒"` lo cambia y `"icono": ""` lo quita.

## Ejercicios (ejercicios.json, version 2)
Campos comunes: `id`, `tipo`, `titulo`, `consigna`, `habilidades` (Leer · Escuchar · Escribir · Hablar · Cultura),
`seccion: "mas_practica"` (opcional → bloque plegable, no cuenta en la barra de progreso).
Bloque de ejercicios: título «Ahora, practica» y barra de progreso («n de N · completado»); sin estrellas, puntos ni dado
(los juegos son solo en clase con Edison). Flujo principal de 7 bloques (A1–A2) u 8 (B1–B2: «Dilo tú», Hablar es-US,
antes de la primera producción escrita); en A1–A2 «Dilo tú» va en «Más práctica». Sin reconocimiento de voz, el bloque
Hablar no se muestra ni cuenta en el progreso.
Ítem de respuesta libre en `hablar` (último ítem de «Dilo tú» en 10–12): `{"libre": true, "pregunta", "modelo", "minimo_palabras": 3}`.
Se muestra «Responde con tus palabras»; cualquier respuesta hablada de 3 palabras o más vale, y entonces aparece el modelo (con ▶ Escuchar).

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
`pruebas/prueba.js` (lectura01 en detalle) y `pruebas/prueba_todas.js` (catálogo + todas las lecturas, escritorio y móvil;
resuelve cada ejercicio con las respuestas del JSON). puppeteer-core + Chrome; simulan speechSynthesis y SpeechRecognition.
Servir `/workspace/lecturas` en el puerto 8765 y ejecutar `node prueba.js` / `node prueba_todas.js [lectura02 …]`
desde `/workspace/lecturas/_test` (abre `/web/` como subruta).
Lengua y citas: `python3 /workspace/lecturas/_test/revisar_lengua_todas.py [lectura02 …]` (citas «…» al pie de la letra,
frases «decir» del texto, estructura del flujo principal y marcas peninsulares).
Ejercicios 02–11: se generan con `/workspace/lecturas/_build_ejercicios/{a1,a2,b1,b2}.py`.
