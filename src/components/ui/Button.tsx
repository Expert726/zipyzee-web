import { ArrowRight } from 'lucide-react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  /** primary only: the dark arrow circle at the end (the app's Button `arrow`) */
  arrow?: boolean;
};

/** The app's Button: primary = lime gradient pill, secondary = white pill, ghost = text. */
export function Button({ variant = 'primary', arrow, className = '', children, ...rest }: Props) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[filter,background] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
  const look =
    variant === 'primary'
      ? `lime-fill min-h-14 text-base hover:brightness-95 ${arrow ? 'ps-6 pe-2' : 'px-6'}`
      : variant === 'secondary'
        ? 'min-h-12 px-5 text-[15px] bg-surface text-text border border-line-strong hover:bg-fill'
        : 'min-h-11 px-4 text-sm text-primary hover:bg-fill';
  return (
    <button type="button" className={`${base} ${look} ${className}`} {...rest}>
      <span className={arrow ? 'flex-1 text-start' : undefined}>{children}</span>
      {variant === 'primary' && arrow && (
        <span className="size-10 rounded-full bg-on-ink text-ink grid place-items-center" aria-hidden="true">
          <ArrowRight size={20} className="flip-rtl" />
        </span>
      )}
    </button>
  );
}
