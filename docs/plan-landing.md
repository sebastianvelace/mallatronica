# Plan: landing de Mallatrónica

**Estado:** planeado para implementar el 3 de noviembre de 2026.
**Objetivo:** una página de entrada bonita que explique qué hace la app y cómo funciona. Sus botones llevan a la aplicación, que debe sentirse como una app instalada y no como una página web. Sin registro ni login.
**Referencia estética:** [integrascale.online](https://www.integrascale.online/). Capturas analizadas el 3 de noviembre.

---

## 1. Qué tomamos de la referencia

| Rasgo de la referencia | Cómo lo adaptamos |
|---|---|
| **Titulares en Space Grotesk 700**, enormes (84 px en el hero, 48 px en secciones) y con tracking negativo (≈ −2.5 %) | Igual. Titular corto que termina en punto, por ejemplo: *"Tu carrera, planeada."* |
| **Texto en Inter**, gris medio (#888) y con mucho aire | Igual. Cuerpo de 16–18 px e interlineado de 1.6. |
| **Eyebrow** en mayúsculas pequeñas: 11 px, letter-spacing de 0.3 em, gris | "INGENIERÍA ELECTRÓNICA · UNAL", "CÓMO FUNCIONA", "DATOS DEL SIA" |
| **Secciones que alternan blanco y negro** (#fff, #0b0b0b y gris #f4f4f4) | Igual. Da ritmo sin usar colores de marca. |
| **Fondo del hero con una "constelación"** de puntos y líneas finas | **La red real de prerrequisitos del plan 2545.** Cada punto es una materia y cada línea un prerrequisito, dibujados en un canvas con movimiento lento. Es el motivo visual propio de la app. |
| **Tarjetas numeradas 01–04**, con el número grande en gris tenue y bordes de 1 px | Problemas que resuelve, en la sección negra, y pasos de uso, en la blanca. |
| **Botón primario negro con radio de 12 px y "→"**, y un enlace secundario de texto | "Abrir la app →" y "Ver cómo funciona". |
| **Marquesina de logos** de integraciones | Marquesina con los nombres de las asignaturas reales del plan, en "pills". |
| **Pestañas por sector** con tarjetas | Pestañas por función (Malla, Planear, Notas, Horario, Libre elección), cada una con su captura o mockup. |
| **Precios** | Se reemplaza por *"Gratis. Sin registro. Tus datos son tuyos."* con tres pilares. |
| **CTA final en negro** con checklist y "¿Qué pasa después?" 01–03 | CTA final con los tres pasos para empezar y botón a la app. Sin formulario. |
| **Footer** sobrio con logo, enlaces y © | Footer con GitHub, ADR o fuentes, la nota "No oficial" y la licencia. |

**Mantenemos la sobriedad:** la referencia es casi monocroma. Usaremos un solo acento, el verde de la marca de la app, solo en estados ("aprobada", el punto del indicador "en vivo").

---

## 2. Estructura de la landing (en orden)

1. **Header fijo** (transparente sobre el hero, con fondo al hacer scroll): logo `mallatrónica` y los enlaces *Cómo funciona · Funciones · Datos · Preguntas*. Botón "Abrir la app →".
2. **Hero:**
   - Eyebrow: INGENIERÍA ELECTRÓNICA · UNAL BOGOTÁ.
   - H1: *"Tu carrera, planeada."* Alternativa: *"Toda tu malla. Un solo lugar."*
   - Subtítulo: "Marca lo que aprobaste, mira qué puedes inscribir y arma tu horario con los grupos reales del SIA."
   - CTA "Abrir la app →" y enlace "Ver cómo funciona".
   - **Indicador en vivo:** "● Oferta del SIA actualizada hoy, 6:17 a. m. · 62 asignaturas · 630 grupos", leído de `/api/sia/status`. Si falla, se oculta.
   - Fondo: la constelación de prerrequisitos.
3. **Problema (negro):** *"¿Cuánto tiempo se te va en esto?"* Cuatro tarjetas:
   - 01 "Revisar a mano qué prerrequisitos ya cumples".
   - 02 "Saltar entre el SIA, PDFs y hojas de cálculo".
   - 03 "Armar horarios que se cruzan".
   - 04 "Calcular cuántos créditos y qué PAPA te faltan".

   Cierre: *"Eso no es estudiar. Es fricción. Y tiene solución."*
4. **Cómo funciona (blanco):** tres pasos con flechas.
   - 01 "Marca tu avance" (el onboarding pregunta en qué semestre vas y precarga).
   - 02 "Planea el semestre" (te sugiere qué inscribir según créditos y prerrequisitos).
   - 03 "Arma tu horario" (con grupos, cupos y salones reales).
5. **Marquesina** de asignaturas del plan, en dos filas que se mueven en sentidos opuestos. Se pausa con `prefers-reduced-motion`.
6. **Funciones (gris claro):** *"Todo lo que necesitas para tu carrera."* Pestañas Malla / Planear / Notas / Horario / Libre elección. Cada pestaña muestra:
   - Una captura real de la app, en tema claro y oscuro según el sistema, dentro de un marco tipo dispositivo.
   - Tres viñetas.
   - Un enlace "Probar →" que abre la app directo en esa vista (`/app#horario`).
7. **Datos del SIA (negro):** *"Datos reales. Actualizados solos."* Explica sin jerga que cada día la app consulta el buscador público del SIA, valida y publica la oferta, y que si falla se mantiene la última buena. Muestra las cifras en vivo. Enlace a la explicación técnica (ADR-002).
8. **Gratis y privado (blanco):** *"Gratis. Sin registro. Tus datos son tuyos."* Tres pilares:
   - **Sin cuentas:** abre y usa.
   - **En tu navegador:** el avance se guarda en tu dispositivo; lo exportas e importas cuando quieras.
   - **Código abierto:** en GitHub; cualquiera puede revisar y contribuir.
9. **Preguntas frecuentes** (acordeón con `<details>`):
   - ¿Es oficial de la UNAL? (No.)
   - ¿Qué pasa si cambio de computador? (Exportar e importar.)
   - ¿Qué tan actualizados están los cupos? (Diario; confirma en el SIA.)
   - ¿Sirve para mi plan? (Por ahora 2545 en Bogotá.)
   - ¿Puedo instalarla en el celular? (Sí, como app.)
10. **CTA final (negro):** *"¿Listo para planear tu semestre?"* Lista: "Sin registro", "Funciona sin conexión", "Se instala como app". Pasos 01–03 y botón grande "Abrir la app →".
11. **Footer.**

---

## 3. Arquitectura: landing y app separadas

**Decisión: dos páginas de Vite** (multi-page), sin framework nuevo.

| Ruta | Archivo | Contenido |
|---|---|---|
| `/` | `index.html` → `src/landing/main.ts` y `src/landing/landing.css` | Landing estática y liviana. No carga el código de la app. |
| `/app` | `app.html` → `src/main.ts` (la app actual, sin cambios de lógica) | La aplicación |

- **`vite.config.ts`** (nuevo): `build.rollupOptions.input = { landing: 'index.html', app: 'app.html' }`.
- **`vercel.json`:** `"cleanUrls": true` para que `/app` sirva `app.html`. Si no basta, se agrega un rewrite `{ "source": "/app", "destination": "/app.html" }`. Las funciones `/api/*` y el cron no cambian.
- **Sensación de app:**
  - `manifest.webmanifest` con `start_url: "/app"`: quien la instala abre directo en la app, sin pasar por la landing.
  - `display: "standalone"` (ya está). `theme-color` y `background-color` por página.
  - **Transición suave** de la landing a la app con *View Transitions* entre documentos (`@view-transition { navigation: auto; }`), con fundido y el logo como elemento compartido. Los navegadores sin soporte navegan normal.
  - `<link rel="prefetch" href="/app">` y `modulepreload` del bundle de la app al pasar el cursor o el dedo por el CTA, para que la app abra al instante.
  - En la app: header compacto, sin enlaces de "marketing"; el logo vuelve a `/`.
- **Usuarios que regresan:** si `localStorage` ya tiene `mallatronica-state-v2`, el CTA del hero cambia a **"Continuar donde ibas →"** y aparece una línea pequeña: "Tienes tu avance guardado en este navegador". No hay redirección automática, así se respeta a quien quiera ver la landing.
- **Enlaces profundos:** `/app#horario`, `/app#plan`, etc. abren la vista correspondiente. Implica un cambio pequeño en `navigate()` y en la lectura inicial del hash.
- **Service worker** (`public/sw.js`):
  - Agregar `/app` al shell cacheado y subir `CACHE` a `mallatronica-v2`.
  - El fallback de navegación offline usa la página pedida y, si no existe, `/app`.
  - La landing también queda disponible offline.
- **Onboarding:** se mantiene en la app. La landing explica el "qué"; el onboarding sigue pidiendo semestre y nivelaciones. Revisar si el primer paso de bienvenida sobra y quitarlo.

---

## 4. Sistema visual

- **Tipografías:** Space Grotesk (500/700) para titulares y números; Inter (400/500/600) para el texto.
  - Se **autoalojan** con `@fontsource/space-grotesk` y `@fontsource/inter`, con subconjunto latín, sin Google Fonts. Así no hay rastreo de terceros y funciona offline.
  - Licencia OFL: se agrega a `THIRD_PARTY_NOTICES.md`.
  - `font-display: swap` y preload de las dos variantes del hero.
- **Tokens de la landing:**
  - `--ink: #0a0a0a`, `--paper: #ffffff`, `--paper-2: #f4f4f4`, `--night: #0b0b0b`, `--night-card: #141414`.
  - `--line: rgba(0,0,0,.08)`, `--line-night: rgba(255,255,255,.08)`, `--muted: #888`, `--accent:` el verde actual de la app.
- **Escala tipográfica fluida:** `clamp()`. H1 de 44 → 88 px, H2 de 32 → 48 px, eyebrow de 11 px con tracking de 0.3 em.
- **Contenedor y espaciado:** contenedor de 1040 px; secciones con `padding-block: clamp(80px, 12vw, 160px)`; reglas horizontales de 1 px bajo cada H2, como en la referencia.
- **Componentes:** `btn-primary`, `btn-ghost`, `eyebrow`, `num-card`, `step`, `pill`, `tabs`, `device-frame`, `faq`, `live-dot`.
- **Movimiento:**
  - Revelado suave al hacer scroll (`IntersectionObserver`, 12 px de desplazamiento y opacidad).
  - Constelación a 30 fps con pausa cuando no está visible.
  - Todo se desactiva con `prefers-reduced-motion`.
- **Modo oscuro:** la landing ya alterna blanco y negro por diseño. No se invierte con el tema del sistema, igual que la referencia. Sí respeta `color-scheme` en el scroll y los formularios.

---

## 5. Contenido y capturas

- **Capturas reales de la app:** se generan con un script de Playwright (`scripts/landing/screenshots.cjs`).
  - Carga `/app` con un estado de ejemplo: semestre 5, algunas aprobadas y un horario armado.
  - Exporta cada vista en claro y oscuro, en escritorio y móvil.
  - Formato `.webp` en `public/landing/`.
  - Se regeneran cuando cambie la UI.
- **La constelación:** se construye en tiempo de build desde `data/sia/plan2545.json` (materias y prerrequisitos reales). Es un JSON pequeño de nodos y aristas; la posición sale de un layout de fuerzas simple precalculado, para no hacer cálculos en el navegador.
- **Copy:** en segunda persona y con frases cortas. Nunca decir que es oficial. Todas las cifras salen de datos reales (en vivo o del snapshot incluido); nada inventado.

---

## 6. Calidad

- **Rendimiento:** la landing pesa menos de 60 KB de JS+CSS comprimido sin contar fuentes e imágenes. Imágenes `loading="lazy"` con `width`/`height`. Meta: Lighthouse ≥ 95 en Performance, Accessibility, Best Practices y SEO, en móvil.
- **Accesibilidad:**
  - Contraste AA (ojo con el gris #888 sobre blanco: usar #6b6b6b para texto de párrafo).
  - Foco visible y pestañas con roles ARIA (`tablist`/`tab`/`tabpanel`) y flechas del teclado.
  - Canvas con `aria-hidden` y "Saltar al contenido".
- **SEO y redes:** `title`, `description`, Open Graph y Twitter card con una imagen 1200×630 generada con el mismo script. `lang="es"`. `robots` permitido en `/` y `noindex` en vistas internas, si aplica.
- **Responsive:** probar en 390 px, 768 px y 1440 px. En móvil, las pestañas se vuelven scroll horizontal y la marquesina queda en una fila.
- **Pruebas:**
  - Pruebas unitarias para el armado de la constelación y para el CTA "Continuar" según `localStorage`.
  - Prueba de build: `dist/index.html` y `dist/app.html` existen.
  - Prueba Playwright de humo: desde `/`, el clic en el CTA abre `/app` y renderiza la malla, y `/app#horario` abre el horario.
  - Capturas de comparación a 390 y 1440 px.

---

## 7. Orden de trabajo para mañana (un PR)

1. **Andamiaje multi-page** (`vite.config.ts`, `app.html`, `cleanUrls`), con la app actual movida a `/app` y funcionando igual. Verificar en preview. *~30 min*
2. **Enlaces profundos por hash**, SW v2 y manifest `start_url: /app`. *~30 min*
3. **Tokens, fuentes autoalojadas y componentes base** de la landing. *~45 min*
4. **Secciones 1–4** (header, hero con indicador en vivo, problema, cómo funciona). *~1 h*
5. **Constelación** (datos en build y canvas). *~45 min*
6. **Secciones 5–11** (marquesina, funciones con pestañas, datos del SIA, gratis y privado, preguntas, CTA y footer). *~1 h 30*
7. **Script de capturas y Open Graph.** *~30 min*
8. **Transición landing→app, prefetch y CTA "Continuar".** *~20 min*
9. **Pruebas, Lighthouse y revisión móvil.** Ajustes finales. *~45 min*
10. **PR** con capturas antes/después; fusión cuando lo apruebes.

---

## 8. Decisiones abiertas (con valor por defecto)

- **Titular del hero:** "Tu carrera, planeada." Alternativas: "Toda tu malla. Un solo lugar." o "Planea tu carrera sin fricción."
- **Logo:** se mantiene el wordmark `mallatrónica` en Space Grotesk. Más adelante se puede diseñar un isotipo, por ejemplo un nodo de la constelación.
- **Idioma:** solo español por ahora; la referencia tiene ES/EN, pero no hace falta todavía.
- **Dominio:** sigue `mallatronica.vercel.app`. Un dominio propio sería un paso aparte.
