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
import { getMolimateConfig } from '../../constants/molimateConfig.js';

export type MolimateModel = string;

interface MolimateModelSelectorProps {
  onSelect: (model: MolimateModel) => void;
  onCancel: () => void;
}

export function MolimateModelSelector({
  onSelect,
  onCancel,
}: MolimateModelSelectorProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const molimateConfig = getMolimateConfig();
  const modelItems = molimateConfig.models.map((m) => ({
    key: m.id,
    title: m.displayName,
    label: m.displayName,
    description: t(m.description),
    value: m.id,
  }));

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onCancel();
      }
    },
    { isActive: true },
  );

  const handleSelect = (value: string) => {
    onSelect(value);
  };

  const handleHighlight = (value: string) => {
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
