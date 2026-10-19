import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { 
  initAuthListener, signInWithGoogle, logOut, 
  saveVisitedProvincesToCloud, loadVisitedProvincesFromCloud
} from '../lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  effectiveUserId: string;
  isAnonymous: boolean;
  isCloudReady: boolean;
  isSyncing: boolean;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  syncVisitedToCloud: (provinces: string[]) => Promise<void>;
  fetchVisitedFromCloud: () => Promise<string[] | null>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  effectiveUserId: '',
  isAnonymous: true,
  isCloudReady: false,
  isSyncing: false,
  signInGoogle: async () => {},
  signOutUser: async () => {},
  syncVisitedToCloud: async () => {},
  fetchVisitedFromCloud: async () => null,
  continueAsGuest: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCloudReady, setIsCloudReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  const effectiveUserId = currentUser && !currentUser.isAnonymous 
    ? currentUser.uid 
    : isGuest 
    ? 'guest-local' 
    : '';

  useEffect(() => {
    // Restore the signed-in account.
    const unsubscribe = initAuthListener((user) => {
      setCurrentUser(user && !user.isAnonymous ? user : null);
      setIsCloudReady(true);
    });

    return () => unsubscribe();
  }, []);

  const continueAsGuest = () => {
    setIsGuest(true);
  };

  const signInGoogle = async () => {
    setIsSyncing(true);
    try {
      await signInWithGoogle();
      setIsGuest(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const signOutUser = async () => {
    setIsSyncing(true);
    try {
      await logOut();
      setCurrentUser(null);
      setIsGuest(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncVisitedToCloud = async (provinces: string[]) => {
    if (!effectiveUserId || isGuest) return;
    setIsSyncing(true);
    try {
      await saveVisitedProvincesToCloud(effectiveUserId, provinces);
    } finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  const fetchVisitedFromCloud = async () => {
    if (!effectiveUserId || isGuest) return null;
    return await loadVisitedProvincesFromCloud(effectiveUserId);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        effectiveUserId,
        isAnonymous: !currentUser,
        isCloudReady,
        isSyncing,
        signInGoogle,
        signOutUser,
        syncVisitedToCloud,
        fetchVisitedFromCloud,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
