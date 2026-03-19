/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { t } from '../../i18n/index.js';

export type MolimateModel = 'qwen3-coder' | 'gpt-oss-120b';

interface MolimateModelSelectorProps {
  onSelect: (model: MolimateModel) => void;
  onCancel: () => void;
}

export function MolimateModelSelector({
  onSelect,
  onCancel,
}: MolimateModelSelectorProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const modelItems = [
    {
      key: 'qwen3-coder',
      title: 'Qwen3-Coder',
      label: 'Qwen3-Coder',
      description: t('Code-focused model optimized for programming tasks'),
      value: 'qwen3-coder' as MolimateModel,
    },
    {
      key: 'gpt-oss-120b',
      title: 'GPT-OSS-120B',
      label: 'GPT-OSS-120B',
      description: t('Large-scale general purpose model'),
      value: 'gpt-oss-120b' as MolimateModel,
    },
  ];

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onCancel();
      }
    },
    { isActive: true },
  );

  const handleSelect = (value: MolimateModel) => {
    onSelect(value);
  };

  const handleHighlight = (value: MolimateModel) => {
    const index = modelItems.findIndex((item) => item.value === value);
    if (index !== -1) {
      setSelectedIndex(index);
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.primary}>{t('Select a model to use')}</Text>
      </Box>

      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={modelItems}
          initialIndex={selectedIndex}
          onSelect={handleSelect}
          onHighlight={handleHighlight}
          itemGap={1}
        />
      </Box>

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to select, ↑↓ to navigate, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );
}
