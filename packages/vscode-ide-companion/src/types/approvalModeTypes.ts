/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { UI_STRINGS } from '../i18n/strings.js';

/**
 * Enum for approval modes with UI-friendly labels
 * Represents the different approval modes available in the ACP protocol
 * with their corresponding user-facing display names
 */
export enum ApprovalMode {
  PLAN = 'plan',
  DEFAULT = 'default',
  AUTO_EDIT = 'auto-edit',
  YOLO = 'yolo',
}

/**
 * Mapping from string values to enum values for runtime conversion
 */
export const APPROVAL_MODE_MAP: Record<string, ApprovalMode> = {
  plan: ApprovalMode.PLAN,
  default: ApprovalMode.DEFAULT,
  'auto-edit': ApprovalMode.AUTO_EDIT,
  yolo: ApprovalMode.YOLO,
};

/**
 * UI display information for each approval mode
 */
export const APPROVAL_MODE_INFO: Record<
  ApprovalMode,
  {
    label: string;
    title: string;
    iconType?: 'edit' | 'auto' | 'plan' | 'yolo';
  }
> = {
  [ApprovalMode.PLAN]: {
    label: UI_STRINGS.approvalPlanLabel,
    title: UI_STRINGS.approvalPlanTitle,
    iconType: 'plan',
  },
  [ApprovalMode.DEFAULT]: {
    label: UI_STRINGS.approvalDefaultLabel,
    title: UI_STRINGS.approvalDefaultTitle,
    iconType: 'edit',
  },
  [ApprovalMode.AUTO_EDIT]: {
    label: UI_STRINGS.approvalAutoLabel,
    title: UI_STRINGS.approvalAutoTitle,
    iconType: 'auto',
  },
  [ApprovalMode.YOLO]: {
    label: UI_STRINGS.approvalYoloLabel,
    title: UI_STRINGS.approvalYoloTitle,
    iconType: 'yolo',
  },
};

/**
 * Get UI display information for an approval mode from string value
 */
export function getApprovalModeInfoFromString(mode: string): {
  label: string;
  title: string;
  iconType?: 'edit' | 'auto' | 'plan' | 'yolo';
} {
  const enumValue = APPROVAL_MODE_MAP[mode];
  if (enumValue !== undefined) {
    return APPROVAL_MODE_INFO[enumValue];
  }
  return {
    label: '알 수 없는 모드',
    title: '알 수 없는 편집 모드',
    iconType: undefined,
  };
}
