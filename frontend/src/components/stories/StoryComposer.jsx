import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { useUiStore } from '../../store/uiStore.js';
import { useStoryStore } from '../../store/storyStore.js';
import { compressImage } from '../../services/imageCompression.js';
import { getUploadUrl, postStory } from '../../services/api.js';

const MODAL_ID = 'storyComposer';

// Driven by uiStore's activeModal (opened via useUiStore.getState().openModal('storyComposer')
// from StoryRail's add-affordance), matching Modal's existing convention rather than a per-caller
// isOpen prop.
export default function StoryComposer() {
  const isOpen = useUiStore((s) => s.activeModal === MODAL_ID);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // Reset on the transition *into* open, not on close — resetting on close blanks the preview/
  // caption the instant the modal starts its exit animation, so the user watches stale content
  // vanish mid-close instead of the intact form fading/scaling out. wasOpen tracks the previous
  // render's isOpen so this only fires on a genuine closed->open transition (fresh state each time
  // it's reopened), not on every render while open or while it's closing.
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setFile(null);
      setCaption('');
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  const handleClose = () => {
    useUiStore.getState().closeModal();
  };

  const handlePost = async () => {
    if (!file) return;
    setPosting(true);
    try {
      // Compress before requesting the upload URL — the presigned PUT's signature is bound to the
      // exact mimeType requested, and compression can change the effective mime type.
      const compressed = await compressImage(file);
      const { uploadUrl, objectKey } = await getUploadUrl('photo', compressed.type);
      await fetch(uploadUrl, {
        method: 'PUT',
        body: compressed,
        headers: { 'Content-Type': compressed.type },
      });
      const story = await postStory(objectKey, caption);
      useStoryStore.getState().addStory(story);
      handleClose();
    } catch {
      toast.error('Failed to post story. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal id={MODAL_ID} title="New Story">
      <div className="flex flex-col gap-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm text-ink"
        />

        {previewUrl && (
          <img
            src={previewUrl}
            alt="Story preview"
            className="animate-scale-in max-h-64 w-full rounded-md object-cover"
          />
        )}

        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-ink dark:border-neutral-500/30"
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handlePost} disabled={!file} loading={posting}>
            Post
          </Button>
        </div>
      </div>
    </Modal>
  );
}
