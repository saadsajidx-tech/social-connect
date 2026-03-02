import { getApp } from '@react-native-firebase/app';
import { getFirestore } from '@react-native-firebase/firestore';

const app = getApp();
export const firestore = getFirestore(app);
