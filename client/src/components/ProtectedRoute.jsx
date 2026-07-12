"use client";

import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, onboarding } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (
      !loading &&
      isAuthenticated &&
      onboarding?.required &&
      pathname !== "/app/onboarding"
    ) {
      router.push("/app/onboarding");
    }
  }, [isAuthenticated, loading, onboarding?.required, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (onboarding?.required && pathname !== "/app/onboarding") {
    return null;
  }

  return children;
};

export default ProtectedRoute;
