@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 10월 시간외근무수당 원인행위 붙임
echo 이 폴더의 서류를 확인합니다. 빠진 칸이 있으면 PDF를 만들지 않습니다.
echo 봇 표기와 볼트 경로는 PDF에 넣지 않습니다.
set "PY=python"
where python >nul 2>&1
if errorlevel 1 set "PY=py -3"
%PY% "%~dp0ot_attach_pack.py"
echo.
echo 결과 PDF는 이 폴더에 생깁니다. 브라우저 연습장은 F: 에 바로 쓰지 못합니다.
pause
