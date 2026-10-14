# Mallatrónica

Malla interactiva para Ingeniería Electrónica de la Universidad Nacional de
Colombia, Bogotá (plan 2545). Proyecto independiente, no oficial.

Permite explorar prerrequisitos, registrar avances y notas, ubicar optativas y
planificar horarios. El progreso se guarda en el navegador; exporta una copia
antes de borrar sus datos. No pide credenciales del SIA ni sincroniza con él.

## Desarrollo local

Con Node.js 22.12 o superior:

```sh
npm ci
npm run dev
```

Verificación y vista de producción:

```sh
npm test
npm run build
npm run preview
```

## Alcance académico

El balance de 172 créditos es una estimación por componentes, no una
certificación de grado. Algunas agrupaciones y restricciones requieren
verificación. El promedio registrado incluye las notas locales de libre elección,
Matemáticas Básicas y Lectoescritura. Inglés acreditado como AP/RE no se pondera.
El cálculo no reemplaza el PAPA oficial ni representa todavía intentos repetidos.
Consulta [las limitaciones](docs/sia-v2-integration.md) y las fuentes en `data/sia/`.

## Contribuir

Se reciben issues y pull requests. Lee [CONTRIBUTING.md](CONTRIBUTING.md).
No publiques historias académicas, notas, capturas del SIA ni archivos exportados
por estudiantes; utiliza únicamente ejemplos ficticios.

## Vercel

Importa `sebastianvelace/mallatronica` en Vercel. El repositorio incluye la
configuración de Vite: `npm run build` genera `dist`. No requiere variables
secretas ni backend. El despliegue no incluye una integración autenticada con SIA.

## Licencia

Código original bajo [MIT](LICENSE), abierto a contribuciones y reutilización.
Los [materiales de terceros](THIRD_PARTY_NOTICES.md) conservan sus propios derechos.
