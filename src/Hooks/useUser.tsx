import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { IUser, IUserContext } from '../interfaces/IUser';
import { useActiveUserPresence } from '../helper/useActiveUserPresence';

const UserContext = createContext<IUserContext | undefined>(undefined);

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IUser | undefined>(undefined);
  const [loadingSession, setLoadingSession] = useState(true);

  useActiveUserPresence(user);
  // Load user from AsyncStorage
  const loadUser = async () => {
    try {
      const json = await AsyncStorage.getItem('userData');
      if (json) {
        setUser(JSON.parse(json) as IUser);
      }
    } catch (error) {
      console.warn('Failed to load user data', error);
    } finally {
      setLoadingSession(false);
    }
  };

  // Save user to AsyncStorage whenever it changes
  const saveUser = async (userData: IUser) => {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
      console.warn('Failed to save user data', error);
    }
  };

  // Load user once on mount
  useEffect(() => {
    void loadUser();
  }, []);

  // Save whenever user changes
  useEffect(() => {
    if (user) {
      void saveUser(user);
    }
  }, [user]);

  const value = useMemo(() => ({ user, setUser, loadingSession }), [user, loadingSession]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
