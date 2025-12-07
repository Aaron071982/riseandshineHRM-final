#!/bin/bash

# Push script for riseandshinehrm-2 repository

echo "🚀 Pushing to GitHub..."
echo ""

# Set remote
git remote set-url origin https://github.com/Aaron071982/riseandshinehrm-2.git

# Try to push
echo "Attempting to push..."
git push -u origin main

echo ""
echo "If you got a 403 error, your token needs 'repo' permissions."
echo "Generate a new token at: https://github.com/settings/tokens/new"
echo "Make sure to check the 'repo' scope!"


