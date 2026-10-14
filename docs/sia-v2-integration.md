# SIA v2 integration

The research snapshot comes from the public `sebastianvelace/mallatronica` repository. The previous `mallatr-nica` URL redirects to that same repository. The application is published on the sanitized history without changing the research sources.

## Privacy

Individual progress fields and the individual levelation total were removed from the public `estructura.json`. Duplicated personal progress, credit allowance and request information were also removed from `evidencia.md`. On 2026-10-13, reachable remote history was rewritten to sanitize both files in every affected revision. Only those two paths changed during the privacy rewrite; other files and commit metadata were verified unchanged. GitHub caches and independent clones may still retain the original objects; host-side cache removal requires GitHub Support. This is not a guarantee of erasure from all copies.

## Implemented

- Six disjoint requirements total 172 credits; degree contributes at most six.
- The balance caps each component separately. Excess electives are not automatically transferred to free choice.
- The interface exposes recorded and required credits and explicitly calls the balance an estimate, not graduation certification.
- Unknown subgroup membership remains unknown. The existing prerequisite dataset is preserved, not overwritten with null values from a different extraction.
- Research on averages and global restrictions is stored as evidence, not automatically executed as policy.

## Pending

- Verified course-to-group mapping and subgroup validation.
- Free-choice approvals and grades.
- Attempt history and separate PA/PAPA calculations, including resolution of exceptional cases.
- Verification of global restrictions, including the distinction between credits taken and passed.
- GitHub-side cache cleanup and coordination with anyone holding an old clone. Do not merge an old contaminated branch back into the sanitized history.
