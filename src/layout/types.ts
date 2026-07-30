import type { ComponentType } from 'react';

export interface CardLayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface CardDefinition {
  id: string;
  title: string;
  defaultVisible: boolean;
  defaultLayout: CardLayoutRect;
  component: ComponentType;
}

export interface StoredLayoutState {
  visibleIds: string[];
  layout: Record<string, CardLayoutRect>;
}
