import React from 'react';

import { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BottomTabs, { type BottomTabParamList } from './BottomTabs';
import EditProfile from '../screens/app/profile/EditProfile';
import PostDetail from '../screens/app/createPost/PostDetail';
import NotificationSettings from '../screens/app/notifications/NotificationSettings';
import Settings from '../screens/app/profile/Settings';
import ChatMessages from '../screens/app/messages/ChatMessages';
import ViewUserProfile from '../screens/app/search/ViewUserProfile';
import WritePost from '../screens/app/createPost/WritePost';
import Notifications from '../screens/app/notifications/Notifications';
import NewChat from '../screens/app/messages/NewChat';
import { Colors } from '../utilities/theme';
import ChangePassword from '../screens/app/profile/ChangePassword';

export type HomeStackParamList = {
  BottomTabs: NavigatorScreenParams<BottomTabParamList>;
  PostDetail: {
    postId: string;
  };
  WritePost: { postId?: string } | undefined;
  MyPosts: undefined;
  NotificationSettings: undefined;
  EditProfile: undefined;
  Settings: undefined;
  ChangePassword: undefined;

  Notifications: undefined;
  ChatMessages: {
    targetUserId: string;
  };
  NewChat: undefined;

  ViewUserProfile: { userId: string };
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const HomeStackNavigator = () => {
  return (
    <HomeStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg.primary } }}>
      <HomeStack.Screen name="BottomTabs" component={BottomTabs} />
      <HomeStack.Screen name="PostDetail" component={PostDetail} />
      <HomeStack.Screen name="WritePost" component={WritePost} />
      <HomeStack.Screen name="NotificationSettings" component={NotificationSettings} />
      <HomeStack.Screen name="EditProfile" component={EditProfile} />
      <HomeStack.Screen name="Settings" component={Settings} />
      <HomeStack.Screen name="ChangePassword" component={ChangePassword} />
      <HomeStack.Screen name="Notifications" component={Notifications} />
      <HomeStack.Screen name="ChatMessages" component={ChatMessages} />
      <HomeStack.Screen name="NewChat" component={NewChat} />
      <HomeStack.Screen name="ViewUserProfile" component={ViewUserProfile} />
    </HomeStack.Navigator>
  );
};

export default HomeStackNavigator;
