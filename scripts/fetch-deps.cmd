@echo off
cd /d C:\Projects\VeraMark\src-tauri
set PATH=C:\Users\Glenn\.cargo\bin;%PATH%
cargo fetch > C:\Projects\VeraMark\cargo-fetch.log 2>&1