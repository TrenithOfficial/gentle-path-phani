#!/bin/bash
set -e

echo "Adding changes..."
git add -A

read -p "Enter commit message: " msg
echo "Committing..."
git commit -m "$msg" || echo "No changes to commit."

echo "Force pushing to origin main (local is source of truth)..."
git push --force origin main

echo "Done."
