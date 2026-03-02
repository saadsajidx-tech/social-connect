import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SignIn from '../screens/auth/SignIn';
import SignUp from '../screens/auth/SignUp';
import ForgetPassword from '../screens/auth/ForgetPassword';
import { Colors } from '../utilities/theme';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgetPassword: undefined;
};
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg.primary } }}>
      <AuthStack.Screen name="SignIn" component={SignIn} />
      <AuthStack.Screen name="SignUp" component={SignUp} />
      <AuthStack.Screen name="ForgetPassword" component={ForgetPassword} />
    </AuthStack.Navigator>
  );
};
export default AuthNavigator;
