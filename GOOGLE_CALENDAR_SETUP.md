# Google Calendar Integration Setup Guide

## Overview

Prism Calendar integrates with Google Calendar using OAuth2 Desktop Flow. The integration is read-only (one-way sync from Google Calendar to local database).

## Prerequisites

1. Google Cloud Console account
2. A Google Cloud project with Google Calendar API enabled

## Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure the OAuth consent screen first:
     - Choose "External" user type
     - Fill in required fields (App name, User support email, Developer contact)
     - Add scopes: `https://www.googleapis.com/auth/calendar.readonly`
     - Add test users if needed
   - For OAuth client:
     - Application type: **Desktop app**
     - Name: "Prism Calendar" (or any name)
     - Authorized redirect URIs: `http://localhost:8080/oauth/callback`
   - Click "Create"
   - **Save your Client ID and Client Secret** - you'll need them in the next step

## Step 2: Configure Environment Variables

Set the following environment variables before running the application:

### Windows (PowerShell)
```powershell
$env:GOOGLE_CLIENT_ID="your-client-id-here"
$env:GOOGLE_CLIENT_SECRET="your-client-secret-here"
```

### Windows (Command Prompt)
```cmd
set GOOGLE_CLIENT_ID=your-client-id-here
set GOOGLE_CLIENT_SECRET=your-client-secret-here
```

### Linux/Mac
```bash
export GOOGLE_CLIENT_ID="your-client-id-here"
export GOOGLE_CLIENT_SECRET="your-client-secret-here"
```

## Step 3: Usage in Your Application

### Frontend Example (TypeScript/Svelte)

```typescript
import { invoke } from '@tauri-apps/api/core';

// Step 1: Get authorization URL and open browser
async function authenticateGoogle() {
  try {
    const { url, state } = await invoke('gmail_get_auth_url');
    // Browser should open automatically
    // User will authorize the application
    
    // Step 2: Wait for callback
    const code = await invoke('gmail_wait_for_callback');
    
    // Step 3: Exchange code for tokens
    const tokenInfo = await invoke('gmail_exchange_code', { code });
    
    console.log('Authentication successful!');
    return tokenInfo;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

// Step 4: Sync events from Google Calendar
async function syncGoogleCalendar() {
  try {
    // Sync events for the next 30 days
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const count = await invoke('sync_gmail', {
      timeMin,
      timeMax,
    });
    
    console.log(`Synced ${count} events from Google Calendar`);
    return count;
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

// Disconnect (clear tokens)
async function disconnectGoogle() {
  try {
    await invoke('gmail_disconnect');
    console.log('Disconnected from Google Calendar');
  } catch (error) {
    console.error('Disconnect failed:', error);
    throw error;
  }
}
```

## How It Works

1. **OAuth Flow:**
   - Application generates an authorization URL
   - System browser opens with Google's authorization page
   - User grants permission
   - Google redirects to `http://localhost:8080/oauth/callback` with an authorization code
   - Local HTTP server (running on port 8080) receives the callback
   - Application exchanges the code for access and refresh tokens

2. **Token Storage:**
   - Refresh token is stored securely using the system credential manager:
     - Windows: Windows Credential Vault
     - macOS: Keychain
     - Linux: Secret Service
   - Access tokens are cached in memory and automatically refreshed when expired

3. **Synchronization:**
   - Events are fetched from Google Calendar API
   - Events are mapped to local database with:
     - `source = 'gmail'`
     - `external_id = Google Calendar event ID`
   - Existing events (matched by `source` and `external_id`) are updated
   - New events are inserted
   - Only read-only access is used (no events are created/modified in Google Calendar)

## Troubleshooting

### Port 8080 Already in Use

If port 8080 is already in use, you can modify the redirect URL in:
- `src-tauri/src/api/gmail.rs` - Change the port in `redirect_url`
- Update the redirect URI in Google Cloud Console to match

### Authentication Fails

- Verify that environment variables are set correctly
- Check that the redirect URI in Google Cloud Console matches `http://localhost:8080/oauth/callback`
- Ensure Google Calendar API is enabled in your project
- Check that the OAuth consent screen is properly configured

### Sync Fails

- Verify that you have a valid refresh token (try re-authenticating)
- Check network connectivity
- Verify that the Google Calendar API is accessible
- Check application logs for detailed error messages

## Security Notes

- Never commit your Client ID and Client Secret to version control
- Use environment variables or a secure configuration system
- Refresh tokens are stored securely using the system credential manager
- Only read-only access is requested from Google Calendar
- Access tokens are automatically refreshed and not stored permanently

