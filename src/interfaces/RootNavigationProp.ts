import { NavigatorScreenParams } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Home: NavigatorScreenParams<HomeTabParamList>;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type HomeTabParamList = {
  Feed: undefined;
  Search: undefined;
  CreatePost: undefined;
  Notifications: undefined;
  Profile: { userId?: string };
};

export type HomeStackParamList = {
  HomeTabs: NavigatorScreenParams<HomeTabParamList>;
  PostDetail: { postId: string };
  UserProfile: { userId: string };
  EditProfile: undefined;
  Settings: undefined;
  Followers: { userId: string };
  Following: { userId: string };
  LikedBy: { postId: string };
  ChangePassword: undefined;
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type AuthNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type HomeTabNavigationProp = BottomTabNavigationProp<HomeTabParamList>;
export type HomeStackNavigationProp = NativeStackNavigationProp<HomeStackParamList>;

export type SignInScreenProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;
export type SignUpScreenProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;
export type ForgotPasswordScreenProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

export type FeedScreenProp = BottomTabNavigationProp<HomeTabParamList, 'Feed'> &
  NativeStackNavigationProp<HomeStackParamList>;
export type SearchScreenProp = BottomTabNavigationProp<HomeTabParamList, 'Search'> &
  NativeStackNavigationProp<HomeStackParamList>;
export type CreatePostScreenProp = BottomTabNavigationProp<HomeTabParamList, 'CreatePost'> &
  NativeStackNavigationProp<HomeStackParamList>;
export type NotificationsScreenProp = BottomTabNavigationProp<HomeTabParamList, 'Notifications'> &
  NativeStackNavigationProp<HomeStackParamList>;
export type ProfileScreenProp = BottomTabNavigationProp<HomeTabParamList, 'Profile'> &
  NativeStackNavigationProp<HomeStackParamList>;

export type PostDetailScreenProp = NativeStackNavigationProp<HomeStackParamList, 'PostDetail'>;
export type UserProfileScreenProp = NativeStackNavigationProp<HomeStackParamList, 'UserProfile'>;
export type EditProfileScreenProp = NativeStackNavigationProp<HomeStackParamList, 'EditProfile'>;
export type SettingsScreenProp = NativeStackNavigationProp<HomeStackParamList, 'Settings'>;
