#!/usr/bin/env bash
# Обратная совместимость — используйте scripts/deploy.sh
exec "$(cd "$(dirname "$0")" && pwd)/deploy.sh" "$@"
