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

1. `scripts/sia/snapshot.py` reproduce por HTTP los mismos eventos ADF que envía un navegador en el buscador público. Usa solo la biblioteca estándar de Python, se identifica con un User-Agent propio y espera 1,5 s entre peticiones. Un plan completo cuesta unas 260 peticiones.
2. El resultado se guarda en `data/sia/snapshots/latest.json`, con la fuente, los filtros y la fecha de consulta. Con `--plan-out` también regenera `data/sia/plan2545.json`, el plan que usa la malla. Si un detalle no se pudo leer, conserva los prerrequisitos anteriores. Si faltan más del 20 % de las materias, no sobrescribe nada.
3. El workflow `.github/workflows/sia-snapshot.yml` se ejecuta semanalmente o a demanda. Corre el script, valida con `npm test` y `npm run build`, y abre o actualiza un pull request. Vercel publica solo cuando alguien lo fusiona.
4. `tests/sia.test.cjs` exige que el plan de la app coincida con el snapshot en materias, créditos, tipologías, estado de oferta y prerrequisitos leídos.
5. La interfaz muestra la oferta y su fecha de consulta: grupos y cupos en el detalle de cada materia, la oferta en el planificador y grupos reales que se agregan al horario en un clic. Los cupos cambian durante la inscripción, así que siempre se remite al SIA.

## Opciones descartadas

- **Consultar el SIA desde el navegador del estudiante:** lo impiden CORS, `X-Frame-Options` y el estado de sesión de ADF.
- **Proxy en vivo por cada visita:** sería lento (decenas de segundos por consulta) y frágil, y multiplicaría la carga sobre el SIA.
- **Automatizar el login o usar credenciales de estudiantes:** se mantiene descartado por ADR-001.

## Límites conocidos

- **Agrupaciones de optativas:** no aparecen en el buscador público. Siguen sin verificar hasta transcribir el acuerdo vigente del plan (Acuerdo 17 de 2022 del Consejo de Facultad) o hasta que un estudiante importe localmente su propia vista de "Mis planes".
- **Libre elección:** el buscador la consulta por facultad y plan de origen. Requiere una segunda etapa del script.
- **Cambios del SIA:** si el SIA cambia su HTML, el script falla y los datos quedan en la última versión válida. El workflow fallido es la alerta.
- **Uso responsable:** se consultan solo datos públicos, con baja frecuencia y pausas. Conviene solicitar a la Dirección Nacional de Información Académica un acceso oficial que reemplace este mecanismo.
