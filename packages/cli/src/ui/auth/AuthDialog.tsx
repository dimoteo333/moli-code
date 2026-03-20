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
import { validateEmployeeId , authenticateWithMolimate } from '../../services/molimateAuthService.js';

// Main menu option type
type MainOption = 'MOLIMATE' | 'LOCAL';

// View level for navigation
type ViewLevel =
  | 'main'
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

  // Main authentication entries (two options)
  const mainItems = [
    {
      key: 'MOLIMATE',
      title: t('몰리메이트로 인증'),
      label: t('몰리메이트 인증'),
      description: t('사번을 입력하여 인증'),
      value: 'MOLIMATE' as MainOption,
    },
    {
      key: 'LOCAL',
      title: t('로컬 환경에서 실행'),
      label: t('로컬 환경'),
      description: t('수동 설정'),
      value: 'LOCAL' as MainOption,
    },
  ];

  const handleMainSelect = async (value: MainOption) => {
    setErrorMessage(null);
    onAuthError(null);

    if (value === 'MOLIMATE') {
      setViewLevel('molimate-auth');
      return;
    }

    if (value === 'LOCAL') {
      setViewLevel('local-config');
      return;
    }
  };

  const handleMolimateEmployeeIdSubmit = async (employeeId: string) => {
    setErrorMessage(null);
    onAuthError(null);

    // Only validate format locally - HTTP validation happens after model selection
    if (!validateEmployeeId(employeeId)) {
      setErrorMessage(t('행번은 영문과 숫자로만 구성되어야 합니다.'));
      return;
    }

    setMolimateEmployeeId(employeeId);
    setViewLevel('molimate-model-select');
  };

  const handleMolimateModelSelection = async (
    model: 'qwen3-coder' | 'gpt-oss-120b',
  ) => {
    setViewLevel('molimate-timer');
    setTimerExpired(false);
    setErrorMessage(null);

    // Make HTTP call to Molimate API with 120-second timeout
    const authResponse = await authenticateWithMolimate(molimateEmployeeId);
    if (!authResponse.success) {
      setTimerExpired(true);
      setErrorMessage(authResponse.message || t('인증에 실패했습니다.'));
      return;
    }

    // On success, save settings and complete authentication
    await handleMolimateAuthSubmit(molimateEmployeeId, model);
  };

  const handleTimerTimeout = () => {
    setTimerExpired(true);
    setErrorMessage(t('시간이 초과되었습니다.'));
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
              '인증 방식을 선택해야 합니다. 계속하려면 Ctrl+C를 다시 누르세요.',
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
        message={t('인증 중...')}
      />
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
        return t('인증 방식 선택');
      case 'molimate-auth':
        return t('몰리메이트 인증');
      case 'molimate-model-select':
        return t('모델 선택');
      case 'molimate-timer':
        return t('인증 중...');
      case 'local-config':
        return t('로컬 환경 설정');
      default:
        return t('인증 방식 선택');
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
      {viewLevel === 'molimate-auth' && renderMolimateAuthView()}
      {viewLevel === 'molimate-model-select' && renderMolimateModelSelectView()}
      {viewLevel === 'molimate-timer' && renderMolimateTimerView()}
      {viewLevel === 'local-config' && renderLocalConfigView()}

      {(authError || errorMessage) && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{authError || errorMessage}</Text>
        </Box>
      )}

      {viewLevel === 'main' && (
        <>
          <Box marginY={1}>
            <Text color={theme.border.default}>{'\u2500'.repeat(80)}</Text>
          </Box>
          <Box>
            <Text color={theme.text.primary}>
              {t('이용약관 및 개인정보처리방침')}:
            </Text>
          </Box>
          <Box>
            <Text color={theme.text.secondary} underline>
              자세한 내용은 몰리코드 홈페이지에서 확인하세요.
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
