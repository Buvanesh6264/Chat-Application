const SIZE_PX = { sm: 16, md: 20, lg: 24 };

export default function Spinner({ size = 'md' }) {
  const px = SIZE_PX[size];

  return (
    <svg
      className="animate-spin text-current"
      style={{ width: px, height: px }}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
