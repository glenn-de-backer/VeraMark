@echo off
cd /d C:\Projects\VeraMark\src-tauri
set PATH=C:\Users\Glenn\.cargo\bin;%PATH%
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
cargo test -- --nocapture > C:\Projects\VeraMark\cargo-test.log 2>&1