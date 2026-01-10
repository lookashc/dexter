#!/bin/bash
cd "$(dirname "$0")"
exec bun run src/mcp-server.ts
