import type { ReactNode, SVGProps } from 'react';

/**
 * Icônes en SVG inline.
 *
 * Aucune police d'icônes ni image externe : une CSP stricte — la règle dans une
 * console bancaire — bloquerait les requêtes vers un CDN, et le package doit
 * rester autonome. `aria-hidden` partout : le sens est toujours porté par du texte.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...rest }: IconProps & { children: ReactNode }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ErrorIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v3.5" />
      <path d="M8 11h.01" />
    </Icon>
  );
}

export function CheckCircleIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5.25 8.25 7 10l3.75-4" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M4 6l4 4 4-4" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M12.5 8h-9" />
      <path d="M6.5 4.5 3 8l3.5 3.5" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M3.5 8h9" />
      <path d="M9.5 4.5 13 8l-3.5 3.5" />
    </Icon>
  );
}

/** Étoile pleine ou vide selon `filled` — utilisée par l'échelle de notation. */
export function StarIcon({ filled = false, size = 24 }: { filled?: boolean; size?: number }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z" />
    </svg>
  );
}

/** Cinq visages, du moins satisfait au plus satisfait. */
const SMILEY_FACES = ['\u{1F620}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F600}'];

export function smileyFor(index: number, total: number): string {
  if (total <= 1) return SMILEY_FACES[SMILEY_FACES.length - 1]!;
  const position = Math.round((index / (total - 1)) * (SMILEY_FACES.length - 1));
  return SMILEY_FACES[position] ?? SMILEY_FACES[SMILEY_FACES.length - 1]!;
}
