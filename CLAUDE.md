# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**zakip-voice** — a Tauri 2.0 desktop app for voice transcription with AI enhancement. Records audio via system microphone, transcribes it through OpenAI-compatible APIs, optionally enhances the text with an LLM, and copies the result to clipboard with optional auto-paste.

## Development Commands

```bash
pnpm install              # Install frontend dependencies
pnpm tauri dev            # Full app dev with hot-reload (frontend + Rust backend)
pnpm dev                  # Frontend-only Vite dev server (port 1420)
pnpm build                # Build frontend (tsc + vite build)
pnpm tauri build          # Production build (app bundles: dmg, msi, appimage, deb, rpm)

# Code quality
pnpm lint                 # ESLint on src/
pnpm lint:fix             # ESLint with auto-fix
pnpm format               # Prettier write
pnpm format:check         # Prettier check
pnpm typecheck            # TypeScript check (tsc --noEmit)
pnpm quality              # All three: format:check + lint + typecheck

# Rust backend
cd src-tauri && cargo build    # Build Rust backend
cd src-tauri && cargo test     # Run Rust tests
```

## Architecture

### Two-layer architecture: React frontend + Rust backend

**Frontend** (`src/`) — React 19 + TypeScript + Vite + Tailwind CSS 4 + Radix UI (shadcn/ui pattern). No test framework set up.

**Backend** (`src-tauri/`) — Rust with Tauri 2.0. Handles AI API calls (keeps API keys out of browser), audio recording via `cpal`, secure credential storage (AES-GCM encrypted files), keyboard simulation (`enigo`), and system tray.

### Frontend Key Modules

- **`G` singleton** (`src/appInitializer/module/G.ts`) — Central service locator. Holds `G.ai`, `G.voice`, `G.rustProxy`, `G.view`, `G.events`, `G.globalShortcuts`. Initialized during app boot in `AppInitializer.ts`.
- **Global state** — Zustand store (`src/appInitializer/store/index.ts`). Sections: `provider`, `view`, `globalShortcuts`, `voice`. Access via `GlobalStore.getStoreData(key)` or `GlobalStore.updateState(key, data)`.
- **`RustProxyModule`** (`src/rustProxy/RustProxyModule.ts`) — TypeScript wrapper around `invoke()` calls to Rust backend. All AI operations, terminal, clipboard, and abort operations go through here.
- **`AIService` / `AIServiceBackend`** (`src/integrations/ai/`) — AI abstraction layer. `AIServiceBackend` resolves model→provider→credentials from global state, then calls `RustProxyModule`. Supports text completion, streaming, image generation, audio transcription, TTS.
- **`VoiceModule`** (`src/voice/VoiceModule.ts`) — Core voice workflow: start recording → stop → transcribe → enhance with AI → copy to clipboard → auto-paste. Manages recording popup window and escape shortcut.
- **`EventBus`** (`src/events/EventBus.ts`) — Frontend-only pub/sub singleton for decoupled communication.
- **`StateSyncManager`** (`src/stateSync/StateSyncManager.ts`) — Syncs Zustand state sections between main window and popup windows via Tauri events.
- **Views** — `src/views/pages/VoiceHomeView.tsx` (main page), `src/views/pages/settings/` (settings), `src/views/ui/` (shadcn/ui components).
- **Routing** — React Router v6. Routes defined in `src/views/Root.tsx`. Two routes: voice home (`/`) and model settings.

### Rust Backend Key Modules

- **`ai/proxy.rs`** — `AIProxy` orchestrator. Stateless — credentials passed per-request. Routes all AI ops through `OpenAIProvider`.
- **`ai/providers/openai.rs`** — OpenAI-compatible provider. Works with any OpenAI-compatible API (OpenAI, Perplexity, Groq, OpenRouter, custom).
- **`ai/provider.rs`** — `AIProvider` trait defining the interface for all providers.
- **`commands.rs`** — All Tauri commands (`#[tauri::command]`). Each AI command has abort support via `AtomicBool` flags and `tokio::select!` for timeout/cancellation.
- **`audio/recorder.rs`** — Native audio recording using `cpal`. Records to WAV format.
- **`secure_storage.rs`** — AES-GCM encrypted file storage for credentials.
- **`main.rs`** — App setup: plugins, tray icon, window management (hide-on-close behavior), state initialization.

### Communication Pattern: Frontend → Backend

Frontend calls `invoke("command_name", {args})` → Tauri routes to `#[tauri::command]` Rust function → Rust calls external API → returns result. Streaming uses Tauri events: backend emits `stream-chunk-{sessionId}`, frontend listens via `listen()`.

### Model ID Convention

Composite model IDs: `{providerId}::{modelId}` (e.g., `openai::gpt-4o`). Parsed by `parseModelId()` / `createCompositeModelId()` in `src/integrations/ai/interface/AIModel.ts`.

## Code Style

- **Prettier**: 4-space indent, double quotes, no bracket spacing, 180 char line width, trailing commas, LF line endings
- **TypeScript**: Strict mode, no unused locals/params
- **Path alias**: `@/` maps to `src/` (configured in Vite and tsconfig)
- **UI components**: shadcn/ui pattern — primitives in `src/views/ui/`, composed in `src/views/`
- **ESLint**: `@typescript-eslint/no-explicit-any` is off (any is used in AI message types)

## Multi-Window Architecture

The app uses two Tauri windows:
1. **main** — Primary app window (hidden on close, shown from tray)
2. **voice-recording-popup** — Small overlay window at screen bottom during recording. Communicates with main window via Tauri events (`emitTo`/`listen`).

State between windows is synced via `StateSyncManager` using event channels `state-sync:{key}`.

## Provider System

Providers are configured in the UI and stored in Zustand state (`provider.collection`). Built-in templates: OpenAI, Perplexity, Groq, OpenRouter, Custom. All use the OpenAI-compatible API format. API keys are stored client-side and passed to Rust per-request (never stored in Rust state).
