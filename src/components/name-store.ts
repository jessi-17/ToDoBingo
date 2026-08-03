"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's name, kept in localStorage.
 *
 * Read through `useSyncExternalStore` rather than an effect: that is the API
 * built for reading browser state during render without upsetting hydration,
 * and it avoids the setState-in-effect pattern.
 *
 * Three states matter, not two. `undefined` means "not known yet" — what the
 * server sees — while `null` means "asked and never answered". Collapsing them
 * would flash the name prompt at returning visitors on every load, before
 * hydration had a chance to read storage.
 */
const KEY = "todobingo:name";

let listeners: (() => void)[] = [];

const subscribe = (onChange: () => void) => {
  listeners = [...listeners, onChange];
  window.addEventListener("storage", onChange);
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
    window.removeEventListener("storage", onChange);
  };
};

const getSnapshot = (): string | null => window.localStorage.getItem(KEY);

const getServerSnapshot = (): string | null | undefined => undefined;

export const storeName = (name: string) => {
  window.localStorage.setItem(KEY, name);
  listeners.forEach((listener) => listener());
};

export const useStoredName = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
