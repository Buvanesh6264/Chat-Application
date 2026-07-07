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

  return (
    <div className="flex animate-fade-in-up items-center px-4 py-1 text-xs text-neutral-500 italic">
      {text}
      <span className="ml-1 inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 animate-bounce-dot rounded-full bg-neutral-500"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
