/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from './shared/TextInput.js';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';

interface MolimateEmployeeIdInputProps {
  onSubmit: (employeeId: string) => void;
  onCancel: () => void;
}

/**
 * Validate employee ID format (alphanumeric only)
 * @param employeeId - The employee ID to validate
 * @returns true if valid, false otherwise
 */
function validateEmployeeId(employeeId: string): boolean {
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(employeeId);
}

export function MolimateEmployeeIdInput({
  onSubmit,
  onCancel,
}: MolimateEmployeeIdInputProps): React.JSX.Element {
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onCancel();
      } else if (key.name === 'return') {
        const trimmedId = employeeId.trim();

        if (!trimmedId) {
          setError(t('행번을 입력해주세요.'));
          return;
        }

        if (!validateEmployeeId(trimmedId)) {
          setError(t('행번은 영문과 숫자로만 구성되어야 합니다.'));
          return;
        }

        // Submit the employee ID (format already validated)
        setError(null);
        onSubmit(trimmedId);
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {t('행번을 입력해 몰리메이트를 인증하세요.')}
        </Text>
      </Box>

      <Box marginTop={1}>
        <TextInput
          value={employeeId}
          onChange={setEmployeeId}
          placeholder="e.g., 23100613"
        />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter를 눌러 제출, Esc를 눌러 뒤로 가기')}
        </Text>
      </Box>
    </Box>
  );
}
