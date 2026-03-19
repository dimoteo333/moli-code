/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthDialog } from './AuthDialog.js';
import { LoadedSettings } from '../../config/settings.js';
import type { Config , AuthType } from '@dobby/moli-code-core';
import { renderWithProviders } from '../../test-utils/render.js';
import { UIStateContext } from '../contexts/UIStateContext.js';
import { UIActionsContext } from '../contexts/UIActionsContext.js';
import type { UIState } from '../contexts/UIStateContext.js';
import type { UIActions } from '../contexts/UIActionsContext.js';

const createMockUIState = (overrides: Partial<UIState> = {}): UIState => {
  const baseState = {
    authError: null,
    pendingAuthType: undefined,
  } as Partial<UIState>;

  return {
    ...baseState,
    ...overrides,
  } as UIState;
};

const createMockUIActions = (overrides: Partial<UIActions> = {}): UIActions => {
  const baseActions = {
    handleAuthSelect: vi.fn(),
    handleRetryLastPrompt: vi.fn(),
    validateMolimateEmployee: vi.fn(),
    handleMolimateAuthSubmit: vi.fn(),
    handleLocalConfigSubmit: vi.fn(),
    onAuthError: vi.fn(),
  } as Partial<UIActions>;

  return {
    ...baseActions,
    ...overrides,
  } as UIActions;
};

const createDefaultSettings = (): LoadedSettings =>
  new LoadedSettings(
    {
      settings: { ui: { customThemes: {} }, mcpServers: {} },
      originalSettings: { ui: { customThemes: {} }, mcpServers: {} },
      path: '',
    },
    {
      settings: {},
      originalSettings: {},
      path: '',
    },
    {
      settings: {
        security: { auth: { selectedType: undefined } },
        ui: { customThemes: {} },
        mcpServers: {},
      },
      originalSettings: {
        security: { auth: { selectedType: undefined } },
        ui: { customThemes: {} },
        mcpServers: {},
      },
      path: '',
    },
    {
      settings: { ui: { customThemes: {} }, mcpServers: {} },
      originalSettings: { ui: { customThemes: {} }, mcpServers: {} },
      path: '',
    },
    true,
    new Set(),
  );

const renderAuthDialog = (
  settings: LoadedSettings,
  uiStateOverrides: Partial<UIState> = {},
  uiActionsOverrides: Partial<UIActions> = {},
  configAuthType: AuthType | undefined = undefined,
) => {
  const uiState = createMockUIState(uiStateOverrides);
  const uiActions = createMockUIActions(uiActionsOverrides);

  const mockConfig = {
    getAuthType: vi.fn(() => configAuthType),
    getContentGeneratorConfig: vi.fn(() => ({ apiKey: undefined })),
  } as unknown as Config;

  return renderWithProviders(
    <UIStateContext.Provider value={uiState}>
      <UIActionsContext.Provider value={uiActions}>
        <AuthDialog />
      </UIActionsContext.Provider>
    </UIStateContext.Provider>,
    { settings, config: mockConfig },
  );
};

describe('AuthDialog', () => {
  const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should show an error if initial auth error is provided', () => {
    const settings = createDefaultSettings();

    const { lastFrame } = renderAuthDialog(settings, {
      authError: 'GEMINI_API_KEY  environment variable not found',
    });

    expect(lastFrame()).toContain(
      'GEMINI_API_KEY  environment variable not found',
    );
  });

  it('should render main auth selection view with Molimate and Local options', () => {
    const settings = createDefaultSettings();
    const { lastFrame } = renderAuthDialog(settings);

    // Should show the title
    expect(lastFrame()).toContain('인증 방식 선택');
    // Should show Molimate auth option
    expect(lastFrame()).toContain('몰리메이트로 인증');
    // Should show Local option
    expect(lastFrame()).toContain('로컬 환경에서 실행');
  });

  it('should show terms and privacy notice', () => {
    const settings = createDefaultSettings();
    const { lastFrame } = renderAuthDialog(settings);

    expect(lastFrame()).toContain('이용약관 및 개인정보처리방침');
  });

  it('should show error message when pressing escape without auth method selected', async () => {
    const settings = createDefaultSettings();

    const { lastFrame, stdin, unmount } = renderAuthDialog(
      settings,
      {},
      {},
      undefined, // config.getAuthType() returns undefined
    );
    await wait();

    // Simulate pressing escape key
    stdin.write('\u001b'); // ESC key
    await wait();

    // Should show error message in Korean
    await vi.waitFor(() => {
      const frame = lastFrame();
      expect(frame).toContain('인증 방식을 선택해야 합니다');
    });
    unmount();
  });

  it('should not exit if there is already an error message', async () => {
    const settings = createDefaultSettings();
    const onAuthError = vi.fn();

    const { lastFrame, stdin, unmount } = renderAuthDialog(
      settings,
      { authError: 'Initial error' },
      { onAuthError },
      undefined,
    );
    await wait();

    expect(lastFrame()).toContain('Initial error');

    // Simulate pressing escape key
    stdin.write('\u001b'); // ESC key
    await wait();

    unmount();
  });

  it('should show Molimate employee ID description', () => {
    const settings = createDefaultSettings();
    const { lastFrame } = renderAuthDialog(settings);

    expect(lastFrame()).toContain('사번을 입력하여 인증');
  });

  it('should show local config description', () => {
    const settings = createDefaultSettings();
    const { lastFrame } = renderAuthDialog(settings);

    expect(lastFrame()).toContain('수동 설정');
  });
});
