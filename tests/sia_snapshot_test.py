"""Parser tests for scripts/sia/snapshot.py with synthetic pages.

The fixtures reproduce the formats observed in the public SIA course search
(November 2026) with invented names. Run: python3 -m unittest discover -s tests -p '*_test.py'
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts' / 'sia'))
import snapshot  # noqa: E402

PREREQS = (
    '<span>Prerrequisitos</span><span>Condición 1</span> <span>Tipo M</span> <span>¿Todas? [N]</span> '
    '<span>Número asignaturas [1]</span> <span>1000004-B Cálculo diferencial</span> <span>2001285 Matematicas i</span> '
    '<span>Tipo de prerrequisito implica.</span>'
)


def page(body: str) -> str:
    return f'<html><body><script>var x = 1;</script>{body}</body></html>'


class DetailParsing(unittest.TestCase):
    def test_lecture_and_lab_groups_with_sessions_and_seats(self):
        html = page(
            '<h1>Curso de prueba (2016488)</h1> Tipología: DISCIPLINAR OPTATIVA Créditos: 3 Contenido de la asignatura '
            'CLASE MAGISTRAL (2016488) (1) Grupo 1 Profesor: Ana Prueba. Facultad: Horarios/Aula: No informado '
            'Fecha: 24/08/2026 <script>_dfs["a"]="dd/MM/yyyy";</script> - 12/12/2026 '
            'MIÉRCOLES de 09:00 a 11:00. SALON DE CLASE 453-417. 453-417. 453 - Edificio Uno. SALON. '
            'VIERNES de 09:00 a 11:00. SALÓN DE CLASE 401-305. 401-305. 401 - Edificio Dos. SALON. '
            'Duración: Semestral Jornada: DIURNO Cupos disponibles: 6 '
            'CLASE LABORATORIO (2016488) (1) Grupo 1 Profesor: Ana Prueba. Facultad: Horarios/Aula: No informado '
            'Fecha: 24/08/2026 - 12/12/2026 MARTES de 09:00 a 11:00. LABORATORIO X. 411-104A. 411 - Laboratorios. LABORATORIO. '
            'Duración: Semestral Jornada: DIURNO Cupos disponibles: 0 ' + PREREQS
        )
        detail = snapshot.parse_detail(html, '2016488')
        self.assertEqual([a['actividad'] for a in detail['actividades']], ['CLASE MAGISTRAL', 'CLASE LABORATORIO'])
        lecture = detail['actividades'][0]['grupos'][0]
        self.assertEqual(lecture['grupo'], '1')
        self.assertEqual(lecture['profesor'], 'Ana Prueba')
        self.assertEqual(lecture['cupos_disponibles'], 6)
        self.assertEqual([(s['dia'], s['inicio'], s['fin'], s['lugar']) for s in lecture['sesiones']], [
            ('MIÉRCOLES', '09:00', '11:00', '453-417 · Edificio Uno'),
            ('VIERNES', '09:00', '11:00', '401-305 · Edificio Dos'),
        ])
        self.assertEqual(detail['actividades'][1]['grupos'][0]['cupos_disponibles'], 0)
        self.assertEqual([(p['codigo'], p['condicion'], p['todas']) for p in detail['prerrequisitos']], [('1000004-B', 1, False), ('2001285', 1, False)])

    def test_page_without_content_heading_and_faculty_prefix(self):
        html = page(
            'Álgebra de prueba (1000003-B) Tipología: FUND. OBLIGATORIA Créditos: 4 INGENIERÍA Facultad: FACULTAD DE INGENIERÍA '
            'CLASE TEORICA 1000003 (21000003) (1) Grupo 1 Profesor: Luis Prueba. Facultad: FACULTAD DE CIENCIAS '
            'Horarios/Aula: No informado Fecha: 24/08/2026 - 17/12/2026 LUNES de 07:00 a 09:00. Duración: Semestral Jornada: DIURNO Cupos disponibles: 2 '
            '(SUMA-01) Grupo 1 - PEAMA Sumapaz Profesor: Eva Prueba. Facultad: SEDE BOGOTÁ Horarios/Aula: No informado '
            'Fecha: 27/08/2026 - 16/12/2026 MIÉRCOLES de 08:00 a 12:00. Duración: Semestral Jornada: DIURNO Cupos disponibles: 0'
        )
        detail = snapshot.parse_detail(html, '1000003-B')
        self.assertEqual([a['actividad'] for a in detail['actividades']], ['CLASE TEORICA'])
        self.assertEqual([g['grupo'] for g in detail['actividades'][0]['grupos']], ['1', '1 - PEAMA Sumapaz'])

    def test_suffixed_labels_spaced_codes_and_unnamed_groups(self):
        html = page(
            'Taller (2024045 ) Contenido de la asignatura CLASE PRACTICA-Programación de Prueba (2024045 ) '
            '(1) 2024045-1 Taller de prueba Profesor: Eva Prueba. Facultad: FACULTAD DE INGENIERÍA Horarios/Aula: No informado '
            'Fecha: 27/08/2026 - 17/12/2026 LUNES de 14:00 a 16:00. Duración: Semestral Jornada: DIURNO Cupos disponibles: 9'
        )
        detail = snapshot.parse_detail(html, '2024045')
        self.assertEqual(detail['actividades'][0]['actividad'], 'CLASE PRACTICA-Programación de Prueba')
        self.assertEqual(detail['actividades'][0]['grupos'][0]['grupo'], '1')
        self.assertEqual(detail['actividades'][0]['grupos'][0]['cupos_disponibles'], 9)

    def test_activity_without_groups(self):
        detail = snapshot.parse_detail(page('Curso (2015701) Contenido de la asignatura CLASE PRACTICA (2015701) ' + PREREQS), '2015701')
        self.assertEqual(detail['actividades'], [])
        self.assertEqual(len(detail['prerrequisitos']), 2)


class ResultsParsing(unittest.TestCase):
    def test_rows_and_links_by_code(self):
        html = (
            '<div id="pt1:r1:0:t4::db"><table>'
            '<tr><td><a id="pt1:r1:0:t4:0:cl2" class="af_commandLink">2016488</a></td><td><span>Curso A</span></td><td>3</td><td>DISCIPLINAR OPTATIVA (T)</td><td></td></tr>'
            '<tr><td><a id="pt1:r1:0:t4:1:cl2" class="af_commandLink">2015698</a></td><td><span>Curso B</span> ASIGNATURA SIN PROGRAMAR</td><td>3</td><td>FUND. OPTATIVA (O)</td><td></td></tr>'
            '</table></div>'
        )
        rows = snapshot.parse_results(html)
        self.assertEqual([(r['codigo'], r['nombre'], r['creditos'], r['sin_programar']) for r in rows], [
            ('2016488', 'Curso A', 3, False), ('2015698', 'Curso B', 3, True),
        ])
        self.assertEqual(snapshot.result_links(html), {'2016488': 'pt1:r1:0:t4:0:cl2', '2015698': 'pt1:r1:0:t4:1:cl2'})


class PlanFile(unittest.TestCase):
    def test_unread_details_keep_previous_prerequisites(self):
        previous = [{'codigo': 'X1', 'nombre': 'Old', 'creditos': 3, 'tipologia': 'T', 'agrupacion': None, 'prerrequisitos': [{'codigo': 'Y'}], 'semestre': None, 'sin_programar_2026_2': False}]
        data = {'asignaturas': [{'codigo': 'X1', 'nombre': 'Nuevo', 'creditos': 3, 'tipologia': 'T', 'sin_programar': True, 'detalle_no_disponible': True}]}
        [entry] = snapshot.plan_entries(data, previous)
        self.assertEqual(entry['nombre'], 'Nuevo')
        self.assertEqual(entry['prerrequisitos'], [{'codigo': 'Y'}])
        self.assertTrue(entry['sin_programar_2026_2'])


if __name__ == '__main__':
    unittest.main()
