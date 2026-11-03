#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

echo "Uploading local project files to server..."
scp -r $(ls | grep -v 'venv' | grep -v '__pycache__') jan@188.245.220.136:/home/jan/Innovation_management/

echo "Done!"
