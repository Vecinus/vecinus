# Manual interno de dependencias y seguridad

Runbook del equipo para operar dependencias en el dia a dia.

Atajos:
1. Version corta (1 pagina): [README_DEPENDENCIAS_1_PAGINA.md](README_DEPENDENCIAS_1_PAGINA.md)
2. Workflow CI: [../.github/workflows/CI_dependency_scan.yml](../.github/workflows/CI_dependency_scan.yml)
3. Dependabot: [../.github/dependabot.yml](../.github/dependabot.yml)

## Regla general

1. Se edita el archivo fuente.
2. Se regenera el archivo lock.
3. Se valida en local.
4. Se suben fuente y lock en el mismo PR.

## Apartado Backend

### Archivos backend

1. [../backend/requirements.in](../backend/requirements.in): fuente de verdad editable.
2. [../backend/requirements.txt](../backend/requirements.txt): lock generado (no editar a mano).

### Flujo de cambio backend

1. Editar [../backend/requirements.in](../backend/requirements.in).
2. Regenerar lock:

```bash
python -m pip install pip-tools
pip-compile --resolver=backtracking --output-file backend/requirements.txt backend/requirements.in
```

3. Validar backend:

```bash
python -m pip install -r backend/requirements.txt
pip check
pip-audit -r backend/requirements.txt --progress-spinner off
```

### Fallos de CI backend y solucion

Si falla `backend-lock-consistency`:
1. Causa: `requirements.txt` no coincide con `requirements.in`.
2. Solucion: recompilar lock y hacer commit.

Comando exacto del CI (runner Linux, bash):

```bash
pip-compile --resolver=backtracking --output-file backend/requirements.txt backend/requirements.in
if ! git diff --exit-code -- backend/requirements.txt; then
   if git diff -U0 -- backend/requirements.txt \
      | grep -E '^[+-]' \
      | grep -vE '^(\+\+\+|---)' \
      | grep -vE '^[+-][[:space:]]*(#.*)?$'; then
      echo "backend/requirements.txt is out of date with backend/requirements.in"
      exit 1
   fi
   echo "Only annotation/comment differences detected in requirements.txt; continuing."
fi
```

Variante local en Windows (PowerShell):

```powershell
pip-compile --resolver=backtracking --output-file backend/requirements.txt backend/requirements.in
$diff = git diff -U0 -- backend/requirements.txt
if ($LASTEXITCODE -ne 0) {
   $substantive = $diff |
      Select-String '^[+-]' |
      Where-Object { $_ -notmatch '^(\+\+\+|---)' } |
      Where-Object { $_ -notmatch '^[+-]\s*(#.*)?$' }

   if ($substantive) {
      Write-Error "backend/requirements.txt is out of date with backend/requirements.in"
      exit 1
   }

   Write-Host "Only annotation/comment differences detected in requirements.txt; continuing."
}
```

Si falla `backend-resolution-check`:
1. Causa: conflicto de dependencias o import roto.
2. Solucion:

```bash
python -m pip install -r backend/requirements.txt
pip check
python -c "import pypdf; from google import genai; print(pypdf.__version__, genai.__name__)"
```

### Notas de seguridad backend

1. En PR, `pip-audit` es reporte no bloqueante.
2. En nightly/manual, `pip-audit` backend es estricto y bloquea.

## Apartado Frontend

### Archivos frontend

1. [../frontend/package.json](../frontend/package.json): fuente de verdad editable (directas).
2. [../frontend/package-lock.json](../frontend/package-lock.json): lock generado (no editar a mano).

### Flujo de cambio frontend

1. Editar [../frontend/package.json](../frontend/package.json) si cambia una dependencia directa.
2. Regenerar lock:

```bash
cd frontend
npm install
```

3. Validar seguridad:

```bash
cd frontend
npm audit
```

### Fallos de CI frontend y solucion

Si falla `frontend-lock-consistency`:
1. Causa: `package-lock.json` no coincide con `package.json`.
2. Solucion:

```bash
cd frontend
npm install
```

Si falla `frontend-npm-audit-pr` o `frontend-npm-audit-nightly`:
1. Solucion base:

```bash
cd frontend
npm audit fix
npm audit
```

2. Si no se resuelve, actualizar dependencia directa que arrastra la vulnerable.

### Notas de seguridad frontend

1. En PR, `npm audit` bloquea en `critical`.
2. En nightly/manual, `npm audit` bloquea en `high` y `critical`.

## Dependabot y operativa del equipo

1. Revisa backend/frontend diariamente a las 06:00 Europe/Madrid.
2. Agrupa PRs de seguridad y minor/patch para reducir ruido.
3. Antes de merge de PRs de Dependabot:
   revisar CI verde, changelog y regresion funcional.

## Revision mensual de seguridad

Workflow: [../.github/workflows/CI_security_monthly_review.yml](../.github/workflows/CI_security_monthly_review.yml)

1. Crea issue mensual con checklist de revision.
2. Se puede lanzar manualmente cuando haga falta.

## Checklist de merge (obligatorio)

1. Si cambiaste `requirements.in`, tambien cambiaste `requirements.txt`.
2. Si cambiaste `package.json`, tambien cambiaste `package-lock.json`.
3. CI de dependencias en verde.
4. Sin vulnerabilidades criticas nuevas sin plan de mitigacion.
