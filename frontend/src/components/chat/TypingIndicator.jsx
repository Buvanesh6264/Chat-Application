export default function TypingIndicator({ chat, typingUserIds }) {
  if (!typingUserIds || typingUserIds.length === 0) return null;

  const names = typingUserIds
    .map((userId) => chat?.participants?.find((p) => p._id === userId)?.name)
    .filter(Boolean);

  if (names.length === 0) return null;

  const text =
    names.length === 1
      ? `${names[0]} is typing…`
      : `${names.join(', ')} are typing…`;

  return <div className="px-4 py-1 text-xs text-neutral-500 italic">{text}</div>;
}
