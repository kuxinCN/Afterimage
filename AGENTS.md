# Afterimage Project Rules

## 1. Project Overview

Afterimage is an AI-powered personal memory
reconstruction and exploration platform.

The MVP focuses on:

Memory Import
AI Understanding
Memory Review
2.5D Scene Generation
Hotspot Exploration
Local Persistence

## 2. Technology Stack

- Next.js 14.2
- React 18
- App Router
- JavaScript
- Tailwind CSS 3.4
- IndexedDB
- Zod

Do not change the technology stack
without explicit approval.

## 3. Architecture Rules

- Keep UI and business logic separated.
- AI requests must go through server-side APIs.
- Never expose API keys to the browser.
- Use Repository modules for data access.
- Use Zod to validate external data.
- Keep scene generation independent
  from React rendering.

## 4. Data Rules

- Use UUID for entity IDs.
- Persist images as Blob in IndexedDB.
- Never persist Blob URLs.
- Preserve relationships between Memory,
  Asset, Scene and Exploration.

## 5. Memory Authenticity

Every information item must identify
its source:

- user_confirmed
- image_observed
- ai_inferred
- fictional

Never present AI inference as confirmed fact.

Never invent real people identities
or personal relationships.

## 6. Development Rules

- Inspect existing code before modification.
- Prefer minimal changes.
- Do not rewrite unrelated modules.
- Do not create unnecessary dependencies.
- Do not implement future features prematurely.
- Test each stage before continuing.

## 7. MVP Scope

Do not implement:

- Full 3D environments
- Museum collection system
- Multiple identity system
- AI character interaction
- Complex social features

unless explicitly requested.
