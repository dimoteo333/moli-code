/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { AuthType } from '@dobby/moli-code-core';
import { Box, Text } from 'ink';
import Link from 'ink-link';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from '../components/shared/DescriptiveRadioButtonSelect.js';
import { TextInput } from '../components/shared/TextInput.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

type MainOption = 'MOLIMATE' | 'LOCAL_ENV';
type ViewLevel = 'main' | 'molimate-auth' | 'molimate-timer' | 'local-env';

export function AuthDialog(): React.JSX.Element {
  const { handleAuthSelect: onAuthSelect, handleLocalEnvSetup } = useUIActions();
  // We may not use config directly but keep it to respect signatures if needed
  // const config = useConfig();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>('main');

  // Molimate Auth State
  const [employeeId, setEmployeeId] = useState('');
  const [timerCountdown, setTimerCountdown] = useState(120);

  // Local Env State
  const [localEnvStep, setLocalEnvStep] = useState(0); // 0 = baseUrl, 1 = modelName, 2 = apiKey
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [apiKey, setApiKey] = useState('');

  const mainItems = [
    {
      key: 'MOLIMATE',
      title: '몰리메이트 인증',
      label: '몰리메이트 인증',
      description: '행번을 입력하여 로그인하세요',
      value: 'MOLIMATE' as MainOption,
    },
    {
      key: 'LOCAL_ENV',
      title: '로컬 환경에서 실행',
      label: '로컬 환경에서 실행',
      description: '로컬 설정을 구성하세요',
      value: 'LOCAL_ENV' as MainOption,
    },
  ];

  const handleMainSelect = async (value: MainOption) => {
    setErrorMessage(null);
    if (value === 'MOLIMATE') {
      setViewLevel('molimate-auth');
    } else if (value === 'LOCAL_ENV') {
      setViewLevel('local-env');
    }
  };

  const handleGoBack = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setViewLevel('main');
    setEmployeeId('');
    setLocalEnvStep(0);
    setBaseUrl('');
    setModelName('');
    setApiKey('');
    setTimerCountdown(120);
  };

  useKeypress((key) => {
    if (key.name === 'escape') {
      if (viewLevel !== 'main') {
        handleGoBack();
        return;
      }
      if (errorMessage || successMessage) return;
      // Close dialog
      onAuthSelect(undefined);
    } else if (key.name === 'return') {
      if (viewLevel === 'molimate-auth') {
        if (!/^[A-Za-z0-9]+$/.test(employeeId)) {
          setErrorMessage('Employee ID must be alphanumeric.');
          return;
        }
        setErrorMessage(null);
        setViewLevel('molimate-timer');
      } else if (viewLevel === 'local-env') {
        if (localEnvStep === 0) {
          if (!baseUrl.trim()) {
            setErrorMessage('Endpoint cannot be empty.');
            return;
          }
          setErrorMessage(null);
          setLocalEnvStep(1);
        } else if (localEnvStep === 1) {
          if (!modelName.trim()) {
            setErrorMessage('Model name cannot be empty.');
            return;
          }
          setErrorMessage(null);
          setLocalEnvStep(2);
        } else if (localEnvStep === 2) {
          if (!apiKey.trim()) {
            setErrorMessage('API Key cannot be empty.');
            return;
          }
          setErrorMessage(null);
          generateLocalSettings();
        }
      }
    }
  }, { isActive: true });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;
    if (viewLevel === 'molimate-timer') {
      // Countdown
      interval = setInterval(() => {
        setTimerCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Mock API trigger resolves after 5 seconds to simulate Moli Auth flow
      timeout = setTimeout(() => {
        clearInterval(interval);
        setSuccessMessage('Successful authentication!');
        setTimeout(() => {
          onAuthSelect(AuthType.MOLI_OAUTH).catch((err) => {
            setErrorMessage(err.message);
          });
        }, 2000);
      }, 5000);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [viewLevel, onAuthSelect]);

  useEffect(() => {
    if (timerCountdown === 0 && viewLevel === 'molimate-timer' && !successMessage) {
      setErrorMessage('시간이 초과되었어요!');
    }
  }, [timerCountdown, viewLevel, successMessage]);

  const generateLocalSettings = async () => {
    try {
      const moliDir = path.join(os.homedir(), '.moli');
      await fs.mkdir(moliDir, { recursive: true });
      const settingsPath = path.join(moliDir, 'settings.json');

      const configJson = {
        modelProviders: {
          openai: [
            {
              id: modelName,
              name: modelName,
              baseUrl: baseUrl,
              description: `${modelName} via Custom Endpoint`,
              envKey: 'MODEL_API_KEY',
            },
          ],
        },
        env: {
          MODEL_API_KEY: apiKey,
        },
        security: {
          auth: {
            selectedType: 'openai',
          },
        },
        model: {
          name: modelName,
        },
      };

      await fs.writeFile(settingsPath, JSON.stringify(configJson, null, 2), 'utf-8');
      setSuccessMessage('설정이 완료되었습니다!');
      setTimeout(() => {
        handleLocalEnvSetup({ apiKey, baseUrl, modelName }).catch((err: any) => {
          setErrorMessage(err.message);
        });
      }, 2000);
    } catch (err: any) {
      setErrorMessage(`Failed to write settings.json: ${err.message}`);
    }
  };

  const renderMainView = () => (
    <Box marginTop={1}>
      <DescriptiveRadioButtonSelect
        items={mainItems}
        initialIndex={0}
        onSelect={handleMainSelect}
        itemGap={1}
      />
    </Box>
  );

  const renderMolimateAuth = () => (
    <Box flexDirection="column" marginTop={1}>
      <Text>사용자 행번을 입력해주세요 :</Text>
      <TextInput value={employeeId} onChange={setEmployeeId} placeholder="예: 23100613" />
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>Enter를 누르면 제출, Esc를 누르면 뒤로가기</Text>
      </Box>
    </Box>
  );

  const renderMolimateTimer = () => (
    <Box flexDirection="column" marginTop={1}>
      {successMessage ? (
        <Text color={theme.status.success}>{successMessage}</Text>
      ) : timerCountdown === 0 ? (
        <Text color={theme.status.error}>Time has expired.</Text>
      ) : (
        <Text>인증 중... 남은 시간: {timerCountdown}초</Text>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>Esc를 누르면 뒤로가기</Text>
      </Box>
    </Box>
  );

  const renderLocalEnv = () => (
    <Box flexDirection="column" marginTop={1}>
      {localEnvStep === 0 && (
        <>
          <Text>Enter the Model Endpoint (baseUrl):</Text>
          <TextInput value={baseUrl} onChange={setBaseUrl} placeholder="https://api.example.com" />
        </>
      )}
      {localEnvStep === 1 && (
        <>
          <Text>Enter the Model Name (name):</Text>
          <TextInput value={modelName} onChange={setModelName} placeholder="gpt-4o" />
        </>
      )}
      {localEnvStep === 2 && (
        <>
          <Text>Enter your API Key:</Text>
          <TextInput value={apiKey} onChange={setApiKey} />
        </>
      )}
      {successMessage && (
        <Box marginTop={1}>
          <Text color={theme.status.success}>{successMessage}</Text>
        </Box>
      )}
      {!successMessage && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Enter를 누르면 다음, Esc를 누르면 뒤로가기</Text>
        </Box>
      )}
    </Box>
  );

  const getViewTitle = () => {
    switch (viewLevel) {
      case 'main': return '인증 방법 선택';
      case 'molimate-auth': return '몰리메이트 인증';
      case 'molimate-timer': return '인증 진행 중';
      case 'local-env': return '로컬 환경에서 실행';
      default: return '인증 방법 선택';
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor={theme?.border?.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{getViewTitle()}</Text>

      {viewLevel === 'main' && renderMainView()}
      {viewLevel === 'molimate-auth' && renderMolimateAuth()}
      {viewLevel === 'molimate-timer' && renderMolimateTimer()}
      {viewLevel === 'local-env' && renderLocalEnv()}

      {errorMessage && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{errorMessage}</Text>
        </Box>
      )}

      {viewLevel === 'main' && (
        <>
          <Box marginY={1}>
            <Text color={theme.border.default}>{'\u2500'.repeat(80)}</Text>
          </Box>
          <Box>
            <Text color={theme.text.primary}>이용약관 및 개인정보처리방침:</Text>
          </Box>
          <Box>
            <Link url="https://dimoteo333.github.io/moli-code-docs/en/users/support/tos-privacy/" fallback={false}>
              <Text color={theme.text.secondary} underline>
                https://dimoteo333.github.io/moli-code-docs/en/users/support/tos-privacy/
              </Text>
            </Link>
          </Box>
        </>
      )}
    </Box>
  );
}
