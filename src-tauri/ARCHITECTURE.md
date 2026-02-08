# Rust Backend Architecture

## Overview

The Rust backend serves as a proxy layer between the frontend (React/TypeScript) and AI providers (OpenAI, Anthropic, etc.), with integrated support for Model Context Protocol (MCP) tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│                  AIService (TypeScript)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ Tauri Commands
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Rust Backend (Tauri)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              AI Proxy (Orchestrator)                     ││
│  │  • Provider Management                                   ││
│  │  • Model Configuration                                   ││
│  │  • MCP Tools Integration                                 ││
│  └──────────┬─────────────────────────────────────────────┬┘│
│             ▼                                               ▼ │
│  ┌──────────────────────┐              ┌────────────────────┤
│  │  Provider System     │              │   MCP Client       ││
│  │  ┌────────────────┐  │              │  • Server Manager  ││
│  │  │ OpenAI         │  │              │  │   Tools         ││
│  │  │ Anthropic      │  │              │  • Tool Execution  ││
│  │  │ Custom         │  │              └────────────────────┤
│  │  └────────────────┘  │                                    │
│  └──────────────────────┘                                    │
└───────────┬──────────────────────────────────────────┬───────┘
            ▼                                          ▼
   ┌────────────────┐                        ┌──────────────────┐
   │ AI Providers   │                        │  MCP Servers     │
   │ (OpenAI, etc.) │                        │  (npx, python)   │
   └────────────────┘                        └──────────────────┘
```

## Module Structure

### `/src/ai/`
Core AI functionality:
- **`error.rs`**: Error types and handling
- **`types.rs`**: Shared types (messages, requests, responses)
- **`provider.rs`**: `AIProvider` trait - common interface for all providers
- **`providers/`**: Provider implementations
  - `openai.rs` - OpenAI provider
  - `anthropic.rs` - Anthropic provider (to be implemented)
- **`proxy.rs`**: Main orchestrator that manages providers and MCP integration

### `/src/mcp/`
Model Context Protocol integration:
- **`types.rs`**: MCP-specific types (servers, tools, status)
- **`client.rs`**: MCP client manager for connecting to MCP servers

### `/src/commands.rs`
Tauri commands exposed to frontend:
- `register_provider` - Register AI provider with credentials
- `set_models` - Configure available models
- `chat_completion` - Main chat endpoint (auto-includes MCP tools)
- `add_mcp_server` - Connect to MCP server
- `list_mcp_servers` - List MCP servers and their tools

## Key Features

### 1. Provider System
The `AIProvider` trait defines a common interface:
```rust
#[async_trait]
pub trait AIProvider {
    fn name(&self) -> &str;
    fn supports_streaming(&self) -> bool;
    fn supports_tools(&self) -> bool;
    async fn chat_completion(&self, request: ChatCompletionRequest)
        -> AIResult<ChatCompletionResponse>;
}
```

### 2. AI Proxy
Central orchestrator that:
- Manages multiple AI providers
- Routes requests to appropriate provider based on model
- Automatically injects MCP tools into requests
- Thread-safe with `Arc<RwLock<>>`

### 3. MCP Integration
- Connects to MCP servers via stdio/HTTP (JSON-RPC 2.0)
- Aggregates tools from all connected servers
- Automatically adds tools to AI requests
- Future: Tool execution and result handling

## Data Flow

### Chat Completion Flow
1. Frontend calls `chat_completion` Tauri command
2. Backend retrieves MCP tools from connected servers
3. AI Proxy injects tools into request
4. Request routed to appropriate provider (based on model)
5. Provider calls AI API
6. Response returned to frontend

### MCP Integration Flow
1. Frontend adds MCP server via `add_mcp_server`
2. Backend spawns MCP server process (e.g., `npx @modelcontextprotocol/server-*`)
3. JSON-RPC connection established over stdio
4. Tools listed and cached
5. Tools automatically included in all chat completions

## Frontend Integration

### Old Architecture (Legacy)
```typescript
// Direct browser call (insecure)
const openai = new OpenAI({
    apiKey: key,
    dangerouslyAllowBrowser: true
});
await openai.chat.completions.create({ ... });
```

### New Architecture
```typescript
// Through Rust backend (secure)
import { invoke } from '@tauri-apps/api/core';

await invoke('chat_completion', {
    request: {
        model: 'gpt-4',
        messages: [...],
        temperature: 0.7,
    }
});
```

## Configuration

### Provider Registration
```typescript
await invoke('register_provider', {
    name: 'openai',
    config: {
        name: 'openai',
        api_key: 'sk-...',
        base_url: 'https://api.openai.com/v1', // optional
    }
});
```

### Model Configuration
```typescript
await invoke('set_models', {
    models: [
        {
            id: 'gpt-4',
            name: 'GPT-4',
            provider: 'openai',
            visible: true
        },
        // ... more models
    ]
});
```

### MCP Server
```typescript
await invoke('add_mcp_server', {
    config: {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
    }
});
```

## Security Benefits

1. **API Keys Protected**: Never exposed to browser/frontend
2. **CORS Bypass**: Backend makes API calls, no CORS issues
3. **Rate Limiting**: Can implement centralized rate limiting
4. **Request Validation**: Backend validates all requests
5. **Audit Logging**: Can log all API interactions

## Future Enhancements

### Phase 1 (Current)
- [x] Provider trait and OpenAI implementation
- [x] AI Proxy orchestrator
- [x] MCP client structure
- [x] Tauri commands
- [ ] Frontend integration

### Phase 2
- [ ] Full MCP protocol implementation (using rmcp SDK)
- [ ] Tool execution and result handling
- [ ] Anthropic provider
- [ ] Custom provider support

### Phase 3
- [ ] Streaming support
- [ ] Response caching
- [ ] Rate limiting
- [ ] Request/response middleware
- [ ] Plugin system for custom providers

### Phase 4
- [ ] Multi-provider fallback
- [ ] Cost tracking
- [ ] Usage analytics
- [ ] Advanced error recovery

## Development

### Building
```bash
cd src-tauri
cargo build
```

### Testing
```bash
cargo test
```

### Adding a New Provider
1. Create `src/ai/providers/yourprovider.rs`
2. Implement `AIProvider` trait
3. Add to `providers/mod.rs`
4. Add case in `AIProxy::register_provider`

## References

- [Model Context Protocol Spec](https://modelcontextprotocol.io/specification)
- [rmcp SDK](https://github.com/modelcontextprotocol/rust-sdk)
- [Tauri Commands](https://tauri.app/develop/calling-rust/)
