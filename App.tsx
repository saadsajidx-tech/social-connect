import React from 'react';
import { StyleSheet } from 'react-native';
import Toast, { BaseToastProps, ErrorToast, SuccessToast } from 'react-native-toast-message';
import { UserProvider } from './src/Hooks/useUser';
import RootNavigator from './src/navigation/RootNavigator';
import { Colors } from './src/utilities/theme';
import { StatusBar } from 'react-native';

StatusBar.setTranslucent(true);
StatusBar.setBackgroundColor('transparent');
const App = () => {
  const toastConfig = {
    error: (props: BaseToastProps) => (
      <ErrorToast
        {...props}
        style={[styles.errorToastContainer, { backgroundColor: Colors.white }]}
        text1Style={[styles.text1, { color: Colors.black }]}
        text2Style={[styles.text2, { color: Colors.black }]}
      />
    ),
    success: (props: BaseToastProps) => (
      <SuccessToast
        {...props}
        style={[styles.successToastContainer, { backgroundColor: Colors.white }]}
        text1Style={[styles.text1, { color: Colors.black }]}
        text2Style={[styles.text2, { color: Colors.black }]}
      />
    ),
  };

  return (
    <UserProvider>
      <RootNavigator />
      <Toast config={toastConfig} />
    </UserProvider>
  );
};

const styles = StyleSheet.create({
  successToastContainer: {
    borderLeftColor: 'green',
    marginHorizontal: 15,
    width: '88%',
    borderLeftWidth: 9,
  },
  errorToastContainer: {
    borderLeftColor: Colors.error,
    marginHorizontal: 15,
    width: '88%',
    borderLeftWidth: 9,
    backgroundColor: Colors.error,
  },
  text1: {
    fontSize: 16,
    fontWeight: '600',
  },
  text2: {
    fontSize: 13,
    fontWeight: '300',
  },
});
export default App;
