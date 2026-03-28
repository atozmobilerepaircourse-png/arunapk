// OLD NEARBY SCREEN - DEPRECATED
// Use /nearby instead
// This file is kept for backward compatibility but should not be used

import { redirect } from 'expo-router';

export default function DeprecatedNearbyShops() {
  redirect('/nearby');
}
