#!/bin/bash
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then python3 start-lokal.py; else echo "Python 3 fehlt. Installation: python.org"; read -r -p "Enter zum Beenden"; fi
