#!/usr/bin/env bash
set -e
EAS="./node_modules/.bin/eas"

echo "=== Mobi AAB Build (for Google Play Store) ==="
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
echo "Starting AAB build (production profile)..."
echo "Build runs on Expo cloud — takes about 15-25 minutes."
echo "Monitor progress at: https://expo.dev/accounts/$USER/projects/mobi/builds"
echo ""

TMPDIR=/tmp/eas-build $EAS build -p android --profile production --non-interactive

echo ""
echo "AAB build complete! Download link available at:"
echo "https://expo.dev/accounts/$USER/projects/mobi/builds"
echo ""
echo "This AAB is ready for Google Play Store submission."
