import Spinner from './Spinner.jsx';

const VARIANT_CLASSES = {
  primary: 'bg-primary-500 hover:bg-primary-600 text-white',
  secondary: 'bg-neutral-200 hover:bg-gray-300 text-neutral-900',
  ghost: 'bg-transparent text-neutral-900 hover:bg-neutral-50',
  danger: 'bg-danger hover:opacity-90 text-white',
};

const SIZE_CLASSES = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
};

// Buttons are compact, so both sizes use the smallest spinner for visual balance.
const SPINNER_SIZE = { md: 'sm', sm: 'sm' };

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  className = '',
  ...rest
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={SPINNER_SIZE[size]} /> : children}
    </button>
  );
}
