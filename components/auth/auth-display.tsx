// tool/ has no auth — these are no-op stubs. The chat shell imports
// AuthDisplayLoggedIn / AuthDisplayLoggedOut / AuthDisplayPreHydrationHead
// for sign-in UI; we return null so they render nothing.
import type { ReactNode } from "react";

export function AuthDisplayLoggedIn(_props: { readonly children?: ReactNode }) {
  return null;
}

export function AuthDisplayLoggedOut({ children }: { readonly children?: ReactNode }) {
  return children ?? null;
}

export function AuthDisplayPreHydrationHead() {
  return null;
}
