'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useCanvasStore } from '@/lib/store';

/**
 * BETA-06: On every page, point browser persistence at the signed-in account
 * as soon as the session is available. This keeps the active-namespace marker
 * current (so the browser extension can name-scope its imports) and clears any
 * pending import data from a previous account on sign-out / account switch.
 */
export function PersistenceBoundary() {
  const { data: session, status } = useSession();
  const setUserContext = useCanvasStore((state) => state.setUserContext);

  useEffect(() => {
    // Only apply a concrete namespace once the session is resolved so we never
    // clobber a signed-in account's context with the anonymous one mid-load.
    if (status === 'loading') return;
    setUserContext(session?.user?.id ?? null);
  }, [status, session?.user?.id, setUserContext]);

  return null;
}