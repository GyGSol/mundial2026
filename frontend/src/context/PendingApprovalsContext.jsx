import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { competitionGroupsApi } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const PendingApprovalsContext = createContext(null);

export function PendingApprovalsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    try {
      const data = await competitionGroupsApi.pendingApprovalCount();
      setCount(Number(data.count) || 0);
    } catch {
      setCount(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);

  return (
    <PendingApprovalsContext.Provider value={value}>{children}</PendingApprovalsContext.Provider>
  );
}

export function usePendingApprovals() {
  const ctx = useContext(PendingApprovalsContext);
  if (!ctx) {
    throw new Error('usePendingApprovals must be used within PendingApprovalsProvider');
  }
  return ctx;
}
