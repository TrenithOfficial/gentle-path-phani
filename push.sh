#!/bin/bash
set -e

echo "Adding changes..."
git add -A

read -p "Enter commit message: " msg
echo "Committing..."
git commit -m "$msg" || echo "No changes to commit."

echo "Pushing to origin main..."
git push origin main

echo "Done."