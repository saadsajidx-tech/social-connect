import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Home, Search, MessageCircle, User, Zap } from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../utilities/theme';

const { width } = Dimensions.get('window');

const TABS = [
  { key: 'TabHome', Icon: Home, label: 'Home' },
  { key: 'TabSearch', Icon: Search, label: 'Search' },
  { key: 'TabMyPosts', Icon: null, label: '' },
  { key: 'TabDisplayChats', Icon: MessageCircle, label: 'Chats' },
  { key: 'TabProfile', Icon: User, label: 'Profile' },
];

interface CustomTabBarProps {
  state: { index: number; routes: { name: string }[] };
  navigation: any;
}

const CustomTabBar = ({ state, navigation }: CustomTabBarProps) => {
  const activeRoute = state.routes[state.index]?.name;
  const notifCount = 3; // Static UI placeholder

  return (
    <View style={styles.wrapper}>
      {/* Blur/Gradient background */}
      <LinearGradient
        colors={['rgba(8,8,15,0)', 'rgba(8,8,15,0.97)', Colors.bg.primary]}
        style={styles.backgroundGradient}
      />

      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)']}
          style={styles.tabBar}>
          {TABS.map((tab, index) => {
            // Center FAB Button
            if (tab.key === 'TabMyPosts') {
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.fabWrapper}
                  onPress={() => navigation.navigate('TabMyPosts')}
                  activeOpacity={0.85}>
                  <LinearGradient
                    colors={['#7C3AED', '#9D6FFF', '#00E5C3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fabBtn}>
                    <Zap size={22} color={Colors.white} fill={Colors.white} />
                  </LinearGradient>
                  <View style={styles.fabGlow} />
                </TouchableOpacity>
              );
            }

            const isActive = activeRoute === tab.key;
            const TabIcon = tab.Icon!;

            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabBtn}
                onPress={() => navigation.navigate(tab.key)}
                activeOpacity={0.7}>
                {/* Active indicator background */}
                {isActive && (
                  <View style={styles.activeIndicator}>
                    <LinearGradient
                      colors={['rgba(124,58,237,0.2)', 'rgba(124,58,237,0.05)']}
                      style={styles.activeIndicatorGrad}
                    />
                  </View>
                )}

                {/* Icon + Badge */}
                <View style={styles.iconWrapper}>
                  <TabIcon
                    size={22}
                    color={isActive ? Colors.primaryLight : Colors.text.tertiary}
                    fill={isActive ? Colors.primaryLight : 'none'}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  {tab.key === 'Notifications' && notifCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{notifCount}</Text>
                    </View>
                  )}
                </View>

                {/* Label */}
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>

                {/* Active Dot */}
                {isActive && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </LinearGradient>
      </View>
    </View>
  );
};

export default CustomTabBar;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 24 : 0,
  },
  backgroundGradient: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    ...Shadow.medium,
  },

  // Regular Tab
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '10%',
    right: '10%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  activeIndicatorGrad: {
    flex: 1,
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.tertiary,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.primaryLight,
    fontWeight: '700',
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight,
  },

  // FAB
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  fabBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    ...Shadow.brand,
  },
  fabGlow: {
    position: 'absolute',
    top: -4,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(124,58,237,0.25)',
    zIndex: -1,
    marginTop: -14,
  },
});
