'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { firebaseConfig } from '@/firebase/config';

export function FirebaseConfigChecker() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If apiKey is empty and we are not on the installation page, redirect
    if (!firebaseConfig.apiKey && pathname !== '/instalacionnueva') {
      router.push('/instalacionnueva');
    }
  }, [pathname, router]);

  return null;
}
