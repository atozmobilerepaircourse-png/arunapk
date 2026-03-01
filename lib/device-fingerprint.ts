import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = '@mobi_device_id';

export async function getDeviceId(): Promise<string> {
  const existingId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const newId = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}
