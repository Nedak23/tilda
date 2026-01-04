# Tilda

A task management app where each task is an AI conversation powered by Claude.

## Features

- **AI-Powered Tasks**: Each task has its own AI conversation context
- **Contexts**: Organize tasks and share knowledge across related work
- **Learning Notes**: AI automatically captures useful information from completed tasks
- **Tilda Assistant**: A meta-assistant to help manage your tasks via natural language
- **Local First**: All data stored locally on your machine
- **macOS Native**: Built for macOS with native look and feel

## Installation

Download the latest release from the [Releases](https://github.com/Nedak23/tilda/releases) page.

1. Download `Tilda-X.X.X-arm64.dmg` (Apple Silicon) or `Tilda-X.X.X-x64.dmg` (Intel)
2. Open the DMG and drag Tilda to Applications
3. Launch Tilda from Applications

**Note:** Since this app is not code-signed, you may need to right-click and select "Open" on first launch to bypass Gatekeeper.

## Setup

1. Open Tilda
2. Click the gear icon to open Settings
3. Enter your [Anthropic API key](https://console.anthropic.com/)
4. Select your preferred Claude model

## Usage

### Tasks
- Tasks are organized by date: Today, Upcoming, and Logbook (archive)
- Each task has its own AI chat - ask questions, get help, brainstorm
- Complete tasks when done; they move to Logbook

### Contexts
- Create contexts to organize related tasks (e.g., "Work", "Project X")
- Attach documents to contexts for AI reference
- AI learning notes are saved per context

### Tilda Assistant
- Click the Tilda button (~) to access the task management assistant
- Use natural language to create, update, or search tasks

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Build for macOS specifically
npm run build:mac
```

## Privacy

Tilda stores all data locally on your machine:
- Tasks and messages in SQLite database
- Settings in electron-store
- No telemetry or analytics

Your API key is stored locally and only used for Claude API calls.

## License

MIT License - see [LICENSE](LICENSE)
