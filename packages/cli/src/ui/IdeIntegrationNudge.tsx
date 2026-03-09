/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IdeInfo } from '@dobby/moli-code-core';
import { Box, Text } from 'ink';
import type { RadioSelectItem } from './components/shared/RadioButtonSelect.js';
import { RadioButtonSelect } from './components/shared/RadioButtonSelect.js';
import { useKeypress } from './hooks/useKeypress.js';
import { theme } from './semantic-colors.js';

export type IdeIntegrationNudgeResult = {
  userSelection: 'yes' | 'no' | 'dismiss';
  isExtensionPreInstalled: boolean;
};

interface IdeIntegrationNudgeProps {
  ide: IdeInfo;
  onComplete: (result: IdeIntegrationNudgeResult) => void;
}

export function IdeIntegrationNudge({
  ide,
  onComplete,
}: IdeIntegrationNudgeProps) {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onComplete({
          userSelection: 'no',
          isExtensionPreInstalled: false,
        });
      }
    },
    { isActive: true },
  );

  const { displayName: ideName } = ide;
  const isInSandbox = !!process.env['SANDBOX'];
  // Assume extension is already installed if the env variables are set.
  const isExtensionPreInstalled =
    !!process.env['MOLI_CODE_IDE_SERVER_PORT'] &&
    !!process.env['MOLI_CODE_IDE_WORKSPACE_PATH'];

  const OPTIONS: Array<RadioSelectItem<IdeIntegrationNudgeResult>> = [
    {
      label: '예',
      value: {
        userSelection: 'yes',
        isExtensionPreInstalled,
      },
      key: 'Yes',
    },
    {
      label: '아니오 (Esc)',
      value: {
        userSelection: 'no',
        isExtensionPreInstalled,
      },
      key: 'No (esc)',
    },
    {
      label: "다음에 다시 묻지 않기",
      value: {
        userSelection: 'dismiss',
        isExtensionPreInstalled,
      },
      key: "No, don't ask again",
    },
  ];

  const installText = isInSandbox
    ? `참고: 샌드박스 환경에서는 IDE 통합을 위해 로컬 컴퓨터에 수동 설정이 필요해요. 예를 선택하면 설정 방법을 안내해 드립니다.`
    : isExtensionPreInstalled
      ? `예를 선택하면 ${ideName ?? 'IDE'
      }에 연결되어 열려있는 파일에 접근하고 차이점을 직접 표시할 수 있어요.`
      : `${ideName ?? 'IDE'}에 연결되어 열려있는 파일에 접근하고 차이점을 직접 표시할 수 있도록 확장 프로그램을 설치할게요.`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.status.warning}
      padding={1}
      width="100%"
      marginLeft={1}
    >
      <Box marginBottom={1} flexDirection="column">
        <Text>
          <Text color={theme.status.warning}>{'> '}</Text>
          {`몰리코드를 ${ideName ?? 'your editor'}에 연결하시겠어요?`}
        </Text>
        <Text color={theme.text.secondary}>{installText}</Text>
      </Box>
      <RadioButtonSelect items={OPTIONS} onSelect={onComplete} />
    </Box>
  );
}
