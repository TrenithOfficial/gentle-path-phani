#!/bin/bash

echo "Adding changes..."
git add -A

echo "Committing..."
read -p "Enter commit message: " msg
git commit -m "$msg"

echo "Pushing to origin main..."
git push origin main

echo "Done."
