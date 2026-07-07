import { asyncHandler } from '../utils/asyncHandler.js';
import { createStory, getFeed, viewStory } from '../services/stories.js';
import { serializeStory } from '../utils/serializeStory.js';

export const postStory = asyncHandler(async (req, res) => {
  const { objectKey, caption } = req.body;
  const story = await createStory({ userId: req.user.id, objectKey, caption });
  res.status(201).json({ story: await serializeStory(story, req.user.id) });
});

export const listFeed = asyncHandler(async (req, res) => {
  const stories = await getFeed(req.user.id);
  res.json({ stories: await Promise.all(stories.map((story) => serializeStory(story, req.user.id))) });
});

// Addition beyond the spec's 2-endpoint list — without this, Story.viewedBy would never get
// populated (see backend/CLAUDE.md for the reasoning).
export const markViewed = asyncHandler(async (req, res) => {
  const story = await viewStory({ viewerId: req.user.id, storyId: req.params.id });
  res.json({ story: await serializeStory(story, req.user.id) });
});
