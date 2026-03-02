import { useCallback } from 'react';
import { StatusBar, View, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export function TransparentStatusBar({ children }: { children?: React.ReactNode }) {
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
    }, []),
  );

  return (
    <>
      <View style={{ height: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }} />
      {children}
    </>
  );
}
