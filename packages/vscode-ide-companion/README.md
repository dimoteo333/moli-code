# Moli Code Companion

[![Version](https://img.shields.io/visual-studio-marketplace/v/dobby.moli-code-vscode-ide-companion)](https://marketplace.visualstudio.com/items?itemName=dobby.moli-code-vscode-ide-companion)
[![VS Code Installs](https://img.shields.io/visual-studio-marketplace/i/dobby.moli-code-vscode-ide-companion)](https://marketplace.visualstudio.com/items?itemName=dobby.moli-code-vscode-ide-companion)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/dobby/moli-code-vscode-ide-companion)](https://open-vsx.org/extension/dobby/moli-code-vscode-ide-companion)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/dobby.moli-code-vscode-ide-companion)](https://marketplace.visualstudio.com/items?itemName=dobby.moli-code-vscode-ide-companion)

Seamlessly integrate [Moli Code](https://github.com/MoliLM/moli-code) into Visual Studio Code with native IDE features and an intuitive chat interface. This extension bundles everything you need — no additional installation required.

## Demo

<video src="https://cloud.video.taobao.com/vod/IKKwfM-kqNI3OJjM_U8uMCSMAoeEcJhs6VNCQmZxUfk.mp4" controls width="800">
  Your browser does not support the video tag. You can open the video directly:
  https://cloud.video.taobao.com/vod/IKKwfM-kqNI3OJjM_U8uMCSMAoeEcJhs6VNCQmZxUfk.mp4
</video>

## Features

- **Native IDE experience**: Dedicated Moli Code Chat panel accessed via the Moli icon in the editor title bar
- **Native diffing**: Review, edit, and accept changes in VS Code's diff view
- **Auto-accept edits mode**: Automatically apply Moli's changes as they're made
- **File management**: @-mention files or attach files and images using the system file picker
- **Conversation history & multiple sessions**: Access past conversations and run multiple sessions simultaneously
- **Open file & selection context**: Share active files, cursor position, and selections for more precise help

## Requirements

- Visual Studio Code 1.85.0 or newer (also works with Cursor, Windsurf, and other VS Code-based editors)

## Quick Start

1. **Install** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dobby.moli-code-vscode-ide-companion) or [Open VSX Registry](https://open-vsx.org/extension/dobby/moli-code-vscode-ide-companion)

2. **Open the Chat panel** using one of these methods:
   - Click the **Moli icon** in the top-right corner of the editor
   - Run `Moli Code: Open` from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)

3. **Start chatting** — Ask Moli to help with coding tasks, explain code, fix bugs, or write new features

## Commands

| Command                          | Description                                            |
| -------------------------------- | ------------------------------------------------------ |
| `Moli Code: Open`                | Open the Moli Code Chat panel                          |
| `Moli Code: Run`                 | Launch a classic terminal session with the bundled CLI |
| `Moli Code: Accept Current Diff` | Accept the currently displayed diff                    |
| `Moli Code: Close Diff Editor`   | Close/reject the current diff                          |

## Feedback & Issues

- 🐛 [Report bugs](https://github.com/MoliLM/moli-code/issues/new?template=bug_report.yml&labels=bug,vscode-ide-companion)
- 💡 [Request features](https://github.com/MoliLM/moli-code/issues/new?template=feature_request.yml&labels=enhancement,vscode-ide-companion)
- 📖 [Documentation](https://molilm.github.io/moli-code-docs/)
- 📋 [Changelog](https://github.com/MoliLM/moli-code/releases)

## Contributing

We welcome contributions! See our [Contributing Guide](https://github.com/MoliLM/moli-code/blob/main/CONTRIBUTING.md) for details on:

- Setting up the development environment
- Building and debugging the extension locally
- Submitting pull requests

## Terms of Service and Privacy Notice

By installing this extension, you agree to the [Terms of Service](https://github.com/MoliLM/moli-code/blob/main/docs/tos-privacy.md).

## License

[Apache-2.0](https://github.com/MoliLM/moli-code/blob/main/LICENSE)
