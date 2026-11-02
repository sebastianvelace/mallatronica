#!/usr/bin/env python3
"""Snapshot of the public SIA course search (Buscador de cursos) for one study plan.

The SIA is an Oracle ADF Faces application without a public API. This script
replays the same partial postbacks a browser sends when someone picks the
filters and opens each course, using only public, unauthenticated pages.

It is deliberately slow (a pause between requests) and should run rarely,
for example once a week during registration. Only the Python standard
library is used.

Usage: python3 scripts/sia/snapshot.py [--out data/sia/snapshots/latest.json]
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import http.cookiejar
import json
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = 'https://sia.unal.edu.co'
PAGE = BASE + '/Catalogo/facespublico/public/servicioPublico.jsf'
START = PAGE + '?taskflowId=task-flow-AC_CatalogoAsignaturas'
USER_AGENT = 'mallatronica-snapshot/1.0 (+https://github.com/sebastianvelace/mallatronica)'
PAUSE_SECONDS = 1.5

# Filter components of the search form, in cascade order.
LEVEL, CAMPUS, FACULTY, PLAN, TYPOLOGY = (f'pt1:r1:0:{name}' for name in ('soc1', 'soc9', 'soc2', 'soc3', 'soc4'))
SEARCH, BACK = 'pt1:r1:0:cb1', 'pt1:r1:0:cb4'
# Each result row links its course code: <a id="pt1:r1:0:t4:N:cl2" ...>2016488</a>.
RESULT_LINK = re.compile(r'id="(pt1:r1:0:t4:\d+:cl2)"[^>]*>\s*([^<\s]+)\s*</a>')

# The results table only activates its first rows on the server: links past this
# range do not open. Searching one typology at a time keeps every list below it.
TABLE_RANGE = 25
DEFAULT_TYPOLOGIES = ['FUND. OBLIGATORIA', 'FUND. OPTATIVA', 'DISCIPLINAR OBLIGATORIA', 'DISCIPLINAR OPTATIVA', 'TRABAJO DE GRADO', 'NIVELACI']

DAYS = 'LUNES|MARTES|MIÉRCOLES|JUEVES|VIERNES|SÁBADO|DOMINGO'
CODE = r'\d{7}(?:-B)?'


class SiaError(RuntimeError):
    pass


class AdfClient:
    """Keeps the session cookie and the view state that every ADF request needs."""

    def __init__(self, pause: float = PAUSE_SECONDS):
        self.pause = pause
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.opener.addheaders = [('User-Agent', USER_AGENT), ('Accept-Language', 'es-CO,es')]
        self.requests = 0
        page = self._open(START)
        form = re.search(r'<form[^>]*id="f1"[^>]*action="([^"]+)"', page)
        if not form:
            raise SiaError('No se encontró el formulario del buscador: la página cambió.')
        self.form_url = BASE + html.unescape(form.group(1))
        self.fields = hidden_fields(page)
        self.values: dict[str, str] = {}

    def _open(self, url: str, data: dict[str, str] | None = None) -> str:
        if self.requests:
            time.sleep(self.pause)
        self.requests += 1
        body = urllib.parse.urlencode(data).encode() if data is not None else None
        request = urllib.request.Request(url, data=body)
        if data is not None:
            request.add_header('Adf-Rich-Message', 'true')
            request.add_header('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
        with self.opener.open(request, timeout=60) as response:
            text = response.read().decode('utf-8', 'replace')
        state = re.search(r'name="javax.faces.ViewState" value="([^"]+)"|<update id="javax.faces.ViewState"><!\[CDATA\[([^\]]+)\]\]>', text)
        if state and getattr(self, 'fields', None) is not None:
            self.fields['javax.faces.ViewState'] = html.unescape(state.group(1) or state.group(2))
        return text

    def _post(self, component: str, kind: str, extra: dict[str, str] | None = None) -> str:
        data = {**self.fields, **self.values, 'org.apache.myfaces.trinidad.faces.FORM': 'f1', 'event': component}
        data['event.' + component] = f'<m xmlns="http://oracle.com/richClient/comm"><k v="type"><s>{kind}</s></k></m>'
        data.update(extra or {})
        text = self._open(self.form_url, data)
        # Navigation responses ask the browser to load the resulting page.
        if '__handleRichResponseAction' in text:
            text = self._open(PAGE)
        return text

    def select(self, component: str, value: str) -> str:
        """A value change on a select; the response refreshes the dependent selects."""
        self.values[component] = value
        payload = ('<m xmlns="http://oracle.com/richClient/comm"><k v="autoSubmit"><b>1</b></k>'
                   '<k v="suppressMessageShow"><s>true</s></k><k v="type"><s>valueChange</s></k></m>')
        return self._post(component, 'valueChange', {'event.' + component: payload, 'oracle.adf.view.rich.PROCESS': component})

    def action(self, component: str) -> str:
        return self._post(component, 'action')


def hidden_fields(text: str) -> dict[str, str]:
    found = {}
    for tag in re.findall(r'<input[^>]*type="hidden"[^>]*>', text):
        name, value = re.search(r'name="([^"]+)"', tag), re.search(r'value="([^"]*)"', tag)
        if name:
            found[html.unescape(name.group(1))] = html.unescape(value.group(1)) if value else ''
    return found


def options(text: str, component: str) -> list[tuple[str, str]]:
    block = re.search(r'id="%s::content"[^>]*>(.*?)</select>' % re.escape(component), text, re.S)
    if not block:
        return []
    return [(value, html.unescape(label).strip()) for value, label in re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', block.group(1))]


def choose(text: str, component: str, startswith: str) -> str:
    for value, label in options(text, component):
        if label.upper().startswith(startswith.upper()):
            return value
    raise SiaError(f'No se encontró "{startswith}" en {component}: la página cambió o el filtro no existe.')


def visible_text(fragment: str) -> str:
    fragment = re.sub(r'<script.*?</script>', ' ', fragment, flags=re.S)
    fragment = re.sub(r'_dfs\[[^;]*;|_dl\[[^;]*;|var _[^;]*;|if\(window\[[^}]*\}', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', fragment)))
    return re.sub(r'\s+', ' ', fragment).strip()


def parse_results(page: str) -> list[dict]:
    start = page.find('pt1:r1:0:t4::db')
    if start < 0:
        return []
    rows = []
    for match in re.finditer(r'<tr[^>]*>(.*?)</tr>', page[start:], re.S):
        cells = [visible_text(cell) for cell in re.findall(r'<td[^>]*>(.*?)</td>', match.group(1), re.S)]
        if len(cells) < 4 or not re.fullmatch(CODE, cells[0] or ''):
            continue
        name = cells[1].replace('ASIGNATURA SIN PROGRAMAR', '').strip()
        rows.append({
            'codigo': cells[0],
            'nombre': name,
            'creditos': int(cells[2]) if cells[2].isdigit() else None,
            'tipologia': cells[3],
            'sin_programar': 'ASIGNATURA SIN PROGRAMAR' in cells[1],
        })
    return rows


def parse_prerequisites(text: str) -> list[dict]:
    section = text.split('Prerrequisitos', 1)
    if len(section) < 2:
        return []
    body = section[1].split('Tipo de prerrequisito implica', 1)[0]
    result = []
    for condition in re.finditer(r'Condición (\d+) Tipo (\w) ¿Todas\? \[(\w)\] Número asignaturas \[(\d*)\](.*?)(?=Condición \d+ Tipo|$)', body):
        for code, name in re.findall(rf'({CODE}) (.+?)(?= {CODE} |$)', condition.group(5).strip()):
            result.append({
                'codigo': code, 'nombre': name.strip(), 'tipo': condition.group(2), 'condicion': int(condition.group(1)),
                'todas': condition.group(3) == 'S', 'correquisito': condition.group(2) == 'E',
            })
    return result


def place(raw: str) -> str:
    """'SALON DE CLASE 453-417. 453-417. 453 - Edificio. SALON' -> '453-417 · Edificio'."""
    parts = [part.strip() for part in raw.strip(' .').split('. ')]
    if len(parts) >= 3 and re.fullmatch(r'[\w]+-[\w]+', parts[1]) and ' - ' in parts[2]:
        return f"{parts[1]} · {parts[2].split(' - ', 1)[1]}"
    return raw.strip(' .')


def parse_sessions(text: str) -> list[dict]:
    sessions = []
    for match in re.finditer(rf'({DAYS}) de (\d{{2}}:\d{{2}}) a (\d{{2}}:\d{{2}})\.\s*(.*?)(?=(?:{DAYS}) de \d{{2}}:\d{{2}}|$)', text):
        sessions.append({'dia': match.group(1), 'inicio': match.group(2), 'fin': match.group(3), 'lugar': place(match.group(4))})
    return sessions


def parse_detail(page: str, code: str) -> dict:
    text = visible_text(page)
    activities = []
    # Groups follow the course title "Nombre (código)"; some pages add "Contenido de la asignatura".
    content = text.split('Prerrequisitos', 1)[0]
    content = re.split(rf'\({re.escape(code)} ?\)', content, maxsplit=1)[-1].split('Contenido de la asignatura', 1)[-1]
    # Activity headers: "CLASE MAGISTRAL (2016488)" or "CLASE TEORICA 1000003 (21000003)".
    # Group ids can be numeric or codes such as "(SUMA-01) Grupo PEAMA Sumapaz".
    # Labels may carry a suffix, e.g. "CLASE PRACTICA-Programación de Computadores (2015734)".
    pieces = re.split(r'([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+?(?:-[^()]+?)?)(?: \d+)? \([\w-]+ ?\) (?=\([^()]+\) [^()]+? Profesor: )', content)
    for label, content in zip(pieces[1::2], pieces[2::2]):
        groups = []
        # "(1) Grupo 1 Profesor:" or "(1) 2024045-1 Taller de proyectos interdisciplinarios Profesor:".
        for group in re.finditer(r'\(([^()]+)\) (?:Grupo )?(.+?) Profesor: (.*?)\. Facultad: (.*?)Horarios/Aula: (.*?) Fecha: (\d{2}/\d{2}/\d{4}) - (\d{2}/\d{2}/\d{4}) (.*?) Duración: (.*?) Jornada: (.*?) Cupos disponibles: (\d+)', content):
            name = group.group(2).strip()
            numbered = re.match(rf'{re.escape(code)}-(\S+)', name)
            groups.append({
                'grupo': numbered.group(1) if numbered else name, 'profesor': group.group(3).strip() or None,
                'fecha_inicio': group.group(6), 'fecha_fin': group.group(7),
                'sesiones': parse_sessions(group.group(8)), 'duracion': group.group(9).strip(),
                'jornada': group.group(10).strip(), 'cupos_disponibles': int(group.group(11)),
            })
        # Without "Contenido de la asignatura" the faculty header sticks to the first label.
        label = re.sub(r'^FACULTAD DE .*?(?=\b(?:CLASE|LABORATORIO|TALLER|PR[AÁ]CTICA|SEMINARIO|PROYECTO|TUTOR[IÍ]A|SALIDA|ACTIVIDAD)\b)', '', label.strip())
        activities.append({'actividad': label.strip(), 'grupos': groups})
    return {'actividades': activities, 'prerrequisitos': parse_prerequisites(text)}


def result_links(page: str) -> dict[str, str]:
    """Course code -> detail link, so a row is never opened by position."""
    return {code: link for link, code in RESULT_LINK.findall(page)}


class PlanSearch:
    """A search session positioned on one plan; reopened when ADF loses its place."""

    def __init__(self, campus: str, faculty: str, plan: str):
        self.campus, self.faculty, self.plan = campus, faculty, plan
        self.requests = 0
        self.client: AdfClient | None = None
        self.plan_label = ''
        self.page = ''

    def open(self) -> None:
        if self.client:
            self.requests += self.client.requests
        client = AdfClient()
        page = client.select(LEVEL, '0')  # Pregrado
        page = client.select(CAMPUS, choose(page, CAMPUS, self.campus))
        page = client.select(FACULTY, choose(page, FACULTY, self.faculty))
        page = client.select(PLAN, choose(page, PLAN, self.plan))
        self.plan_label = next(label for value, label in options(page, PLAN) if value == client.values[PLAN])
        self.client, self.page = client, page

    def search(self, typology: str) -> tuple[list[dict], dict[int, str]]:
        assert self.client
        self.page = self.client.select(TYPOLOGY, choose(self.page, TYPOLOGY, typology))
        self.page = self.client.action(SEARCH)
        return parse_results(self.page), result_links(self.page)

    def total_requests(self) -> int:
        return self.requests + (self.client.requests if self.client else 0)


def snapshot(campus: str, faculty: str, plan: str, typologies: list[str], with_details: bool, only: set[str] | None = None, debug_dir: str | None = None) -> dict:
    search = PlanSearch(campus, faculty, plan)
    search.open()
    courses: dict[str, dict] = {}
    for typology in typologies:
        rows, links = search.search(typology)
        print(f'{typology}: {len(rows)} asignaturas', file=sys.stderr)
        if with_details and len(rows) > TABLE_RANGE:
            print(f'  aviso: más de {TABLE_RANGE} resultados; los detalles posteriores pueden no abrir', file=sys.stderr)
        for row in rows:
            code = row['codigo']
            course = courses.setdefault(code, row)
            if not with_details or 'actividades' in course or code not in links or (only and code not in only):
                continue
            detail = ''
            for attempt in range(2):
                detail = search.client.action(links[code])
                if f'({code}' in visible_text(detail):
                    break
                # The view lost its place: start a fresh session and search again.
                search.open()
                _, links = search.search(typology)
                if code not in links:
                    break
            if debug_dir:
                with open(f"{debug_dir}/{row['codigo']}.html", 'w', encoding='utf-8') as handle:
                    handle.write(detail)
            if f"({row['codigo']}" in visible_text(detail):
                course.update(parse_detail(detail, row['codigo']))
                search.page = search.client.action(BACK)
                links = result_links(search.page) or links
            else:
                course['detalle_no_disponible'] = True
                print(f"  sin detalle: {row['codigo']} {row['nombre']}", file=sys.stderr)
    return {
        'fuente': {
            'url': START,
            'servicio': 'Buscador de cursos (público, sin autenticación)',
            'filtros': {'nivel': 'Pregrado', 'sede': campus, 'facultad': faculty, 'plan': search.plan_label, 'tipologias': typologies},
            'consultado': dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            'peticiones': search.total_requests(),
        },
        'asignaturas': sorted(courses.values(), key=lambda course: course['codigo']),
    }


def plan_entries(data: dict, previous: list[dict]) -> list[dict]:
    """Plan file used by the app (data/sia/plan2545.json), rebuilt from the snapshot.

    Prerequisites come from the SIA detail; when a detail could not be read the
    previous value is kept instead of being replaced by "unknown".
    """
    before = {course['codigo']: course for course in previous}
    entries = []
    for course in data['asignaturas']:
        old = before.get(course['codigo'], {})
        read = 'actividades' in course and not course.get('detalle_no_disponible')
        entries.append({
            'codigo': course['codigo'],
            'nombre': course['nombre'],
            'creditos': course['creditos'] if course['creditos'] is not None else old.get('creditos'),
            'tipologia': course['tipologia'],
            'agrupacion': old.get('agrupacion'),
            'prerrequisitos': course.get('prerrequisitos', []) if read else old.get('prerrequisitos'),
            'semestre': old.get('semestre'),
            # Historic key name kept for compatibility; it reflects the snapshot's term.
            'sin_programar_2026_2': course['sin_programar'],
        })
    return sorted(entries, key=lambda entry: entry['nombre'].lower())


def write_json(path: str, value) -> None:
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=1)
        handle.write('\n')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n', 1)[0])
    parser.add_argument('--campus', default='1101 SEDE BOGOT')
    parser.add_argument('--faculty', default='2055 FACULTAD DE INGENIER')
    parser.add_argument('--plan', default='2545')
    parser.add_argument('--typology', action='append', help='Tipología del buscador; se puede repetir. Por defecto, cada tipología menos libre elección.')
    parser.add_argument('--no-details', action='store_true', help='Solo el listado, sin grupos ni prerrequisitos.')
    parser.add_argument('--out', default='data/sia/snapshots/latest.json')
    parser.add_argument('--only', action='append', help='Abrir el detalle solo de estos códigos (depuración).')
    parser.add_argument('--debug-dir', help='Guardar el HTML de cada detalle en esta carpeta.')
    parser.add_argument('--plan-out', help='Regenerar también el plan de la app (p. ej. data/sia/plan2545.json).')
    args = parser.parse_args()
    typologies = args.typology or DEFAULT_TYPOLOGIES
    try:
        data = snapshot(args.campus, args.faculty, args.plan, typologies, not args.no_details, set(args.only or []), args.debug_dir)
    except (SiaError, OSError) as error:
        print(f'Error consultando el SIA: {error}', file=sys.stderr)
        return 1
    if not data['asignaturas']:
        print('El SIA no devolvió asignaturas; no se sobrescribe el snapshot.', file=sys.stderr)
        return 1
    if args.plan_out:
        with open(args.plan_out, encoding='utf-8') as handle:
            previous = json.load(handle)
        if len(data['asignaturas']) < 0.8 * len(previous):
            print(f'El SIA devolvió {len(data["asignaturas"])} asignaturas frente a {len(previous)} previas; no se sobrescribe nada.', file=sys.stderr)
            return 1
        write_json(args.plan_out, plan_entries(data, previous))
    write_json(args.out, data)
    print(f'{len(data["asignaturas"])} asignaturas en {data["fuente"]["peticiones"]} peticiones → {args.out}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
