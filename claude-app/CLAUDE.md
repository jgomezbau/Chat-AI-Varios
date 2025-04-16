# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Run Commands
- `npm start` - Start the app in normal mode
- `npm run dev` - Start with logging enabled
- `npm run debug` - Start in debug mode with inspector
- `npm run build` - Build for all platforms
- `npm run build:linux` - Build for Linux
- `npm run build:appimage` - Build AppImage
- `npm run build:deb` - Build Debian package

## Code Style Guidelines
- **Imports**: Group imports by type (Node built-ins first, then Electron, then local modules)
- **Formatting**: Use 2-space indentation and single quotes for strings
- **Error Handling**: Always use try/catch blocks when dealing with clipboard operations
- **Naming**: Use camelCase for variables/functions, descriptive names for handlers (e.g., handleClipboardCopy)
- **Comments**: Include comments for function purpose and complex logic
- **CSS**: Use CSS variables for theming (colors, sizes)
- **IPC**: Only use whitelisted IPC channels for security
- **Security**: Always validate URL hostnames against allowedDomains lists

## Project Structure
- `main.js` - Main Electron process
- `src/preload/*.js` - Preload scripts for renderer process
- `src/index.html` - Main HTML entry point
- `src/styles.css` - Global styles