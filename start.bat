@echo off
cd /d %~dp0
if not exist .venv py -m venv .venv
call .venv\Scripts\activate
py -m pip install -r requirements.txt
py start.py
