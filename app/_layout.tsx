import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import * as ScreenCapture from "expo-screen-capture";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AppProvider } from "@/lib/context";
import { requestNotificationPermission, cleanupSounds } from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="admin" />
      <Stack.Screen name="chats" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="reels" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="upload-reel" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="user-profile" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="add-product" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="product-detail" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="my-orders" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="seller-orders" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="create-course" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="course-detail" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="course-player" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="courses" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="sell-item" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="buy-sell" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="technician-needs" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="live-chat" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fontsLoaded) setFontTimeout(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded || fontError || fontTimeout) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, fontTimeout]);

  useEffect(() => {
    requestNotificationPermission();
    return () => { cleanupSounds(); };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    ScreenCapture.preventScreenCaptureAsync();

    const subscription = ScreenCapture.addScreenshotListener(() => {
      Alert.alert(
        'Screenshot Detected',
        'Screenshots are not allowed in Mobi for privacy protection.'
      );
    });

    return () => {
      subscription.remove();
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  if (!fontsLoaded && !fontError && !fontTimeout) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <StatusBar style="light" />
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </AppProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
