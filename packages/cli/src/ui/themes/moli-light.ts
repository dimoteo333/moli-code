/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const moliLightColors: ColorsTheme = {
  type: 'light',
  Background: '#f8f9fa',
  Foreground: '#5c6166',
  LightBlue: '#55b4d4',
  AccentBlue: '#399ee6',
  AccentPurple: '#a37acc',
  AccentCyan: '#4cbf99',
  AccentGreen: '#86b300',
  AccentYellow: '#f2ae49',
  AccentRed: '#f07171',
  AccentYellowDim: '#8B7000',
  AccentRedDim: '#993333',
  DiffAdded: '#86b300',
  DiffRemoved: '#f07171',
  Comment: '#ABADB1',
  Gray: '#CCCFD3',
  GradientColors: ['#9B72CF', '#6C63FF'],
};

export const MoliLight: Theme = new Theme(
  'Moli Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: moliLightColors.Background,
      color: moliLightColors.Foreground,
    },
    'hljs-comment': {
      color: moliLightColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: moliLightColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: moliLightColors.AccentGreen,
    },
    'hljs-constant': {
      color: moliLightColors.AccentCyan,
    },
    'hljs-number': {
      color: moliLightColors.AccentPurple,
    },
    'hljs-keyword': {
      color: moliLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
      color: moliLightColors.AccentYellow,
    },
    'hljs-attribute': {
      color: moliLightColors.AccentYellow,
    },
    'hljs-variable': {
      color: moliLightColors.Foreground,
    },
    'hljs-variable.language': {
      color: moliLightColors.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: moliLightColors.AccentBlue,
    },
    'hljs-section': {
      color: moliLightColors.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: moliLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: moliLightColors.AccentBlue,
    },
    'hljs-tag': {
      color: moliLightColors.LightBlue,
    },
    'hljs-name': {
      color: moliLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
      color: moliLightColors.AccentYellow,
    },
    'hljs-meta': {
      color: moliLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: moliLightColors.AccentRed,
    },
    'hljs-bullet': {
      color: moliLightColors.AccentYellow,
    },
    'hljs-regexp': {
      color: moliLightColors.AccentCyan,
    },
    'hljs-link': {
      color: moliLightColors.LightBlue,
    },
    'hljs-deletion': {
      color: moliLightColors.AccentRed,
    },
    'hljs-addition': {
      color: moliLightColors.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: moliLightColors.AccentCyan,
    },
    'hljs-built_in': {
      color: moliLightColors.AccentRed,
    },
    'hljs-doctag': {
      color: moliLightColors.AccentRed,
    },
    'hljs-template-variable': {
      color: moliLightColors.AccentCyan,
    },
    'hljs-selector-id': {
      color: moliLightColors.AccentRed,
    },
  },
  moliLightColors,
  lightSemanticColors,
);
