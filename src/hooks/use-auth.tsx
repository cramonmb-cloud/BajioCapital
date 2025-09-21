'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  type User 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { saveUserAction } from '@/app/dashboard/settings/actions';
import type { AppUser } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signUp: (email: string, password: string, role: 'admin' | 'supervisor', username: string, permissions: AppUser['permissions']) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setAppUser({ id: userDocSnap.id, ...userDocSnap.data() } as AppUser);
        } else {
          // User exists in Auth but not Firestore. Create a profile for them.
          // This is a failsafe for the first user or desynchronized users.
          console.warn("User exists in Auth but not in Firestore. Creating a default admin profile.");
          const username = user.email?.split('@')[0] || 'admin';
          const defaultAdminPermissions: AppUser['permissions'] = {
            dashboard: true,
            clients: true,
            loans: true,
            wallet: true,
            plans: true,
            settings: true,
          };
          const newAppUser: Omit<AppUser, 'id'> = {
            username: username.charAt(0).toUpperCase() + username.slice(1),
            role: 'admin',
            permissions: defaultAdminPermissions,
          };
          
          await setDoc(userDocRef, newAppUser);
          setAppUser({ id: user.uid, ...newAppUser });
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, role: 'admin' | 'supervisor', username: string, permissions: AppUser['permissions']) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;
    
    // After creating the user in Auth, save their details to Firestore
    await saveUserAction(uid, { username, role, permissions });

    return userCredential;
  };

  const signIn = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = () => {
    return firebaseSignOut(auth).then(() => {
        router.push('/login');
    });
  };

  const value = {
    user,
    appUser,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
