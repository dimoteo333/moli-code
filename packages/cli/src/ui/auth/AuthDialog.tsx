/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from '../components/shared/DescriptiveRadioButtonSelect.js';
import { MolimateEmployeeIdInput } from '../components/MolimateEmployeeIdInput.js';
import { MolimateModelSelector } from '../components/MolimateModelSelector.js';
import { MolimateTimerDisplay } from '../components/MolimateTimerDisplay.js';
import { LocalConfigWizard } from '../components/LocalConfigWizard.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { t } from '../../i18n/index.js';
import {
  validateEmployeeId,
  authenticateWithMolimate,
} from '../../services/molimateAuthService.js';
import { fetchRemoteMolimateConfig } from '../../constants/molimateConfig.js';
import { getErrorMessage } from '@dobby/moli-code-core';

// Main menu option type
type MainOption = 'MOLIMATE' | 'LOCAL';

// View level for navigation
type ViewLevel =
  | 'main'
  | 'loading-config'
  | 'molimate-auth'
  | 'molimate-model-select'
  | 'molimate-timer'
  | 'local-config';

export function AuthDialog(): React.JSX.Element {
  const { authError } = useUIState();
  const { handleMolimateAuthSubmit, handleLocalConfigSubmit, onAuthError } =
    useUIActions();
  const config = useConfig();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>('main');
  const [molimateEmployeeId, setMolimateEmployeeId] = useState<string>('');
  const [timerExpired, setTimerExpired] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Main authentication entries (two options)
  const mainItems = [
    {
      key: 'MOLIMATE',
      title: t('Authenticate with Molimate'),
      label: t('Molimate authentication'),
      description: t('Authenticate using employee ID'),
      value: 'MOLIMATE' as MainOption,
    },
    {
      key: 'LOCAL',
      title: t('Run in local environment'),
      label: t('Local environment'),
      description: t('Manual configuration'),
      value: 'LOCAL' as MainOption,
    },
  ];

  const handleMainSelect = async (value: MainOption) => {
    setErrorMessage(null);
    setConfigError(null);
    onAuthError(null);

    setViewLevel('loading-config');

    try {
      await fetchRemoteMolimateConfig();
      if (value === 'MOLIMATE') {
        setViewLevel('molimate-auth');
      } else if (value === 'LOCAL') {
        setViewLevel('local-config');
      }
    } catch (e) {
      setConfigError(
        t('Failed to load remote configuration: {{message}}', {
          message: getErrorMessage(e),
        }),
      );
      setViewLevel('main');
    }
  };

  const handleMolimateEmployeeIdSubmit = async (employeeId: string) => {
    setErrorMessage(null);
    onAuthError(null);

    // Only validate format locally - HTTP validation happens after model selection
    if (!validateEmployeeId(employeeId)) {
      setErrorMessage(
        t('Employee ID must contain only alphanumeric characters.'),
      );
      return;
    }

    setMolimateEmployeeId(employeeId);
    setViewLevel('molimate-model-select');
  };

  const handleMolimateModelSelection = async (model: string) => {
    setViewLevel('molimate-timer');
    setTimerExpired(false);
    setErrorMessage(null);

    // Make HTTP call to Molimate API with 120-second timeout
    const authResponse = await authenticateWithMolimate(molimateEmployeeId);
    if (!authResponse.success) {
      setTimerExpired(true);
      setErrorMessage(authResponse.message || t('Authentication failed.'));
      return;
    }

    // On success, save settings and complete authentication
    await handleMolimateAuthSubmit(molimateEmployeeId, model);
  };

  const handleTimerTimeout = () => {
    setTimerExpired(true);
    setErrorMessage(t('Time expired.'));
  };

  const handleTimerCancel = () => {
    setViewLevel('molimate-model-select');
    setTimerExpired(false);
    setErrorMessage(null);
  };

  const handleLocalConfigWizardSubmit = async (
    values: import('../components/LocalConfigWizard.js').LocalConfigValues,
  ) => {
    await handleLocalConfigSubmit(values);
  };

  const handleGoBack = () => {
    setErrorMessage(null);
    onAuthError(null);

    switch (viewLevel) {
      case 'loading-config':
      case 'molimate-auth':
      case 'local-config':
        setViewLevel('main');
        break;
      case 'molimate-model-select':
        setViewLevel('molimate-auth');
        break;
      case 'molimate-timer':
        if (!timerExpired) {
          setViewLevel('molimate-model-select');
        } else {
          setViewLevel('main');
          setTimerExpired(false);
        }
        break;
      default:
        setViewLevel('main');
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (viewLevel !== 'main') {
          handleGoBack();
          return;
        }

        if (errorMessage) {
          return;
        }
        if (config.getAuthType() === undefined) {
          setErrorMessage(
            t(
              'You must select an authentication method. Press Ctrl+C again to exit.',
            ),
          );
          return;
        }
      }
    },
    { isActive: true },
  );

  // Render main auth selection
  const renderMainView = () => (
    <>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={mainItems}
          initialIndex={0}
          onSelect={handleMainSelect}
          itemGap={1}
        />
      </Box>
    </>
  );

  // Render Molimate employee ID input
  const renderMolimateAuthView = () => (
    <Box marginTop={1}>
      <MolimateEmployeeIdInput
        onSubmit={handleMolimateEmployeeIdSubmit}
        onCancel={handleGoBack}
      />
    </Box>
  );

  // Render Molimate model selector
  const renderMolimateModelSelectView = () => (
    <Box marginTop={1}>
      <MolimateModelSelector
        onSelect={handleMolimateModelSelection}
        onCancel={handleGoBack}
      />
    </Box>
  );

  // Render Molimate timer display
  const renderMolimateTimerView = () => (
    <Box marginTop={1}>
      <MolimateTimerDisplay
        onTimeout={handleTimerTimeout}
        onCancel={handleTimerCancel}
        initialSeconds={120}
        message={t('Authenticating...')}
      />
    </Box>
  );

  // Render loading config state
  const renderLoadingConfigView = () => (
    <Box marginTop={1}>
      <Text color={theme.text.secondary}>
        {t('Fetching remote configuration...')}
      </Text>
    </Box>
  );

  // Render local config wizard
  const renderLocalConfigView = () => (
    <Box marginTop={1}>
      <LocalConfigWizard
        onSubmit={handleLocalConfigWizardSubmit}
        onCancel={handleGoBack}
      />
    </Box>
  );

  const getViewTitle = () => {
    switch (viewLevel) {
      case 'main':
        return t('Select authentication method');
      case 'loading-config':
        return t('Loading configuration...');
      case 'molimate-auth':
        return t('Molimate authentication');
      case 'molimate-model-select':
        return t('Select Model');
      case 'molimate-timer':
        return t('Authenticating...');
      case 'local-config':
        return t('Local environment setup');
      default:
        return t('Select authentication method');
    }
  };

  return (
    <Box
      borderStyle="single"
      borderColor={theme?.border?.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{getViewTitle()}</Text>

      {viewLevel === 'main' && renderMainView()}
      {viewLevel === 'loading-config' && renderLoadingConfigView()}
      {viewLevel === 'molimate-auth' && renderMolimateAuthView()}
      {viewLevel === 'molimate-model-select' && renderMolimateModelSelectView()}
      {viewLevel === 'molimate-timer' && renderMolimateTimerView()}
      {viewLevel === 'local-config' && renderLocalConfigView()}

      {(authError || errorMessage || configError) && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>
            {authError || errorMessage || configError}
          </Text>
        </Box>
      )}

      {viewLevel === 'main' && (
        <>
          <Box marginY={1}>
            <Text color={theme.border.default}>{'\u2500'.repeat(80)}</Text>
          </Box>
          <Box>
            <Text color={theme.text.primary}>
              {t('Terms of Service and Privacy Policy')}:
            </Text>
          </Box>
          <Box>
            <Text color={theme.text.secondary} underline>
              {t('For more details, please visit the MoliCode homepage.')}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
