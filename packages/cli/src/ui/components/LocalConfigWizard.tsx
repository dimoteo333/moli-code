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
import { Colors } from '../colors.js';

export interface LocalConfigValues {
  moli3CoderApiKey: string;
  gptOss120bApiKey: string;
  baseUrl: string;
}

interface LocalConfigWizardProps {
  onSubmit: (values: LocalConfigValues) => void;
  onCancel: () => void;
}

type WizardStep = 'moli-api-key' | 'gpt-api-key' | 'base-url' | 'confirm';

const DEFAULT_BASE_URL = 'https://testai.apitest.com/compatible-mode/v1';

export function LocalConfigWizard({
  onSubmit,
  onCancel,
}: LocalConfigWizardProps): React.JSX.Element {
  const [step, setStep] = useState<WizardStep>('moli-api-key');
  const [moli3CoderApiKey, setMoli3CoderApiKey] = useState('');
  const [gptOss120bApiKey, setGptOss120bApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [error, setError] = useState<string | null>(null);

  const goToNextStep = () => {
    setError(null);

    switch (step) {
      case 'moli-api-key':
        if (!moli3CoderApiKey.trim()) {
          setError(t('API key for Moli3-Coder is required.'));
          return;
        }
        setStep('gpt-api-key');
        break;
      case 'gpt-api-key':
        setStep('base-url');
        break;
      case 'base-url':
        setStep('confirm');
        break;
      case 'confirm':
        onSubmit({
          moli3CoderApiKey: moli3CoderApiKey.trim(),
          gptOss120bApiKey: gptOss120bApiKey.trim(),
          baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
        });
        break;
      default:
        break;
    }
  };

  const goToPreviousStep = () => {
    setError(null);

    switch (step) {
      case 'moli-api-key':
        onCancel();
        break;
      case 'gpt-api-key':
        setStep('moli-api-key');
        break;
      case 'base-url':
        setStep('gpt-api-key');
        break;
      case 'confirm':
        setStep('base-url');
        break;
      default:
        break;
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        goToPreviousStep();
      } else if (key.name === 'return') {
        goToNextStep();
      }
    },
    { isActive: true },
  );

  const renderStep = () => {
    switch (step) {
      case 'moli-api-key':
        return (
          <>
            <Box marginTop={1}>
              <Text color={theme.text.primary}>
                {t('Step 1: Enter API key for Moli3-Coder (required)')}
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={moli3CoderApiKey}
                onChange={setMoli3CoderApiKey}
                placeholder="sk-cj-..."
              />
            </Box>
            <Box marginTop={1}>
              <Text color={theme.text.secondary}>
                {t('Enter to continue, Esc to go back')}
              </Text>
            </Box>
          </>
        );

      case 'gpt-api-key':
        return (
          <>
            <Box marginTop={1}>
              <Text color={theme.text.primary}>
                {t('Step 2: Enter API key for GPT-OSS-120B (optional)')}
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={gptOss120bApiKey}
                onChange={setGptOss120bApiKey}
                placeholder="sk-ei-... (leave empty to skip)"
              />
            </Box>
            <Box marginTop={1}>
              <Text color={theme.text.secondary}>
                {t('Enter to continue, Esc to go back')}
              </Text>
            </Box>
          </>
        );

      case 'base-url':
        return (
          <>
            <Box marginTop={1}>
              <Text color={theme.text.primary}>
                {t('Step 3: Enter Base URL (optional)')}
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={baseUrl}
                onChange={setBaseUrl}
                placeholder={DEFAULT_BASE_URL}
              />
            </Box>
            <Box marginTop={1}>
              <Text color={theme.text.secondary}>
                {t('Default: {{defaultUrl}}', { defaultUrl: DEFAULT_BASE_URL })}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color={theme.text.secondary}>
                {t('Enter to continue, Esc to go back')}
              </Text>
            </Box>
          </>
        );

      case 'confirm':
        return (
          <>
            <Box marginTop={1}>
              <Text color={theme.text.primary} bold>
                {t('Confirm Configuration')}
              </Text>
            </Box>

            <Box marginTop={1} flexDirection="column">
              <Text color={Colors.AccentGreen}>
                {t('Moli3-Coder API Key:')} {moli3CoderApiKey.slice(0, 10)}...
              </Text>
              <Text color={Colors.AccentGreen}>
                {t('GPT-OSS-120B API Key:')}{' '}
                {gptOss120bApiKey
                  ? `${gptOss120bApiKey.slice(0, 10)}...`
                  : t('(not set)')}
              </Text>
              <Text color={Colors.AccentGreen}>
                {t('Base URL:')} {baseUrl || DEFAULT_BASE_URL}
              </Text>
            </Box>

            <Box marginTop={1}>
              <Text color={theme.text.secondary}>
                {t('Enter to save configuration, Esc to go back')}
              </Text>
            </Box>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>{t('Local Environment Configuration')}</Text>
      </Box>

      {renderStep()}

      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}
    </Box>
  );
}
