---
name: groq-call-skill
description: Reusable wrapper pattern for Groq speech-to-text and translation calls, including retry/backoff, the async-transcription flow, and the translation cache-check.
---

# Groq call pattern

All Groq calls go through `services/groq.js` (ai-integration's territory) — two exported functions:

```js
export const transcribeAudio = async (audioUrl) => withRetry(() => groqClient.audio.transcriptions.create({ ... }));
export const translateText = async (text, targetLang) => withRetry(() => groqClient.chat.completions.create({ ... }));
```

**Retry/backoff**: wrap every Groq call in a small `withRetry(fn, { retries: 3, baseDelayMs: 300 })` helper using exponential backoff, only retrying on transient errors (429/5xx), not on 4xx validation errors.

**Transcription is asynchronous**, not part of the message-send request/response cycle:
1. Voice-note message is created immediately with `transcript: null`.
2. `ai-integration` fetches the audio bytes from the Supabase URL and calls `transcribeAudio`.
3. Once it resolves, the message document is updated and a follow-up socket event (coordinate exact name with socket-engineer, e.g. `message:transcript-ready`) delivers the transcript to participants.
4. The sender can edit the transcript afterward — store the edit as `transcript` + `transcriptEdited: true`, keeping the raw Groq output recoverable only via re-transcription, not a separate "original" field.

**Translation is recipient-requested-on-read**, not sender-picks-before-send: always check `services/translationCache.js` for `(messageId, targetLanguage)` before calling `translateText`; only call Groq on a cache miss, then write the result back to both the cache and `Message.translatedContent`.
