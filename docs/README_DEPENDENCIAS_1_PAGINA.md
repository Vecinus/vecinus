# Dependencias en 1 pagina

Guia ultra rapida para el equipo.

## Regla de oro

1. Cambia archivo fuente.
2. Regenera lock.
3. Valida.
4. Commit de ambos archivos.

## Backend rapido

Archivos:

1. Fuente: [../backend/requirements.in](../backend/requirements.in)
2. Lock: [../backend/requirements.txt](../backend/requirements.txt)

Cambiar dependencias backend:

```bash
python -m pip install pip-tools
pip-compile --resolver=backtracking --output-file backend/requirements.txt backend/requirements.in
python -m pip install -r backend/requirements.txt
pip check
pip-audit -r backend/requirements.txt --progress-spinner off
```

Si CI falla en `backend-lock-consistency`:

```bash
pip-compile --resolver=backtracking --output-file backend/requirements.txt backend/requirements.in
```

## Frontend rapido

Archivos:

1. Fuente: [../frontend/package.json](../frontend/package.json)
2. Lock: [../frontend/package-lock.json](../frontend/package-lock.json)

Cambiar dependencias frontend:

```bash
cd frontend
npm install
npm audit
```

Si CI falla en `frontend-lock-consistency`:

```bash
cd frontend
npm install
```

## CI y seguridad

1. Workflow: [../.github/workflows/CI_dependency_scan.yml](../.github/workflows/CI_dependency_scan.yml)
2. PR: bloquea en critical y por lock desactualizado.
3. Nightly/manual: auditoria mas estricta (high+critical en frontend y audit estricto en backend).

## Dependabot

1. Config: [../.github/dependabot.yml](../.github/dependabot.yml)
2. Diario (Europe/Madrid) y PRs agrupados para reducir ruido.

## Antes de merge

1. Fuente y lock sincronizados.
2. CI verde.
3. Sin vulnerabilidades criticas nuevas sin plan.
