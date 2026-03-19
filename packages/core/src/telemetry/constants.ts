/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'moli-code';

export const EVENT_USER_PROMPT = 'moli-code.user_prompt';
export const EVENT_USER_RETRY = 'moli-code.user_retry';
export const EVENT_TOOL_CALL = 'moli-code.tool_call';
export const EVENT_API_REQUEST = 'moli-code.api_request';
export const EVENT_API_ERROR = 'moli-code.api_error';
export const EVENT_API_CANCEL = 'moli-code.api_cancel';
export const EVENT_API_RESPONSE = 'moli-code.api_response';
export const EVENT_CLI_CONFIG = 'moli-code.config';
export const EVENT_EXTENSION_DISABLE = 'moli-code.extension_disable';
export const EVENT_EXTENSION_ENABLE = 'moli-code.extension_enable';
export const EVENT_EXTENSION_INSTALL = 'moli-code.extension_install';
export const EVENT_EXTENSION_UNINSTALL = 'moli-code.extension_uninstall';
export const EVENT_EXTENSION_UPDATE = 'moli-code.extension_update';
export const EVENT_FLASH_FALLBACK = 'moli-code.flash_fallback';
export const EVENT_RIPGREP_FALLBACK = 'moli-code.ripgrep_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'moli-code.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'moli-code.slash_command';
export const EVENT_IDE_CONNECTION = 'moli-code.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'moli-code.chat_compression';
export const EVENT_INVALID_CHUNK = 'moli-code.chat.invalid_chunk';
export const EVENT_CONTENT_RETRY = 'moli-code.chat.content_retry';
export const EVENT_CONTENT_RETRY_FAILURE =
  'moli-code.chat.content_retry_failure';
export const EVENT_CONVERSATION_FINISHED = 'moli-code.conversation_finished';
export const EVENT_MALFORMED_JSON_RESPONSE =
  'moli-code.malformed_json_response';
export const EVENT_FILE_OPERATION = 'moli-code.file_operation';
export const EVENT_MODEL_SLASH_COMMAND = 'moli-code.slash_command.model';
export const EVENT_SUBAGENT_EXECUTION = 'moli-code.subagent_execution';
export const EVENT_SKILL_LAUNCH = 'moli-code.skill_launch';
export const EVENT_AUTH = 'moli-code.auth';
export const EVENT_USER_FEEDBACK = 'moli-code.user_feedback';

// Performance Events
export const EVENT_STARTUP_PERFORMANCE = 'moli-code.startup.performance';
export const EVENT_MEMORY_USAGE = 'moli-code.memory.usage';
export const EVENT_PERFORMANCE_BASELINE = 'moli-code.performance.baseline';
export const EVENT_PERFORMANCE_REGRESSION = 'moli-code.performance.regression';
