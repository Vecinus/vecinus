@echo off
echo ================================
echo  INICIANDO BACKEND VECINUS
echo ================================

REM Activar entorno virtual
call venv\Scripts\activate

REM Ejecutar FastAPI con reload
uvicorn backend.main:app --reload

pause