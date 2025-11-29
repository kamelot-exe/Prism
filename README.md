# Prism Calendar

Desktop calendar application built with Tauri, Svelte, TypeScript, and SQLite.

## Features

- 📅 Multiple view modes (Month, Week, Day)
- 🎨 Theme engine with light/dark themes
- 📝 Event management (create, update, delete)
- 🏷️ Category system with colors
- 💾 SQLite database for data persistence
- 🔧 Settings management
- 🔄 Google Calendar integration (read-only sync)

## Tech Stack

- **Frontend**: Svelte + TypeScript
- **Backend**: Tauri (Rust)
- **Database**: SQLite with sqlx
- **Routing**: svelte-routing

## Project Structure

```
Prism/
├── src/                    # Frontend (Svelte)
│   ├── components/         # Svelte components
│   │   └── views/         # Calendar views (Month, Week, Day)
│   ├── stores/            # Svelte stores
│   ├── styles/            # CSS styles
│   ├── lib/               # Utility functions and API
│   └── App.svelte         # Main app component
├── src-tauri/             # Backend (Rust)
│   ├── src/
│   │   ├── api/           # Tauri commands
│   │   ├── db/            # Database module
│   │   └── gmail/         # Gmail integration (placeholder)
│   └── Cargo.toml         # Rust dependencies
└── themes/                # Theme JSON files
```

## Development

### Prerequisites

- Node.js (v18+)
- Rust (latest stable) - [Install Rust](https://www.rust-lang.org/tools/install)
- Tauri CLI (installed via npm)

#### Installing Rust on Windows

**Option 1: Automatic installation via PowerShell (Recommended)**

Run this command in PowerShell (as Administrator if needed):

```powershell
# Download and install Rust
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "$env:TEMP\rustup-init.exe"; & "$env:TEMP\rustup-init.exe" -y

# Add Rust to PATH for current session
$env:Path += ";$env:USERPROFILE\.cargo\bin"

# Verify installation
rustc --version
cargo --version
```

**Option 2: Manual installation**

1. Download and run [rustup-init.exe](https://win.rustup.rs/x86_64)
2. Follow the installation wizard
3. Restart your terminal/PowerShell after installation
4. Verify installation:
   ```bash
   rustc --version
   cargo --version
   ```

**Note:** 
- Rust installation includes `cargo` (Rust's package manager) automatically
- After installation, restart your terminal or run: `refreshenv` (if using Chocolatey) or manually add `%USERPROFILE%\.cargo\bin` to your PATH

### Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run tauri:dev
```

### Build

```bash
npm run tauri:build
```

## Database Schema

- **events**: Calendar events
- **categories**: Event categories
- **settings**: Application settings
- **migrations**: Database migration tracking

## Tauri Commands

- `get_events` - Retrieve events (optionally filtered by date range)
- `create_event` - Create a new event
- `update_event` - Update an existing event
- `delete_event` - Delete an event
- `list_categories` - Get all categories
- `create_category` - Create a new category
- `gmail_get_auth_url` - Get Google OAuth authorization URL
- `gmail_wait_for_callback` - Wait for OAuth callback code
- `gmail_exchange_code` - Exchange OAuth code for tokens
- `sync_gmail` - Sync Google Calendar events to local database
- `gmail_disconnect` - Clear stored OAuth tokens

## Google Calendar Integration

Prism Calendar supports one-way synchronization from Google Calendar (read-only).

### Setup

1. **Create Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Calendar API
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Choose "Desktop app" as the application type
   - Add `http://localhost:8080/oauth/callback` as an authorized redirect URI
   - Save your Client ID and Client Secret

2. **Configure Environment Variables:**
   ```bash
   # Windows PowerShell
   $env:GOOGLE_CLIENT_ID="your-client-id"
   $env:GOOGLE_CLIENT_SECRET="your-client-secret"
   
   # Linux/Mac
   export GOOGLE_CLIENT_ID="your-client-id"
   export GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

3. **Usage:**
   - Call `gmail_get_auth_url()` to get the authorization URL and open it in the browser
   - Call `gmail_wait_for_callback()` to wait for the OAuth callback
   - Call `gmail_exchange_code(code)` to exchange the code for tokens
   - Call `sync_gmail(time_min, time_max)` to sync events from Google Calendar

### Security

- Refresh tokens are stored securely using the system credential manager (Windows Credential Vault on Windows, Keychain on macOS, Secret Service on Linux)
- Access tokens are automatically refreshed when expired
- Only read-only access to Google Calendar is requested

## License

MIT

