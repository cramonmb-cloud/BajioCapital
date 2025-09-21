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
import { doc, getDoc } from 'firebase/firestore';
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
        // User is signed in, now get their profile from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setAppUser({ id: userDocSnap.id, ...userDocSnap.data() } as AppUser);
        } else {
          // This case can happen if a user exists in Auth but not in Firestore.
          // You might want to handle this, e.g., by creating a default profile.
          console.warn("User exists in Auth but not in Firestore.");
          setAppUser(null);
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
