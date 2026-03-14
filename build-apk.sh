#!/usr/bin/env bash
set -e
EAS="./node_modules/.bin/eas"

echo "=== Mobi APK Build (for testing & direct install) ==="
echo ""

# Check if logged in
if ! $EAS whoami &>/dev/null; then
  echo "ERROR: You are not logged into Expo."
  echo ""
  echo "Please run this command in the Replit Shell first:"
  echo ""
  echo "  ./node_modules/.bin/eas login"
  echo ""
  echo "Then click 'Run' on this workflow again."
  exit 1
fi

USER=$($EAS whoami 2>/dev/null)
echo "Logged in as: $USER"
echo ""
echo "Starting APK build (preview profile)..."
echo "Build runs on Expo cloud — takes about 10-20 minutes."
echo "Monitor progress at: https://expo.dev/accounts/$USER/projects/mobi/builds"
echo ""

mkdir -p /home/runner/.eas-tmp
TMPDIR=/home/runner/.eas-tmp $EAS build -p android --profile preview --non-interactive

echo ""
echo "APK build submitted! Download link available at:"
echo "https://expo.dev/accounts/$USER/projects/mobi/builds"
