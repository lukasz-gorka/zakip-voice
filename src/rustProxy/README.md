# RustProxyModule

Single point of communication between Frontend (TypeScript) and Backend (Rust).

## Purpose

- **Security:** All API operations go through Rust, keeping API keys server-side
- **Type Safety:** Strongly typed interfaces for all operations
- **Error Handling:** Centralized error handling and logging
- **Maintainability:** Single module to modify when Rust API changes

## Usage

All Rust operations should go through `G.rustProxy`:

```typescript
import {G} from "../G";

// AI Operations
const response = await G.rustProxy.chatCompletion(request);
const imageUrl = await G.rustProxy.generateImage({model, prompt, size});
const text = await G.rustProxy.transcribeAudio(audioData, {model, language});
const audio = await G.rustProxy.textToSpeech({text, model, voice});

// Terminal Operations
const session = await G.rustProxy.createTerminalSession(id, name, dir);
await G.rustProxy.writeTerminalInput(sessionId, command);

// System Operations
await G.rustProxy.showNotification("Title", "Body");
```

## DO NOT

- ❌ Never use `invoke()` directly in other modules
- ❌ Never import OpenAI SDK in browser code
- ❌ Never use `dangerouslyAllowBrowser: true`

## Available Operations

### AI Operations

- `registerProvider()` - Register AI provider (OpenAI, etc.)
- `setModels()` - Set available models
- `getModels()` - Get all models
- `listProviders()` - List registered providers
- `chatCompletion()` - Non-streaming chat completion
- `chatCompletionStream()` - Streaming chat completion
- `generateImage()` - DALL-E image generation ✅ **Secure**
- `transcribeAudio()` - Whisper audio transcription ✅ **Secure**
- `textToSpeech()` - TTS generation ✅ **Secure**

### Terminal Operations

- `createTerminalSession()` - Create new terminal
- `removeTerminalSession()` - Remove terminal
- `writeTerminalInput()` - Send input to terminal
- `resizeTerminal()` - Resize terminal PTY
- `saveTerminalHistory()` - Save terminal output to file

### System Operations

- `showNotification()` - Show system notification
- `downloadImage()` - Download image (bypass CORS)
- `executeWebhook()` - Execute HTTP webhook

### Auth Operations (Deprecated)

- `loginProxy()` - Legacy login (will be replaced)

## Migration Guide

### Before (❌ Insecure)

```typescript
import {invoke} from "@tauri-apps/api/core";
import OpenAI from "openai";

// Direct invoke - no centralized error handling
const response = await invoke("chat_completion", {request});

// API keys in browser - DANGEROUS!
const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
});
const image = await client.images.generate({model, prompt});
```

### After (✅ Secure)

```typescript
import {G} from "../G";

// Centralized proxy with error handling
const response = await G.rustProxy.chatCompletion(request);

// API keys stay in Rust backend - SECURE!
const imageResponse = await G.rustProxy.generateImage({
    model,
    prompt,
    size: "1024x1024",
});
```

## Architecture

```
Frontend Module → RustProxyModule → Tauri invoke() → Rust Backend
                     ↑
              (single source of truth)
```

All Rust communication flows through this module, making it easy to:

- Add logging/metrics
- Handle errors consistently
- Update when Rust API changes
- Test and mock Rust operations

## Type Safety

All operations use strictly typed interfaces from `./types/`:

- `AITypes.ts` - AI operations types
- `TerminalTypes.ts` - Terminal operations types
- `SystemTypes.ts` - System operations types

Types are kept in sync with Rust types defined in `src-tauri/src/ai/types.rs`.

## Error Handling

All methods:

1. Log errors with context via `Logger`
2. Throw user-friendly error messages
3. Never expose internal implementation details

Example:

```typescript
try {
    await G.rustProxy.generateImage(request);
} catch (error) {
    // Error is already logged by RustProxyModule
    // Show user-friendly message to user
    showToast("Failed to generate image. Please try again.");
}
```

## Adding New Operations

When adding a new Rust command:

1. Add types to `./types/AITypes.ts` (or appropriate type file)
2. Add method to `RustProxyModule.ts`
3. Add error handling and logging
4. Update this README

Example:

```typescript
public async newOperation(param: string): Promise<Result> {
    try {
        Logger.debug("[RustProxy] newOperation", { param });
        const result = await invoke<Result>("new_operation", { param });
        return result;
    } catch (error) {
        Logger.error("[RustProxy] newOperation failed", { error });
        throw new Error(`Operation failed: ${error}`);
    }
}
```

## Testing

When testing modules that use RustProxyModule:

```typescript
// Mock G.rustProxy methods
jest.mock("../G", () => ({
    G: {
        rustProxy: {
            chatCompletion: jest.fn(),
            generateImage: jest.fn(),
            // ... other methods
        },
        logger: {
            debug: jest.fn(),
            error: jest.fn(),
        },
    },
}));
```

## Related Documentation

- `RUST_PROXY_UNIFICATION_PLAN.md` - Full implementation plan
- `src-tauri/src/ai/` - Rust backend implementation
- `src-tauri/src/commands.rs` - Tauri command definitions
