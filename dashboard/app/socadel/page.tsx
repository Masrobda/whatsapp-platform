'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SocadelIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/socadel/login');
  }, [router]);
  return null;
}
