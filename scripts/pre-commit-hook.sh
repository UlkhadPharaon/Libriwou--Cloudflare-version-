#!/bin/sh
# Installed from scripts/precommit-secret-scan.cjs.
# Aborts the commit when a credential-shaped string is staged.
echo "pre-commit: scanning staged files for credentials..."
node scripts/precommit-secret-scan.cjs || exit 1
echo "pre-commit: secret scan passed."
