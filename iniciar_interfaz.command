#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -x .venv/bin/python ]]; then
  echo "Falta preparar el entorno Python local (.venv)."
  echo "Este lanzador no descarga ni instala dependencias automáticamente."
  exit 1
fi

.venv/bin/python -B diagnostico_entorno.py
exec .venv/bin/python -B interfaz.py "$@"
