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
  modelName: string;
  apiKey: string;
  baseUrl: string;
}

interface LocalConfigWizardProps {
  onSubmit: (values: LocalConfigValues) => void;
  onCancel: () => void;
}

type WizardStep = 'model-name' | 'api-key' | 'base-url' | 'confirm';

const DEFAULT_BASE_URL = 'https://testai.apitest.com/compatible-mode/v1';

export function LocalConfigWizard({
  onSubmit,
  onCancel,
}: LocalConfigWizardProps): React.JSX.Element {
  const [step, setStep] = useState<WizardStep>('model-name');
  const [modelName, setModelName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [error, setError] = useState<string | null>(null);

  const goToNextStep = () => {
    setError(null);

    switch (step) {
      case 'model-name':
        if (!modelName.trim()) {
          setError(t('Model name is required.'));
          return;
        }
        setApiKey('');
        setStep('api-key');
        break;
      case 'api-key':
        if (!apiKey.trim()) {
          setError(t('API key is required.'));
          return;
        }
        setBaseUrl(DEFAULT_BASE_URL);
        setStep('base-url');
        break;
      case 'base-url':
        setStep('confirm');
        break;
      case 'confirm':
        onSubmit({
          modelName: modelName.trim(),
          apiKey: apiKey.trim(),
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
      case 'model-name':
        onCancel();
        break;
      case 'api-key':
        setStep('model-name');
        break;
      case 'base-url':
        setStep('api-key');
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
      case 'model-name':
        return (
          <>
            <Box marginTop={1}>
              <Text color={theme.text.primary}>
                {t('Step 1: Enter model name (required)')}
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={modelName}
                onChange={setModelName}
                placeholder="e.g. share-Qwen3-Coder-30B-A3"
              />
            </Box>
            <Box marginTop={1}>
              <Text color={theme.text.secondary}>
                {t('Enter to continue, Esc to go back')}
              </Text>
            </Box>
          </>
        );

      case 'api-key':
        return (
          <>
            <Box marginTop={1}>
              <Text color={theme.text.primary}>
                {t('Step 2: Enter API key (required)')}
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={apiKey}
                onChange={setApiKey}
                placeholder="sk-..."
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
                {t('Model Name:')} {modelName}
              </Text>
              <Text color={Colors.AccentGreen}>
                {t('API Key:')} {apiKey.slice(0, 10)}...
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
