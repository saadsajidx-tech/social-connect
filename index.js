/**
 * @format
 */

import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';
import {
  registerFCMBackgroundHandler,
  registerNotifeeBackgroundHandler,
} from './src/services/fcmService';

registerFCMBackgroundHandler();

registerNotifeeBackgroundHandler(data => {
  // Navigate when user taps a notification while app was terminated
  // Use your static navigation ref here
  if (data?.postId) {
    // navigationRef.current?.navigate('Post', { postId: data.postId });
  }
});

AppRegistry.registerComponent(appName, () => App);
