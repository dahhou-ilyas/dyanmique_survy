import type { ReactNode, SVGProps } from 'react';
import type { IconName } from '../core/registry/types';

/** Icônes du builder — SVG inline, aucune ressource externe (CSP stricte). */

type Props = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 16, children, ...rest }: Props & { children: ReactNode }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
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

const QUESTION_ICONS: Record<IconName, ReactNode> = {
  text: (
    <>
      <path d="M2 4h12" />
      <path d="M2 8h8" />
    </>
  ),
  textarea: (
    <>
      <path d="M2 3.5h12" />
      <path d="M2 7h12" />
      <path d="M2 10.5h7" />
    </>
  ),
  radio: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.25" fill="currentColor" stroke="none" />
    </>
  ),
  checkbox: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="2.5" />
      <path d="M5 8.25 7 10.25l4-4.5" />
    </>
  ),
  dropdown: (
    <>
      <rect x="2" y="3.5" width="12" height="9" rx="2" />
      <path d="M6 7.5 8 9.5l2-2" />
    </>
  ),
  calendar: (
    <>
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12" />
      <path d="M5.5 2v2M10.5 2v2" />
    </>
  ),
  number: (
    <>
      <path d="M6 2.5 4.5 13.5M11.5 2.5 10 13.5" />
      <path d="M2.5 6h11M2 10h11" />
    </>
  ),
  star: (
    <path d="M8 2.5l1.75 3.55 3.9.57-2.82 2.75.66 3.88L8 11.42l-3.49 1.83.66-3.88L2.35 6.62l3.9-.57z" />
  ),
  gauge: (
    <>
      <path d="M2.5 12a5.5 5.5 0 1 1 11 0" />
      <path d="M8 12 11 7.5" />
    </>
  ),
  toggle: (
    <>
      <rect x="1.5" y="4.5" width="13" height="7" rx="3.5" />
      <circle cx="10.5" cy="8" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  html: (
    <>
      <path d="M5.5 5 3 8l2.5 3" />
      <path d="M10.5 5 13 8l-2.5 3" />
      <path d="M9 3.5 7 12.5" />
    </>
  ),
  panel: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M2 6h12" />
      <path d="M4.5 8.75h7M4.5 11h4.5" />
    </>
  ),
};

export function QuestionIcon({ name, size = 16 }: { name: IconName; size?: number }): ReactNode {
  return <Base size={size}>{QUESTION_ICONS[name] ?? QUESTION_ICONS.text}</Base>;
}

export const UndoIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <path d="M3 7h7a3.5 3.5 0 0 1 0 7H7" />
    <path d="M5.5 4.5 3 7l2.5 2.5" />
  </Base>
);

export const RedoIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <path d="M13 7H6a3.5 3.5 0 0 0 0 7h3" />
    <path d="M10.5 4.5 13 7l-2.5 2.5" />
  </Base>
);

export const PlusIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <path d="M8 3v10M3 8h10" />
  </Base>
);

export const TrashIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <path d="M2.5 4h11" />
    <path d="M6.5 4V2.5h3V4" />
    <path d="M4 4l.6 9a1 1 0 0 0 1 1h4.8a1 1 0 0 0 1-1L12 4" />
  </Base>
);

export const CopyIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </Base>
);

export const GripIcon = (props: Props): ReactNode => (
  <Base {...props} strokeWidth="1.8">
    <path d="M6 3.5h.01M6 8h.01M6 12.5h.01M10 3.5h.01M10 8h.01M10 12.5h.01" />
  </Base>
);

export const AlertIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <path d="M8 2.5 14.5 13.5h-13z" />
    <path d="M8 6.5v3M8 11.5h.01" />
  </Base>
);

export const CheckIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <path d="M3 8.5 6.5 12 13 4.5" />
  </Base>
);

export const ChevronUpIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <path d="M4 10l4-4 4 4" />
  </Base>
);

export const ChevronDownIcon = (props: Props): ReactNode => (
  <Base {...props}>
    <path d="M4 6l4 4 4-4" />
  </Base>
);
