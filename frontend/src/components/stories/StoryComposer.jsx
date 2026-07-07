import { useEffect, useMemo, useState } from 'react';
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
  const [error, setError] = useState('');

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // Modal's own backdrop-click/X close bypasses any local handler, so the form is reset whenever
  // the modal transitions closed (not just on our own Cancel/Post button) to avoid stale
  // file/caption state showing up next time it's reopened. Setters are inlined (not a `reset`
  // helper) so exhaustive-deps doesn't ask for a dep that would refire this every render and wipe
  // the caption as the user types.
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setCaption('');
      setError('');
    }
  }, [isOpen]);

  const handleClose = () => {
    useUiStore.getState().closeModal();
  };

  const handlePost = async () => {
    if (!file) return;
    setPosting(true);
    setError('');
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
      setError('Failed to post story. Please try again.');
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
          className="text-sm text-neutral-900"
        />

        {previewUrl && (
          <img src={previewUrl} alt="Story preview" className="max-h-64 w-full rounded-md object-cover" />
        )}

        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
        />

        {error && <p className="text-xs text-danger">{error}</p>}

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
