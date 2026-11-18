# Release Process

This document describes how releases are created for Auto Claude.

## Overview

Auto Claude uses an automated release pipeline that ensures releases are only published after all builds succeed. This prevents version mismatches between documentation and actual releases.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RELEASE FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   develop branch                    main branch                              │
│   ──────────────                    ───────────                              │
│        │                                 │                                   │
│        │  1. bump-version.js             │                                   │
│        │     (creates commit)            │                                   │
│        │                                 │                                   │
│        ▼                                 │                                   │
│   ┌─────────┐                           │                                   │
│   │ v2.8.0  │  2. Create PR             │                                   │
│   │ commit  │ ────────────────────►     │                                   │
│   └─────────┘                           │                                   │
│                                          │                                   │
│                           3. Merge PR    ▼                                   │
│                                    ┌──────────┐                              │
│                                    │ v2.8.0   │                              │
│                                    │ on main  │                              │
│                                    └────┬─────┘                              │