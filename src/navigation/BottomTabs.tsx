import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import TabHome from '../screens/app/home/TabHome';
import TabSearch from '../screens/app/search/TabSearch';
import TabProfile from '../screens/app/profile/TabProfile';
import CustomTabBar from '../component/common/Customtabbar';
import TabMyPosts from '../screens/app/createPost/TabMyPosts';
import TabDisplayChats from '../screens/app/messages/TabDisplayChats';

export type BottomTabParamList = {
  TabHome: undefined;
  TabSearch: undefined;
  TabMyPosts: undefined;
  TabDisplayChats: undefined;
  TabProfile: {
    userId?: string;
  };
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const BottomTabs = () => {
  return (
    <Tab.Navigator
      initialRouteName="TabHome"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={props => <CustomTabBar {...props} />}>
      <Tab.Screen name="TabHome" component={TabHome} />
      <Tab.Screen name="TabSearch" component={TabSearch} />
      <Tab.Screen name="TabMyPosts" component={TabMyPosts} />
      <Tab.Screen name="TabDisplayChats" component={TabDisplayChats} />
      <Tab.Screen name="TabProfile" component={TabProfile} />
    </Tab.Navigator>
  );
};

export default BottomTabs;
