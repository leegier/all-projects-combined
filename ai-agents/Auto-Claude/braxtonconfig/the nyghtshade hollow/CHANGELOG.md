## 2.7.1 - Build Pipeline Enhancements

### 🛠️ Improvements

- Enhanced VirusTotal scan error handling in release workflow with graceful failure recovery and improved reporting visibility

- Refactored macOS build workflow to support both Intel and ARM64 architectures with notarization for Intel builds and improved artifact handling

- Streamlined CI/CD processes with updated caching strategies and enhanced error handling for external API interactions

### 📚 Documentation

- Clarified README documentation

---

## What's Changed

- chore: Enhance VirusTotal scan error handling in release workflow by @AndyMik90 in d23fcd8

- chore: Refactor macOS build workflow to support Intel and ARM64 architectures by @AndyMik90 in 326118b

- docs: readme clarification by @AndyMik90 in 6afcc92

- fix: version by @AndyMik90 in 2c93890

## Thanks to all contributors

@AndyMik90

## 2.7.0 - Tab Persistence & Memory System Modernization

### ✨ New Features

- Project tab bar with persistent tab management and GitHub organization initialization on project creation

- Task creation enhanced with @ autocomplete for agent profiles and improved drag-and-drop support

- Keyboard shortcuts and tooltips added to project tabs for better navigation

- Agent task restart functionality with new profile support for flexible task recovery

- Ollama embedding model support with automatic dimension detection for self-hosted deployments

### 🛠️ Improvements

- Memory system completely redesigned with embedded LadybugDB, eliminating Docker/FalkorDB dependency and improving performance

- Tab persistence implemented via IPC-based mechanism for reliable session state management

- Terminal environment improved by using virtual environment Python for proper terminal name generation

- AI merge operations timeout increased from 2 to 10 minutes for reliability with larger changes

- Merge operations now use stored baseBranch metadata for consistent branch targeting