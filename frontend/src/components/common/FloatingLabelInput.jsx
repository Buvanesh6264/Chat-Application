export default function FloatingLabelInput({
  id,
  label,
  icon: Icon,
  error,
  rightElement,
  className = '',
  ...rest
}) {
  return (
    <div className={className}>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 dark:text-ink-muted peer-focus:text-primary-500" />
        )}
        <input
          id={id}
          placeholder=" "
          className={`peer w-full rounded-md border bg-transparent pb-2 pt-5 text-sm text-ink transition-shadow duration-150 placeholder-transparent focus-ring-gradient focus:outline-none ${
            Icon ? 'pl-10' : 'pl-3'
          } ${rightElement ? 'pr-10' : 'pr-3'} ${error ? 'border-danger animate-shake' : 'border-neutral-200 dark:border-neutral-500/30'}`}
          {...rest}
        />
        <label
          htmlFor={id}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-neutral-500 dark:text-ink-muted transition-all duration-150 peer-focus:top-4 peer-focus:text-xs peer-focus:text-primary-600 peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-xs ${
            Icon ? 'left-10' : 'left-3'
          }`}
        >
          {label}
        </label>
        {rightElement}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
