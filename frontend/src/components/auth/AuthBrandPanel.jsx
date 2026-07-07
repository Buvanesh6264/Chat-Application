import { MessageCircle } from 'lucide-react';

export default function AuthBrandPanel({ tagline }) {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-primary lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:p-12">
      <span
        aria-hidden="true"
        className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-white/20 blur-3xl animate-blob-drift"
      />
      <span
        aria-hidden="true"
        className="absolute -right-10 top-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl animate-blob-drift"
        style={{ animationDelay: '4s' }}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-white/15 blur-3xl animate-blob-drift"
        style={{ animationDelay: '8s' }}
      />
      <div className="relative z-10 flex max-w-xs flex-col items-center gap-4 text-center text-white">
        <MessageCircle className="h-14 w-14" />
        <span className="font-display text-3xl font-bold">ChatApp</span>
        <p className="text-white/85">{tagline}</p>
      </div>
    </div>
  );
}
