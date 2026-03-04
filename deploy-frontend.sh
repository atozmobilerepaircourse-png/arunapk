#!/bin/bash
set -e

echo "=== Deploying Frontend to Firebase Hosting ==="

echo "[1/3] Building Expo web export..."
EXPO_PUBLIC_DOMAIN=repair-backend-3siud7gbq-el.a.run.app npx expo export --platform web --output-dir dist

echo "[2/3] Copying fonts..."
mkdir -p dist/_expo/static/fonts
cp node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/*.ttf dist/_expo/static/fonts/
find node_modules/@expo-google-fonts/inter -name "*.ttf" -exec cp {} dist/_expo/static/fonts/ \;

echo "[3/3] Deploying to Firebase Hosting..."
FIREBASE_TOKEN="1//0gjWvqy7d1vsvCgYIARAAGBASNwF-L9IrWs2R1Nk0J1LKUbZilceGWYpWuRZWB-hnC_DceRRqeOx5dOgdteTB8isfPlQkidUMVIg" \
  ./node_modules/.bin/firebase deploy --only hosting --project mobile-repair-app-276b6 --non-interactive

echo ""
echo "Frontend deployed successfully!"
echo "Live at: https://mobile-repair-app-276b6.web.app"
