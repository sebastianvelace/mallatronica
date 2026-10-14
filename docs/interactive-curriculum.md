# Interactive curriculum

The main view uses a compact ten-column map, based on the curriculum image supplied by the user. The placement is a visual reference, not an official semester field: `data/sia/plan2545.json` remains the source of course names, credits and prerequisite conditions.

## Data boundaries

- `src/data/reference-layout.ts` records only positions and illustrative elective spaces. Those spaces do not contribute credits or approvals. They are not all mandatory courses.
- Current codes for Diseño de sistemas electrónicos (`2028816`) and Taller de proyectos interdisciplinarios (`2024045`) are placed by matching their names to the reference. No equivalence for academic recognition is inferred.
- Courses without a specific position appear in the alternatives catalogue. All 46 regular courses remain accessible.
- Each prerequisite condition must be satisfied. Within a condition, the SIA's `all`/`any` rule determines whether every listed course or one alternative is needed. External equivalents stay visible, but are not silently counted as approved.
- A course's position never determines eligibility. A connection means prerequisite or alternative, not that passing its source is sufficient on its own.
- Availability is based on recorded requirements, not a live enrollment authorization. Term-specific availability, degree modalities, credit thresholds and recognition decisions still require validation against the university's current records.

## Interaction

Hovering a course opens an expanded preview after a brief intent delay. Moving into the preview keeps it open. Clicking or pressing Enter/Space pins the details. Escape or the close button dismisses them and restores focus. On touch screens the same click interaction works without hover.

Approving a course is an explicit action inside its detail, never a side effect of exploring the map. The board calls the application's existing prerequisite check before updating academic state. A saved grade takes precedence over a manual mark.

Prerequisites and dependent courses are highlighted only during inspection. Search and status filters retain the map's spatial arrangement. Academic updates retain the current horizontal scroll and filters. Pointer movement does not rerender the application. Event listeners and timers are disposed when the board unmounts.

Navigation uses named tabs on desktop and a fixed bottom navigation on mobile. Reduced-motion preferences disable preview and relationship animation and smooth scrolling. Course previews prefer the left side of their anchor, fall back to the right when needed, and remain within the mobile viewport.

## Grades and elective planning

An approved course may have an optional final grade. Saving or removing that grade updates the weighted average immediately. Removing the grade preserves its previous approval/failure state. Approvals without grades do not enter the average as zeroes. Recorded failing grades do enter it. The same domain calculation is used by the map and calculator.

The displayed **Promedio registrado** is not presented as a certified PAPA. It uses one numeric grade per regular, local free-choice, Mathematics Basics, or Literacy course. Language requirements recorded as AP/RE and approvals without a numeric grade are excluded. It cannot represent repeated attempts or an entire official transcript. The coverage is shown alongside the result.

Local free-choice courses have progress isolated from regular-course identifiers. An approval or a grade contributes to the free-choice balance, capped at the official 34-credit requirement. Excess credits are displayed but do not inflate total plan progress.

Mathematics Basics and Literacy are additional levelation credits outside the 172-credit plan. Their numeric grades are included in the recorded average. Foreign-language levels and sufficiency are represented as AP/RE: they can satisfy the 12-credit language requirement but are not converted into numeric grades. This follows the UNAL Resolution 037/2010 subject index and the numeric-average rule in Articles 40–42 of Agreement 008/2008. See `data/sia/v2/reglas_promedios.json` for source status and limitations.

Elective assignments are persisted independently of approvals and grades, using stable `semester:row` keys. An assigned plan course moves from the alternatives catalogue into the selected slot without being duplicated or automatically approved. Changing a placement does not erase grades. Free-choice placements are explicitly planning-only. Assignments reject missing courses, component mismatches, duplicate course codes and invalid slot keys on load/import.

The elective picker ranks name matches to the visual reference ahead of other courses in the component. This is visual assistance, not verified academic grouping: the SIA extract has no grouping field. Other component courses remain available through a disclosure.

Run `npm test` for the domain contracts; no additional test dependency is required.

## Verification scenarios

- All regular courses appear once across the map and alternatives catalogue.
- Hover and selection leave stored academic state unchanged.
- Approval persists after reload and updates dependent eligibility.
- Circuitos II is partial with only Circuitos I approved; it becomes available with Ecuaciones Diferenciales also approved, without requiring its OR alternative Matemáticas IV.
- Keyboard and touch users can open and dismiss course details.
- Search handles accents and has an explicit no-results state.
- Search and filters preserve positions; horizontal position survives academic updates.
- Preview stays inside the viewport; the page has no horizontal overflow at mobile widths (the map itself scrolls).
- All five named navigation destinations remain accessible on desktop and mobile.
- Optional grades update the weighted average, reject invalid input, and survive reloads.
- Elective assignments survive reloads, prevent duplicates, and preserve grades when changed.
- Regular courses with `semester: null` remain editable in the calculator.
- Planning from an eligible course preselects it in the schedule form.
- Both themes, reduced motion and browser runtime errors are checked.
