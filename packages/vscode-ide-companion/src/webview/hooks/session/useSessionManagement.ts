/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useMemo } from 'react';
import type { VSCodeAPI } from '../../hooks/useVSCode.js';

/**
 * Session management Hook
 * Manages session list, current session, session switching, and search
 */
export const useSessionManagement = (vscode: VSCodeAPI) => {
  const [moliSessions, setMoliSessions] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] =
    useState<string>('Past Conversations');
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const PAGE_SIZE = 20;

  /**
   * Filter session list
   */
  const filteredSessions = useMemo(() => {
    if (!sessionSearchQuery.trim()) {
      return moliSessions;
    }
    const query = sessionSearchQuery.toLowerCase();
    return moliSessions.filter((session) => {
      const title = (
        (session.title as string) ||
        (session.name as string) ||
        ''
      ).toLowerCase();
      return title.includes(query);
    });
  }, [moliSessions, sessionSearchQuery]);

  /**
   * Load session list
   */
  const handleLoadMoliSessions = useCallback(() => {
    // Reset pagination state and load first page
    setMoliSessions([]);
    setNextCursor(undefined);
    setHasMore(true);
    setIsLoading(true);
    vscode.postMessage({ type: 'getMoliSessions', data: { size: PAGE_SIZE } });
    setShowSessionSelector(true);
  }, [vscode]);

  const handleLoadMoreSessions = useCallback(() => {
    if (!hasMore || isLoading || nextCursor === undefined) {
      return;
    }
    setIsLoading(true);
    vscode.postMessage({
      type: 'getMoliSessions',
      data: { cursor: nextCursor, size: PAGE_SIZE },
    });
  }, [hasMore, isLoading, nextCursor, vscode]);

  /**
   * Create new session
   */
  const handleNewMoliSession = useCallback(() => {
    vscode.postMessage({ type: 'openNewChatTab', data: {} });
    setShowSessionSelector(false);
  }, [vscode]);

  /**
   * Switch session
   */
  const handleSwitchSession = useCallback(
    (sessionId: string) => {
      if (sessionId === currentSessionId) {
        console.log('[useSessionManagement] Already on this session, ignoring');
        setShowSessionSelector(false);
        return;
      }

      console.log('[useSessionManagement] Switching to session:', sessionId);
      vscode.postMessage({
        type: 'switchMoliSession',
        data: { sessionId },
      });
    },
    [currentSessionId, vscode],
  );

  return {
    // State
    moliSessions,
    currentSessionId,
    currentSessionTitle,
    showSessionSelector,
    sessionSearchQuery,
    filteredSessions,
    nextCursor,
    hasMore,
    isLoading,

    // State setters
    setMoliSessions,
    setCurrentSessionId,
    setCurrentSessionTitle,
    setShowSessionSelector,
    setSessionSearchQuery,
    setNextCursor,
    setHasMore,
    setIsLoading,

    // Operations
    handleLoadMoliSessions,
    handleNewMoliSession,
    handleSwitchSession,
    handleLoadMoreSessions,
  };
};
