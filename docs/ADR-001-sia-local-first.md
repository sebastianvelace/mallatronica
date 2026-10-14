# ADR-001: Integración del SIA con una aplicación local-first

**Estado:** Aceptado

**Fecha:** 2026-10-13
**Decisión:** Mantener Vite + TypeScript en el cliente y separar una futura integración de catálogo del SIA mediante un adaptador controlado.

## Contexto

Mallatrónica combina una malla curricular interpretada, notas, prerrequisitos y planificación semanal. Los datos personales de un estudiante son privados, mientras que la oferta de cursos puede ser consultada en el buscador oficial del SIA según el periodo y la sede.

El cliente no debe recibir ni persistir credenciales institucionales. Una automatización de login desde el navegador sería frágil ante cambios de sesión, expondría secretos y podría incumplir las condiciones de uso del servicio.

## Decisión

La aplicación será local-first:

1. El avance, las notas, las excepciones de nivelación, el horario y las opciones de libre elección permanecen en `localStorage` y se pueden exportar/importar.
2. El catálogo se modela como datos normalizados con código, nombre, créditos, componente, fuente e identidad estable.
   Cada curso conserva `prereqGroups`: `null` significa que el SIA no publicó la información; una lista de grupos significa AND entre condiciones y `mode: "any"` u `"all"` dentro de cada condición. Las referencias a códigos antiguos se conservan como alternativas, no se reemplazan por el curso vigente.
3. Una futura fuente del SIA se conectará mediante un adaptador separado. Ese adaptador podrá consumir únicamente una interfaz pública/permitida o un archivo exportado por el usuario, normalizarlo y guardar una instantánea con periodo, sede, URL, fecha de consulta y vigencia.
4. La interfaz debe mostrar la procedencia y la fecha de verificación; nunca presentará una oferta local como confirmación oficial.

## Opciones consideradas

### Automatizar el login del SIA desde el frontend

Se descarta. Pone credenciales en el contexto del navegador, depende de HTML/sesiones no contractuales y no ofrece una frontera clara de seguridad.

### Backend proxy con credenciales institucionales

Se descarta para la primera versión. Podría centralizar secretos y acceder a datos privados sin un modelo de autorización explícito. También agregaría costo operativo y responsabilidad sobre información académica sensible.

### Cliente local-first + adaptador de catálogo

Se acepta. Conserva velocidad y disponibilidad offline, reduce superficie de ataque y permite integrar una fuente oficial solo cuando exista una vía técnica y normativa estable.

## Consecuencias

- La app funciona sin depender de una sesión del SIA.
- El usuario debe importar o verificar la oferta hasta que exista un adaptador público estable.
- Se puede agregar después una función server-side de sincronización con caché, rate limit, reintentos y trazabilidad sin reescribir la interfaz.
- La malla actual seguirá siendo una referencia y requerirá contraste con el SIA para vigencia, grupos y prerrequisitos.

## Próximos pasos

- [x] Normalizar el modelo de catálogo fuera de la vista, incluyendo prerrequisitos OR/AND y valores `null`.
- [x] Mantener importación local compatible con cursos del SIA.
- [ ] Confirmar una fuente pública/permitida para oferta por periodo.
- [ ] Implementar `CatalogProvider` server-side con caché por sede y periodo.
- [ ] Incorporar fecha de verificación y estado de fuente en la interfaz.
