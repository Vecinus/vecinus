@echo off
cd /d "%~dp0backend"

python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt

pause