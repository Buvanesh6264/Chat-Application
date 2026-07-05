---
name: mongoose-schema-skill
description: Standard Mongoose schema boilerplate — timestamps, indexes, TTL indexes, ref population — so schemas aren't re-explained each time one is created or edited.
---

# Mongoose schema pattern

Every schema in `backend/src/models/`:

- Uses `{ timestamps: true }` in the schema options instead of manual `createdAt`/`updatedAt` fields.
- Declares uniqueness/indexing at the field level, not via a separate `schema.index()` call, unless the index is compound: `phoneNumber: { type: String, required: true, unique: true, index: true }`.
- Uses a TTL index for auto-expiring documents by adding `index: { expires: 0 }` on a `Date` field that already holds the absolute expiry time, e.g. `Story.expiresAt`:
  ```js
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
  ```
  (`expires: 0` means "expire exactly at the value stored in this field", not 0 seconds from `createdAt`.)
- References other documents via `{ type: Schema.Types.ObjectId, ref: 'ModelName' }` and relies on `.populate()` at the query site rather than denormalizing data into the schema.
- Keeps enums as a `enum: [...]` validator on a `String` field rather than a separate lookup collection, e.g. `FriendRequest.status`, `Message.type`, `privacySettings.*Visibility`.
- Never stores secrets or derived/cacheable data (e.g. translation results) on the core document if a dedicated cache/service already owns that concern — see `Message.translatedContent` (owned conceptually by `services/translationCache.js` even though it's stored on the document for simplicity).

**After adding or changing a schema**: update the data-model section of `backend/CLAUDE.md` in the same change so it stays the source of truth. This is db-architect's responsibility exclusively — no other agent edits files under `models/`.
