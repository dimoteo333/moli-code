/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { darkSemanticColors } from './semantic-tokens.js';

const moliDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0b0e14',
  Foreground: '#bfbdb6',
  LightBlue: '#59C2FF',
  AccentBlue: '#39BAE6',
  AccentPurple: '#D2A6FF',
  AccentCyan: '#95E6CB',
  AccentGreen: '#AAD94C',
  AccentYellow: '#FFD700',
  AccentRed: '#F26D78',
  AccentYellowDim: '#8B7530',
  AccentRedDim: '#8B3A4A',
  DiffAdded: '#AAD94C',
  DiffRemoved: '#F26D78',
  Comment: '#646A71',
  Gray: '#3D4149',
  GradientColors: ['#9B59B6', '#D2A6FF'],
};

export const MoliDark: Theme = new Theme(
  'Moli Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: moliDarkColors.Background,
      color: moliDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: moliDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: moliDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: moliDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: moliDarkColors.LightBlue,
    },
    'hljs-link': {
      color: moliDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: moliDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: moliDarkColors.Foreground,
    },
    'hljs-string': {
      color: moliDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: moliDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: moliDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: moliDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: moliDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: moliDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: moliDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: moliDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: moliDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: moliDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: moliDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: moliDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: moliDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  moliDarkColors,
  darkSemanticColors,
);
