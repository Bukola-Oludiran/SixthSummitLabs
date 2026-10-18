#!/usr/bin/env bash
set -euo pipefail
skill_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
draw_dir="${VECTORCRAFT_DRAW_SKILL_DIR:-}"
if [[ -z "$draw_dir" && -f "$skill_dir/../vectorcraft-draw/scripts/run.sh" ]]; then
  draw_dir="$skill_dir/../vectorcraft-draw"
fi
if [[ -z "$draw_dir" ]]; then
  skills_root="${CODEX_SKILLS_DIR:-${CODEX_HOME:-$HOME/.codex}/skills}"
  draw_dir="$skills_root/vectorcraft-draw"
fi
if [[ ! -f "$draw_dir/scripts/run.sh" || ! -f "$draw_dir/scripts/vc.sh" ]]; then
  printf '%s\n' 'The vectorcraft-draw skill bridge is missing. Install it or set VECTORCRAFT_DRAW_SKILL_DIR.' >&2
  exit 1
fi
if [[ "${1:-}" == run ]]; then
  shift
  exec bash "$draw_dir/scripts/run.sh" "$@"
fi
exec bash "$draw_dir/scripts/vc.sh" "$@"
