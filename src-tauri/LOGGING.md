# Backend Communication Logging

Prosty system logowania komunikacji między frontendem a backendem Rust/Tauri.

## Jak włączyć logowanie

Ustaw zmienną `ASSISTANT_LOG_LEVEL` przed uruchomieniem aplikacji:

```bash
# Włącz logowanie (zalecane do debugowania)
ASSISTANT_LOG_LEVEL=info pnpm tauri dev

# Wyłącz logowanie (domyślne)
pnpm tauri dev
```

### Inne sposoby:

```bash
# macOS/Linux - eksport na całą sesję terminala
export ASSISTANT_LOG_LEVEL=info
pnpm tauri dev

# Windows (PowerShell)
$env:ASSISTANT_LOG_LEVEL="info"
pnpm tauri dev

# Windows (CMD)
set ASSISTANT_LOG_LEVEL=info
pnpm tauri dev
```

## Co jest logowane

Gdy logowanie jest włączone, zobaczysz:

### 📥 Frontend → Backend (Requesty)

Wywołania komend z frontendu:
```
📥 FRONTEND → BACKEND [chat_completion]
{
  "model": "gpt-4",
  "messages": [...]
}
```

### 📤 Backend → Frontend (Odpowiedzi)

Odpowiedzi z backendu:
```
📤 BACKEND → FRONTEND [chat_completion]
{
  "response": "...",
  "usage": {...}
}
```

### ❌ Błędy

```
❌ BACKEND → FRONTEND [chat_completion] ERROR: Model not found
```

### 📡 Eventy (Streaming)

Eventi wysyłane podczas streamingu:
```
📡 BACKEND EVENT → FRONTEND [stream-chunk-session123]
{
  "delta": "Hello"
}

📡 BACKEND EVENT → FRONTEND [stream-done-session123]
```

## Przykładowy output

```
🔧 Backend logging ENABLED (ASSISTANT_LOG_LEVEL=info)

📥 FRONTEND → BACKEND [chat_completion_stream]
{
  "request": {
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "Hello!"
      }
    ]
  },
  "session_id": "abc123"
}

📤 BACKEND → FRONTEND [chat_completion_stream]
"Stream started"

📡 BACKEND EVENT → FRONTEND [stream-chunk-abc123]
{
  "delta": "Hello"
}

📡 BACKEND EVENT → FRONTEND [stream-chunk-abc123]
{
  "delta": " there!"
}

📡 BACKEND EVENT → FRONTEND [stream-done-abc123]
```

## Które komendy są logowane?

Obecnie logowane są główne komendy komunikacji z AI:
- `chat_completion` - zwykłe zapytania do AI
- `chat_completion_stream` - streaming zapytania do AI

Inne komendy (register_provider, set_models, itp.) nie są logowane aby nie zaśmiecać outputu.

## Bezpieczeństwo

⚠️ **WAŻNE**: Logowanie pokazuje pełne requesty i odpowiedzi, włącznie z:
- API keys
- Treść wiadomości
- Dane użytkownika

**Używaj logowania tylko w trybie deweloperskim!**

## Wyłączanie logowania

Po prostu nie ustawiaj zmiennej `ASSISTANT_LOG_LEVEL`:

```bash
pnpm tauri dev
```

## Implementacja

System logowania to prosty moduł wykorzystujący:
- **src-tauri/src/logger.rs** - Funkcje logowania używające `println!`
- **log_command! makro** - Automatyczne logowanie requestów i odpowiedzi
- **AtomicBool** - Sprawdzanie czy logowanie jest włączone (zero overhead gdy wyłączone)

Gdy logowanie jest wyłączone, wszystkie funkcje logujące natychmiast zwracają bez żadnych operacji.

## Rozszerzanie

Aby dodać logowanie do nowej komendy:

```rust
use crate::log_command;

#[tauri::command]
pub async fn my_command(param: String) -> Result<String, String> {
    log_command!("my_command", serde_json::json!({ "param": param }), {
        // Your command logic
        Ok("result".to_string())
    })
}
```

Lub dla bardziej skomplikowanych przypadków:

```rust
crate::logger::log_command_request("my_command", &request);
// ... your logic ...
crate::logger::log_command_response("my_command", &response);
```
