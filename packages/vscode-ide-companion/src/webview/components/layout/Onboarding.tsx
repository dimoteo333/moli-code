/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 *
 * VSCode-specific Onboarding adapter
 * Uses webui Onboarding component with platform-specific icon URL
 */

import type { FC } from 'react';
import { Onboarding as BaseOnboarding } from '@dobby/moli-code-webui';
import { generateIconUrl } from '../../utils/resourceUrl.js';
import { UI_STRINGS } from '../../../i18n/strings.js';

interface OnboardingPageProps {
  onLogin: () => void;
}

/**
 * VSCode Onboarding wrapper
 * Provides platform-specific icon URL to the webui Onboarding component
 */
export const Onboarding: FC<OnboardingPageProps> = ({ onLogin }) => {
  const iconUri = generateIconUrl('logo.ico');

  return (
    <BaseOnboarding
      iconUrl={iconUri}
      onGetStarted={onLogin}
      appName={UI_STRINGS.appName}
      title={UI_STRINGS.onboardingTitle}
      subtitle={UI_STRINGS.onboardingSubtitle}
      buttonText={UI_STRINGS.onboardingButton}
    />
  );
};
