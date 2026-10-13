# Plan 2545 Ingeniería Electrónica (Sede Bogotá): notas de extracción (13-oct-2026)

## Fuentes
- **SIA ServiciosApp (Historia académica / Mis planes):** NO se pudo usar. https://sia.unal.edu.co/ServiciosApp/faces/inicioServicios redirige al login (autenticasia.unal.edu.co/oam/server/obrareq.cgi, "Ingrese su usuario y contraseña"); no hay sesión iniciada y no se escribieron credenciales. No se probó siiabog "Mis planes".
- **Buscador de cursos público:** https://sia.unal.edu.co/Catalogo/facespublico/public/servicioPublico.jsf?taskflowId=task-flow-AC_CatalogoAsignaturas
  Filtros: Pregrado > 1101 SEDE BOGOTÁ > 2055 FACULTAD DE INGENIERÍA > 2545 INGENIERÍA ELECTRÓNICA > tipología "TODAS MENOS LIBRE ELECCIÓN". Resultado: 62 asignaturas. Los prerrequisitos se tomaron de la página de detalle de cada asignatura.

## Formato de los prerrequisitos
Cada entrada lleva `codigo`, `nombre`, `tipo` (M = obligatorio aprobar antes; O = se puede inscribir, pero no se califica sin aprobarlo; E = correquisito, se inscribe a la vez o ya se inscribió antes; A = anulación), `condicion` (n.º de condición), `todas` (true = se exigen todas las de la condición; false = basta 1 de la lista) y `correquisito` (tipo == E).
Las listas con `todas=false` suelen incluir códigos equivalentes de planes antiguos (p. ej. 2000927 Matematicas iii ≈ Álgebra Lineal). Todos los prerrequisitos encontrados son de tipo M; no apareció ningún correquisito (E).

## Créditos listados por tipología (suma del catálogo, NO el requisito del plan)
| Tipología | # asignaturas | créditos en el catálogo |
|---|---|---|
| Fund. obligatoria (B) | 14 | 51 |
| Fund. optativa (O) | 7 | 21 |
| Disciplinar obligatoria (C) | 18 | 63 |
| Disciplinar optativa (T) | 5 | 15 |
| Trabajo de grado (P) | 2 (son alternativas) | 6 |
| Nivelación (E) | 16 | (no cuentan para los 172) |
| Libre elección (L) | no extraída | — |
B + C + P = 120 créditos obligatorios. El Buscador no muestra cuántos créditos exige el plan por tipología (optativas y libre elección), así que no se pudo cuadrar contra los 172. Ese dato está en Historia académica / resumen de créditos, que pide login.

## Vacíos
- `agrupacion` y `semestre` = null: el Buscador público no muestra agrupación/componente ni el semestre sugerido.
- La lista de disciplinares optativas parece corta (5): el Buscador puede listar solo lo que el plan tiene asociado o lo que se ofrece.
- Libre elección no se extrajo (es el catálogo de toda la universidad).
- A las asignaturas de nivelación (16) no se les sacaron prerrequisitos (`prerrequisitos: null`).
- `sin_programar_2026_2` = true marca las asignaturas que salen como "ASIGNATURA SIN PROGRAMAR".
