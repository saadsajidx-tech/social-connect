import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useUser } from '../Hooks/useUser';
import AuthNavigator, { AuthStackParamList } from './AuthNavigator';
import HomeNavigator, { HomeStackParamList } from './HomeNavigator';
import { Colors } from '../utilities/theme';
import {
  createNotificationChannels,
  requestNotificationPermission,
  saveFCMToken,
  setupFCMForegroundHandler,
  setupNotifeeEventHandler,
} from '../services/fcmService';
import { useRTDBNotificationListener } from '../Hooks/useRTDBNotificationListener';

export type RootStackParamList = {
  App: NavigatorScreenParams<HomeStackParamList>;
  Auth: NavigatorScreenParams<AuthStackParamList>;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

// ─── Loading Screen ──────────────────────────────────────────────────────────
// Rendered BEFORE NavigationContainer — no navigation hooks allowed here.

function LoadingScreen() {
  return (
    <View style={styles.loadingRoot}>
      {/* Background orbs — matches your app's visual language */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}

// ─── AuthenticatedShell ──────────────────────────────────────────────────────
// Renders only when a user is logged in.
// Owns ALL notification lifecycle — setup, listeners, cleanup.

function AuthenticatedShell() {
  const { user } = useUser();
  const setupDone = useRef(false);

  // ── One-time bootstrap on login ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.userId || setupDone.current) return;
    setupDone.current = true;

    (async () => {
      try {
        await createNotificationChannels();
        await requestNotificationPermission();
        await saveFCMToken();
      } catch (e) {
        console.warn('[AuthenticatedShell] notification setup error:', e);
      }
    })();
  }, [user?.userId]);

  // ── FCM foreground messages → show notifee notification ─────────────────
  useEffect(() => {
    const unsubscribe = setupFCMForegroundHandler();
    return unsubscribe;
  }, []);

  // ── Notifee tap → navigate to post ──────────────────────────────────────
  useEffect(() => {
    const unsubscribe = setupNotifeeEventHandler(data => {
      console.log('[Notifee pressed]', data);
    });
    return unsubscribe;
  }, []);

  // ── RTDB real-time signal listener ───────────────────────────────────────
  const notifEnabled = user?.preferences?.notifications?.enabled !== false;
  useRTDBNotificationListener(user?.userId, notifEnabled);

  return <HomeNavigator />;
}

// ─── RootNavigator ───────────────────────────────────────────────────────────

export default function RootNavigator() {
  const { user, loadingSession } = useUser();

  // Show the loading screen outside NavigationContainer so no navigation
  // hooks are invoked before the container is ready.
  if (loadingSession) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg.primary },
        }}>
        {user ? (
          <RootStack.Screen name="App" component={AuthenticatedShell} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  orb2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,229,195,0.07)',
  },
});
