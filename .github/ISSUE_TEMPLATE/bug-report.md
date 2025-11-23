---
name: Bug Report
about: Create a report to help us improve
title: ''
labels: ''
assignees: ''

---

#  Bug Report

**Describe the bug**  
A clear and concise description of what the issue is (e.g., empty catalog, streams not loading, metadata missing, addon not loading, etc.).

---

## To Reproduce
Steps to reproduce the behavior:
1. Open Stremio (Desktop / Web / Mobile)
2. Add the addon via URL
3. Attempt to open catalog / stream / meta
4. See the error or unexpected behavior

---

## Expected behavior
A clear description of what you expected to happen instead.

---

## Screenshots / Logs
If applicable, attach:
- Screenshots from Stremio  
- Terminal output from `npm start` or Docker logs  
- Any API error messages or stack traces  

---

## Environment

### Stremio
- **App version:**  
- **Platform:** (Desktop / Web / Mobile)

### Addon
- **Addon version / commit hash:**  
- **Running:** (Local via `npm start`, Docker, server, etc.)  
- **Node.js version:**  

### System
- **OS:** (Windows, macOS, Linux, etc.)

---

## Endpoint Diagnostics (optional)
If certain routes are failing, include their responses:

- `/manifest.json`  
- `/catalog/<type>/<id>.json`  
- `/meta/<type>/<id>.json`  
- `/stream/<type>/<id>.json`  

Paste JSON or error messages if available.

---

## Additional context
Add any other relevant details here (API limits, wrong IDs, network issues, steps tried, etc.).
