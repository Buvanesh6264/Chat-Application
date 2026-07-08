import { useEffect, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Send, Paperclip, Smile, Mic, Square, Image as ImageIcon, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSocket } from '../../services/socket.js';
import { compressImage } from '../../services/imageCompression.js';
import { uploadObject } from '../../services/uploadHelpers.js';

const TYPING_IDLE_MS = 2000;

const MAX_SIZES = {
  photo: 10 * 1024 * 1024,
  voice: 25 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
};

export default function MessageComposer({ chatId }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [error, setError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sending, setSending] = useState(false);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const photoInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordIntervalRef = useRef(null);
  const recordStartRef = useRef(null);

  const emitTypingStop = () => {
    if (isTypingRef.current) {
      getSocket()?.emit('typing:stop', { chatId });
      isTypingRef.current = false;
    }
    clearTimeout(typingTimeoutRef.current);
  };

  useEffect(() => {
    return () => emitTypingStop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (!isTypingRef.current) {
      getSocket()?.emit('typing:start', { chatId });
      isTypingRef.current = true;
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(emitTypingStop, TYPING_IDLE_MS);
  };

  const handleEmojiClick = (emojiData) => {
    setText((t) => t + emojiData.emoji);
  };

  const sendMessage = (payload) => {
    setSending(true);
    const socket = getSocket();
    socket?.emit('message:send', { chatId, ...payload }, (res) => {
      setSending(false);
      if (res?.ok) {
        setText('');
      } else {
        const message = res?.error || 'Failed to send message';
        setError(message);
        toast.error(message);
      }
    });
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    emitTypingStop();
    sendMessage({ type: 'text', content: text.trim() });
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setShowAttach(false);
    setError(null);
    if (file.size > MAX_SIZES.photo) {
      setError('Photo exceeds 10MB limit');
      return;
    }
    try {
      const compressed = await compressImage(file);
      const objectKey = await uploadObject('photo', compressed);
      sendMessage({ type: 'photo', objectKey, content: text.trim() || undefined });
    } catch {
      setError('Photo upload failed');
    }
  };

  const handlePdfChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setShowAttach(false);
    setError(null);
    if (file.size > MAX_SIZES.pdf) {
      setError('PDF exceeds 20MB limit');
      return;
    }
    try {
      const objectKey = await uploadObject('pdf', file);
      sendMessage({ type: 'pdf', objectKey, content: text.trim() || undefined });
    } catch {
      setError('PDF upload failed');
    }
  };

  const startRecording = async () => {
    setShowAttach(false);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordIntervalRef.current);
        const durationSeconds = Math.round((Date.now() - recordStartRef.current) / 1000);
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        if (blob.size > MAX_SIZES.voice) {
          setError('Voice message exceeds 25MB limit');
          setRecording(false);
          return;
        }
        try {
          const objectKey = await uploadObject('voice', blob);
          sendMessage({ type: 'voice', objectKey, durationSeconds });
        } catch {
          setError('Voice message upload failed');
        }
        setRecording(false);
        setRecordSeconds(0);
      };
      mediaRecorderRef.current = recorder;
      recordStartRef.current = Date.now();
      recorder.start();
      setRecording(true);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds(Math.round((Date.now() - recordStartRef.current) / 1000));
      }, 500);
    } catch {
      setError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  return (
    <div className="shrink-0 border-t border-neutral-200 px-3 py-2 dark:border-neutral-500/30">
      {error && <div className="mb-1 text-xs text-danger">{error}</div>}

      {recording ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-danger">Recording… {recordSeconds}s</span>
          <button type="button" onClick={stopRecording} aria-label="Stop recording" className="icon-btn">
            <Square className="h-5 w-5 animate-pulse text-danger" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSendText} className="flex items-end gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttach((v) => !v)}
              aria-label="Attach"
              className="icon-btn"
            >
              <Paperclip className="h-5 w-5 text-neutral-500 dark:text-ink-muted" />
            </button>
            {showAttach && (
              <div className="absolute bottom-8 left-0 z-10 w-40 rounded-md border border-neutral-200 bg-white py-1 text-ink shadow-lg dark:border-neutral-500/30 dark:bg-elevated">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-surface"
                >
                  <ImageIcon className="h-4 w-4" /> Photo
                </button>
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-surface"
                >
                  <FileText className="h-4 w-4" /> PDF
                </button>
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-surface"
                >
                  <Mic className="h-4 w-4" /> Voice
                </button>
              </div>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfChange}
            />
          </div>

          <div className="relative">
            <button type="button" onClick={() => setShowEmoji((v) => !v)} aria-label="Emoji" className="icon-btn">
              <Smile className="h-5 w-5 text-neutral-500 dark:text-ink-muted" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-8 left-0 z-10">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
          </div>

          <input
            value={text}
            onChange={handleTextChange}
            placeholder="Type a message"
            className="flex-1 rounded-full border border-neutral-200 px-4 py-2 text-sm text-ink focus:outline-none dark:border-neutral-500/30"
          />

          <button type="submit" disabled={!text.trim() || sending} aria-label="Send" className="icon-btn">
            <Send className="h-5 w-5 text-primary-500" />
          </button>
        </form>
      )}
    </div>
  );
}
