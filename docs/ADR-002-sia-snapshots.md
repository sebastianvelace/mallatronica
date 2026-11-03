# ADR-002: Datos del SIA mediante snapshots del buscador público

**Estado:** Aceptado

**Fecha:** 2026-11-02
**Decisión:** Obtener materias, prerrequisitos y oferta del periodo directamente del buscador público de cursos del SIA con un script programado, guardar el resultado en el repositorio y proponerlo como pull request. La aplicación consume esos archivos estáticos.

## Contexto

El SIA es la fuente de verdad académica. ADR-001 dejó pendiente una fuente pública y permitida para la oferta por periodo y un `CatalogProvider` con caché.

Análisis técnico (2 de noviembre de 2026):

- El SIA anterior exponía un servicio que usaban herramientas comunitarias (por ejemplo, `gioacostax/sia-api`, archivado en 2020). Ya no está disponible.
- El SIA actual es una aplicación **Oracle ADF Faces** (JSF) sobre WebLogic, detrás de CloudFront. No publica una API documentada. Cada filtro es un *partial postback* que depende de la cookie de sesión, el `javax.faces.ViewState` y el `Adf-Window-Id`. Las respuestas envían `X-Frame-Options: sameorigin` y no habilitan CORS.
- El **Buscador de cursos** es público y no exige autenticación. Para un plan entrega materias, créditos, tipología, estado "sin programar" y, en el detalle, actividades, grupos, profesor, sesiones, salón, fechas, cupos disponibles y prerrequisitos con sus condiciones.
- **Mis planes** e **Historia académica** exigen autenticación institucional. Allí están las agrupaciones de optativas y el avance individual.

## Decisión

**Actualizada el 3 de noviembre de 2026:** la actualización no depende de ningún computador personal ni institucional.

1. **Cliente y parser.** `src/sia/` (TypeScript, sin DOM) reproduce por HTTP los mismos eventos ADF que envía un navegador en el buscador público:
   - `client.ts` maneja la cookie de sesión, el `ViewState` y la cascada nivel → sede → facultad → plan → tipología;
   - `parse.ts` lee resultados, grupos, sesiones, cupos y prerrequisitos;
   - `job.ts` divide el trabajo en pasos reanudables.

   Se identifica con un User-Agent propio y espera 1,2 s entre peticiones (unas 280 por plan). Busca una tipología a la vez, porque la tabla de resultados solo activa sus primeras 25 filas en el servidor, y abre cada detalle por código.
2. **Vercel Cron diario** (`/api/sia/cron`, protegido con `CRON_SECRET`). Inicia un trabajo; cada paso trabaja hasta 240 s (el máximo de Hobby es 300 s) y le pasa su progreso al siguiente en el cuerpo de un POST, sin usar almacenamiento intermedio. Cada invocación responde 202 de inmediato y trabaja en segundo plano con `waitUntil`. En producción el encadenamiento usa el dominio público (`VERCEL_PROJECT_PRODUCTION_URL`), porque las URL propias de cada despliegue piden autenticación de Vercel. Si no se puede encadenar, el error queda en `status.json` y en los logs (`[sia]`). Un plan completo toma unos 2 pasos; hay topes de 20 pasos y 4 errores. Una prueba del 3 de noviembre de 2026 confirmó que el SIA responde a las funciones de Vercel (IPs de AWS en `iad1`), incluso en postbacks sucesivos de la misma sesión.
3. **Vercel Blob.**
   - Solo dos archivos con nombre fijo, sobrescritos al final de cada corrida: `offer.json` (el snapshot publicado) y `status.json` (resultado de la corrida). Son unas 2 operaciones avanzadas al día (~60 al mes, frente a 2.000 incluidas en Hobby); el almacén es privado y la función se autentica con el token OIDC del proyecto y `BLOB_STORE_ID` (sin secreto que rotar); las lecturas pasan por los endpoints y quedan cacheadas en el borde.
   - Si se superara el límite de Hobby, Vercel no cobra pero bloquea Blob 30 días; la app seguiría con la copia incluida.
   - Producción y previews usan prefijos distintos.
   - Solo un snapshot completo que pase `validateSnapshot` (materias mínimas, ≥90 % con detalle, sesiones y cupos bien formados) reemplaza al publicado. Si no pasa, sigue el último válido.
4. **Endpoints.** `/api/sia/offer` sirve el último snapshot publicado, cacheado en el borde. `/api/sia/status` muestra el resultado de la última corrida: si publicó, sus problemas y su progreso.
5. **App.** Al abrirse lee `/api/sia/offer` y valida su forma. Si falla (desarrollo local, sin publicación todavía, red caída), usa la copia incluida en el build. La interfaz indica cuál fuente usa, su fecha y avisa si tiene más de 14 días.
6. **Copia incluida y plan.** `npm run sia:snapshot` corre el mismo trabajo de una vez y regenera la copia incluida y `data/sia/plan2545.json`. Las materias, créditos y prerrequisitos cambian rara vez y siguen pasando por pull request, con `tests/sia.test.cjs` exigiendo coherencia con el snapshot.

La carga sobre el SIA no crece con el número de estudiantes: una actualización diaria de unas 280 peticiones sirve a todos los usuarios.

## Opciones descartadas

- **Consultar el SIA desde el navegador del estudiante:** lo impiden CORS, `X-Frame-Options` y el estado de sesión de ADF.
- **Proxy en vivo por cada visita:** sería lento (decenas de segundos por consulta) y frágil, y multiplicaría la carga sobre el SIA.
- **Automatizar el login o usar credenciales de estudiantes:** se mantiene descartado por ADR-001.

## Límites conocidos

- **Agrupaciones de optativas:** no aparecen en el buscador público. Siguen sin verificar hasta transcribir el acuerdo vigente del plan (Acuerdo 17 de 2022 del Consejo de Facultad) o hasta que un estudiante importe localmente su propia vista de "Mis planes".
- **Libre elección:** el buscador la consulta por facultad y plan de origen. Requiere una segunda etapa del script.
- **Acceso desde GitHub:** el SIA responde `403 Forbidden` a los runners alojados por GitHub (Azure). No se intenta evadir ese bloqueo; por eso la actualización corre en Vercel. Si el SIA llegara a bloquear también esas IPs, la app sigue funcionando con el último snapshot válido y avisa que los datos están desactualizados.
- **Cambios del SIA:** si el SIA cambia su HTML, la validación impide publicar y los datos quedan en la última versión válida. `/api/sia/status` muestra el error.
- **Uso responsable:** se consultan solo datos públicos, con baja frecuencia y pausas. Conviene solicitar a la Dirección Nacional de Información Académica un acceso oficial que reemplace este mecanismo.
