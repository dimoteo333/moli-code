/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';

interface MolimateTimerDisplayProps {
  onTimeout: () => void;
  onCancel: () => void;
  initialSeconds?: number;
  message?: string;
}

const DEFAULT_TIMER_SECONDS = 120; // 2 minutes

/**
 * Timer display component with countdown functionality
 * Based on MoliOAuthProgress.tsx timer pattern
 */
export function MolimateTimerDisplay({
  onTimeout,
  onCancel,
  initialSeconds = DEFAULT_TIMER_SECONDS,
  message,
}: MolimateTimerDisplayProps): React.JSX.Element {
  const [timeRemaining, setTimeRemaining] = useState<number>(initialSeconds);
  const [dots, setDots] = useState<string>('');
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useKeypress(
    (key) => {
      if (hasTimedOut) {
        // Any key press in timeout state should trigger cancel to return to auth dialog
        onCancel();
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        onCancel();
      }
    },
    { isActive: true },
  );

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          onTimeout();
          setHasTimedOut(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeout]);

  // Animated dots
  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(dotsTimer);
  }, []);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle timeout state
  if (hasTimedOut) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.AccentRed}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={Colors.AccentRed}>
          {t('Time has expired.')}
        </Text>

        <Box marginTop={1}>
          <Text>
            {t('The authentication session has expired. Please try again.')}
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color={Colors.Gray}>
            {t('Press any key to return to authentication type selection.')}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Box marginTop={1}>
        <Text>
          <Spinner type="dots" /> {message || t('Processing')}
          {dots}
        </Text>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Text color={Colors.Gray}>
          {t('Time remaining:')} {formatTime(timeRemaining)}
        </Text>
        <Text color={Colors.AccentPurple}>{t('(Press ESC to cancel)')}</Text>
      </Box>
    </Box>
  );
}
