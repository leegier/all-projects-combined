# Contributing to Auto Claude

Thank you for your interest in contributing to Auto Claude! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
  - [Python Backend](#python-backend)
  - [Electron Frontend](#electron-frontend)
- [Running from Source](#running-from-source)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Code Style](#code-style)
- [Testing](#testing)
- [Continuous Integration](#continuous-integration)
- [Git Workflow](#git-workflow)
  - [Branch Overview](#branch-overview)
  /* Lines 19-25 omitted */
  - [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Architecture Overview](#architecture-overview)

## Prerequisites

Before contributing, ensure you have the following installed:

- **Python 3.12+** - For the backend framework
- **Node.js 24+** - For the Electron frontend
- **npm 10+** - Package manager for the frontend (comes with Node.js)
- **uv** (recommended) or **pip** - Python package manager
- **Git** - Version control

### Installing Python 3.12

**Windows:**
```bash
winget install Python.Python.3.12
```

**macOS:**
```bash
brew install python@3.12
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install python3.12 python3.12-venv
```

## Quick Start

The fastest way to get started:

```bash
# Clone the repository
git clone https://github.com/AndyMik90/Auto-Claude.git
cd Auto-Claude

# Install all dependencies (cross-platform)
npm run install:all

# Run in development mode
npm run dev

# Or build and run production
npm start
```

## Development Setup

The project consists of two main components:

1. **Python Backend** (`apps/backend/`) - The core autonomous coding framework
2. **Electron Frontend** (`apps/frontend/`) - Optional desktop UI

### Python Backend