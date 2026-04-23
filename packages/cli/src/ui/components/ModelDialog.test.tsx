/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelDialog } from './ModelDialog.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import type { Config } from '@dobby/moli-code-core';
import { AuthType, DEFAULT_MOLI_MODEL } from '@dobby/moli-code-core';
import type { LoadedSettings } from '../../config/settings.js';
import { SettingScope } from '../../config/settings.js';
import { getFilteredMoliModels } from '../models/availableModels.js';

const OPENAI_MODEL = 'gpt-4o';

vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));
const mockedUseKeypress = vi.mocked(useKeypress);

vi.mock('./shared/DescriptiveRadioButtonSelect.js', () => ({
  DescriptiveRadioButtonSelect: vi.fn(() => null),
}));

const mockedSelect = vi.mocked(DescriptiveRadioButtonSelect);

const renderComponent = (
  props: Partial<React.ComponentProps<typeof ModelDialog>> = {},
  contextValue: Partial<Config> | undefined = undefined,
) => {
  const defaultProps = {
    onClose: vi.fn(),
  };
  const combinedProps = { ...defaultProps, ...props };

  const mockSettings = {
    isTrusted: true,
    user: { settings: {} },
    workspace: { settings: {} },
    setValue: vi.fn(),
  } as unknown as LoadedSettings;

  const mockConfig = {
    // --- Functions used by ModelDialog ---
    getModel: vi.fn(() => OPENAI_MODEL),
    setModel: vi.fn().mockResolvedValue(undefined),
    switchModel: vi.fn().mockResolvedValue(undefined),
    getAuthType: vi.fn(() => AuthType.USE_OPENAI),
    getAllConfiguredModels: vi.fn(() => [
      ...getFilteredMoliModels().map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description || '',
        authType: AuthType.MOLI_OAUTH,
      })),
      {
        id: OPENAI_MODEL,
        label: OPENAI_MODEL,
        description: 'OpenAI model',
        authType: AuthType.USE_OPENAI,
      },
    ]),

    // --- Functions used by ClearcutLogger ---
    getUsageStatisticsEnabled: vi.fn(() => true),
    getSessionId: vi.fn(() => 'mock-session-id'),
    getDebugMode: vi.fn(() => false),
    getContentGeneratorConfig: vi.fn(() => ({
      authType: AuthType.USE_OPENAI,
      model: OPENAI_MODEL,
    })),
    getUseModelRouter: vi.fn(() => false),
    getProxy: vi.fn(() => undefined),

    // --- Spread test-specific overrides ---
    ...(contextValue ?? {}),
  } as unknown as Config;

  const renderResult = render(
    <SettingsContext.Provider value={mockSettings}>
      <ConfigContext.Provider value={mockConfig}>
        <ModelDialog {...combinedProps} />
      </ConfigContext.Provider>
    </SettingsContext.Provider>,
  );

  return {
    ...renderResult,
    props: combinedProps,
    mockConfig,
    mockSettings,
  };
};

describe('<ModelDialog />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure env-based fallback models don't leak into this suite from the developer environment.
    delete process.env['OPENAI_MODEL'];
    delete process.env['ANTHROPIC_MODEL'];
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the title', () => {
    const { getByText } = renderComponent();
    expect(getByText('Select Model')).toBeDefined();
  });

  it('passes all model options to DescriptiveRadioButtonSelect', () => {
    renderComponent();
    expect(mockedSelect).toHaveBeenCalledTimes(1);

    const props = mockedSelect.mock.calls[0][0];
    expect(props.items).toHaveLength(1);
    expect(props.items[0].value).toBe(
      `${AuthType.USE_OPENAI}::${OPENAI_MODEL}`,
    );
    expect(props.items.map((item) => item.value)).not.toContain(
      `${AuthType.MOLI_OAUTH}::${DEFAULT_MOLI_MODEL}`,
    );
    expect(props.showNumbers).toBe(true);
  });

  it('initializes with the model from ConfigContext', () => {
    const mockGetModel = vi.fn(() => OPENAI_MODEL);
    renderComponent(
      {},
      {
        getModel: mockGetModel,
      },
    );

    expect(mockGetModel).toHaveBeenCalled();
    expect(mockedSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialIndex: 0,
      }),
      undefined,
    );
  });

  it('initializes with first visible provider model if context is not provided', () => {
    renderComponent({}, undefined);

    expect(mockedSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialIndex: 0,
      }),
      undefined,
    );
  });

  it('initializes with default coder model if getModel returns undefined', () => {
    const mockGetModel = vi.fn(() => undefined as unknown as string);
    renderComponent(
      {},
      {
        getModel: mockGetModel,
      },
    );

    expect(mockGetModel).toHaveBeenCalled();

    expect(mockedSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialIndex: 0,
      }),
      undefined,
    );
    expect(mockedSelect).toHaveBeenCalledTimes(1);
  });

  it('calls config.switchModel and onClose when DescriptiveRadioButtonSelect.onSelect is triggered', async () => {
    const { props, mockConfig, mockSettings } = renderComponent();

    const childOnSelect = mockedSelect.mock.calls[0][0].onSelect;
    expect(childOnSelect).toBeDefined();

    await childOnSelect(`${AuthType.USE_OPENAI}::${OPENAI_MODEL}`);

    expect(mockConfig?.switchModel).toHaveBeenCalledWith(
      AuthType.USE_OPENAI,
      OPENAI_MODEL,
      undefined,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'model.name',
      OPENAI_MODEL,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.USE_OPENAI,
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls config.switchModel and persists authType+model when selecting a different authType', async () => {
    const switchModel = vi.fn().mockResolvedValue(undefined);
    const getAuthType = vi.fn(() => AuthType.MOLI_OAUTH);

    const mockConfigWithSwitchAuthType = {
      getAuthType,
      getModel: vi.fn(() => DEFAULT_MOLI_MODEL),
      getContentGeneratorConfig: vi.fn(() => ({
        authType: AuthType.USE_OPENAI,
        model: OPENAI_MODEL,
      })),
      // Add switchModel to the mock object (not the type)
      switchModel,
      getAllConfiguredModels: vi.fn(() => [
        {
          id: OPENAI_MODEL,
          label: OPENAI_MODEL,
          description: 'OpenAI model',
          authType: AuthType.USE_OPENAI,
        },
      ]),
    };

    const { props, mockSettings } = renderComponent(
      {},
      // Cast to Config to bypass type checking, matching the runtime behavior
      mockConfigWithSwitchAuthType as unknown as Partial<Config>,
    );

    const childOnSelect = mockedSelect.mock.calls[0][0].onSelect;
    await childOnSelect(`${AuthType.USE_OPENAI}::${OPENAI_MODEL}`);

    expect(switchModel).toHaveBeenCalledWith(
      AuthType.USE_OPENAI,
      OPENAI_MODEL,
      undefined,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'model.name',
      OPENAI_MODEL,
    );
    expect(mockSettings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.USE_OPENAI,
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('passes onHighlight to DescriptiveRadioButtonSelect', () => {
    renderComponent();

    const childOnHighlight = mockedSelect.mock.calls[0][0].onHighlight;
    expect(childOnHighlight).toBeDefined();
    expect(typeof childOnHighlight).toBe('function');
  });

  it('calls onClose prop when "escape" key is pressed', () => {
    const { props } = renderComponent();

    expect(mockedUseKeypress).toHaveBeenCalled();

    const keyPressHandler = mockedUseKeypress.mock.calls[0][0];
    const options = mockedUseKeypress.mock.calls[0][1];

    expect(options).toEqual({ isActive: true });

    keyPressHandler({
      name: 'escape',
      ctrl: false,
      meta: false,
      shift: false,
      paste: false,
      sequence: '',
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);

    keyPressHandler({
      name: 'a',
      ctrl: false,
      meta: false,
      shift: false,
      paste: false,
      sequence: '',
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('updates initialIndex when config context changes', () => {
    const mockGetModel = vi.fn(() => OPENAI_MODEL);
    const mockGetAuthType = vi.fn(() => AuthType.USE_OPENAI);
    const mockSettings = {
      isTrusted: true,
      user: { settings: {} },
      workspace: { settings: {} },
      setValue: vi.fn(),
    } as unknown as LoadedSettings;
    const { rerender } = render(
      <SettingsContext.Provider value={mockSettings}>
        <ConfigContext.Provider
          value={
            {
              getModel: mockGetModel,
              getAuthType: mockGetAuthType,
              getAllConfiguredModels: vi.fn(() => [
                {
                  id: 'gpt-3.5',
                  label: 'gpt-3.5',
                  description: 'OpenAI model',
                  authType: AuthType.USE_OPENAI,
                },
                {
                  id: OPENAI_MODEL,
                  label: OPENAI_MODEL,
                  description: 'OpenAI model',
                  authType: AuthType.USE_OPENAI,
                },
              ]),
            } as unknown as Config
          }
        >
          <ModelDialog onClose={vi.fn()} />
        </ConfigContext.Provider>
      </SettingsContext.Provider>,
    );

    expect(mockedSelect.mock.calls[0][0].initialIndex).toBe(1);

    mockGetModel.mockReturnValue('gpt-3.5');
    const newMockConfig = {
      getModel: mockGetModel,
      getAuthType: mockGetAuthType,
      getAllConfiguredModels: vi.fn(() => [
        {
          id: 'gpt-3.5',
          label: 'gpt-3.5',
          description: 'OpenAI model',
          authType: AuthType.USE_OPENAI,
        },
        {
          id: OPENAI_MODEL,
          label: OPENAI_MODEL,
          description: 'OpenAI model',
          authType: AuthType.USE_OPENAI,
        },
      ]),
    } as unknown as Config;

    rerender(
      <SettingsContext.Provider value={mockSettings}>
        <ConfigContext.Provider value={newMockConfig}>
          <ModelDialog onClose={vi.fn()} />
        </ConfigContext.Provider>
      </SettingsContext.Provider>,
    );

    // Should be called at least twice: initial render + re-render after context change
    expect(mockedSelect).toHaveBeenCalledTimes(2);
    expect(mockedSelect.mock.calls[1][0].initialIndex).toBe(0);
  });
});
