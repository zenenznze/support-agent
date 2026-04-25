# support-agent Architecture Notes

This document will be expanded during implementation.

## Intended shape

`support-agent` should be a standalone HTTP support backend with:

- bounded agent loop;
- direct-hit FAQ/rule path;
- lightweight support-doc retrieval;
- OpenAI-compatible provider abstraction;
- compact persistent memory;
- request traces and latency statistics;
- isolated chatbot-mvp integration path.

## Key design rule

The runtime must not wrap a full interactive CLI for each web request. That was the main reason the Hermes test backend was slower than OpenClaw support.

## Production safety

This repository is not wired into the existing OpenClaw 8787 production route. Any integration must use a new isolated route or service until explicitly approved.
