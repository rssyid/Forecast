import type { ReactNode } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  options?: Array<string | SearchableSelectOption>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  autoSort?: boolean;
}

export default function SearchableSelect(props: SearchableSelectProps): ReactNode;
