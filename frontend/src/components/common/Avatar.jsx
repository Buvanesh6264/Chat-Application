const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-24 h-24 text-3xl',
};

const DOT_SIZE_CLASSES = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

function getInitials(name) {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export default function Avatar({ src, name, size = 'md', online, hasUnviewedStory, onClick }) {
  const sizeClasses = SIZE_CLASSES[size];

  // Three distinct ring states: undefined (no stories) -> no ring, false (all viewed) -> dim ring,
  // true (unviewed) -> colored ring + a slow pulse to draw the eye, matching the Telegram-style
  // "unviewed story" convention.
  let ringClasses = '';
  if (hasUnviewedStory === true) {
    ringClasses = 'ring-2 ring-primary-500 ring-offset-2 animate-pulse-ring';
  } else if (hasUnviewedStory === false) {
    ringClasses = 'ring-2 ring-neutral-200 ring-offset-2';
  }

  const Wrapper = onClick ? 'button' : 'div';
  // Only interactive avatars get a hover affordance — a purely-decorative avatar shouldn't hint
  // clickability it doesn't have.
  const interactiveClasses = onClick ? 'transition-transform duration-150 hover:scale-105' : '';

  // Signature brand moment: an animated gradient ring for online presence, distinct from the
  // story-unviewed ring above. Only shown at sizes with room to read as a ring rather than
  // noise — 'sm' keeps the plain dot instead (see below).
  const showGradientRing = online === true && size !== 'sm';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative inline-flex shrink-0 rounded-full ${ringClasses} ${interactiveClasses}`}
    >
      {showGradientRing && (
        <>
          <span
            aria-hidden="true"
            className="absolute -inset-[3px] rounded-full bg-gradient-primary animate-ring-glow"
          />
          <span
            aria-hidden="true"
            className="absolute -inset-[1px] rounded-full bg-surface dark:bg-elevated"
          />
        </>
      )}

      <span className="relative">
        {src ? (
          <img
            src={src}
            alt={name || 'Avatar'}
            className={`${sizeClasses} rounded-full object-cover`}
          />
        ) : (
          <span
            className={`${sizeClasses} flex items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-500/30 dark:text-ink`}
          >
            {getInitials(name)}
          </span>
        )}
      </span>

      {/* online === null/undefined means "unknown" and must not render a dot at all; only
          explicit true/false render a dot. Online true only gets a dot at 'sm' — larger sizes
          use the gradient ring above instead, so the two indicators never double up. */}
      {online === true && size === 'sm' && (
        <span
          className={`absolute right-0 bottom-0 ${DOT_SIZE_CLASSES[size]} rounded-full bg-online ring-2 ring-white`}
        />
      )}
      {online === false && (
        <span
          className={`absolute right-0 bottom-0 ${DOT_SIZE_CLASSES[size]} rounded-full bg-offline ring-2 ring-white`}
        />
      )}
    </Wrapper>
  );
}
