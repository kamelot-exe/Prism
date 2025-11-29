# Установка и запуск Prism Calendar

## Требования

- Node.js 18+ 
- Rust (последняя стабильная версия)
- Tauri CLI

## Установка зависимостей

1. Установите Rust (если еще не установлен):
```bash
# Windows
# Скачайте и установите с https://rustup.rs/

# Linux/Mac
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Установите системные зависимости для Tauri:
   - Windows: Visual Studio Build Tools или Visual Studio с компонентами C++
   - Linux: `sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
   - macOS: Xcode Command Line Tools

3. Установите зависимости проекта:
```bash
npm install
```

## Запуск в режиме разработки

```bash
npm run tauri:dev
```

Это команда:
- Запустит Vite dev server для фронтенда
- Скомпилирует и запустит Tauri приложение
- Откроет окно приложения

## Сборка для production

```bash
npm run tauri:build
```

Собранные файлы будут в `src-tauri/target/release/`

## Структура проекта

```
Prism/
├── src/                    # Frontend (Svelte + TypeScript)
│   ├── components/         # Компоненты Svelte
│   │   └── views/         # Представления календаря
│   ├── stores/            # Svelte stores
│   ├── styles/            # CSS стили
│   └── lib/               # Утилиты и API клиент
├── src-tauri/             # Backend (Rust)
│   ├── src/
│   │   ├── api/           # Tauri команды
│   │   ├── db/            # Модуль базы данных
│   │   └── gmail/         # Интеграция Gmail (заглушка)
│   └── Cargo.toml         # Rust зависимости
└── themes/                # JSON файлы тем
```

## База данных

База данных SQLite автоматически создается при первом запуске в:
- Windows: `%APPDATA%\prism-calendar\prism_calendar.db`
- Linux: `~/.local/share/prism-calendar/prism_calendar.db`
- macOS: `~/Library/Application Support/prism-calendar/prism_calendar.db`

Миграции выполняются автоматически при инициализации.

## Решение проблем

### Ошибка компиляции Rust
Убедитесь, что установлены все системные зависимости для Tauri.

### Ошибка подключения к базе данных
Проверьте права доступа к директории app data.

### Проблемы с зависимостями npm
Попробуйте удалить `node_modules` и `package-lock.json`, затем выполните `npm install` заново.

