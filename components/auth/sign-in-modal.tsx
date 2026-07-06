// tool/ has no auth — sign-in modal renders nothing.
import type { Dispatch, SetStateAction } from "react";

export function SignInModal(_props: {
  readonly callbackPath?: string;
  readonly disabled?: boolean;
  readonly onBeforeSignIn?: () => void;
  readonly onClose?: () => void;
  readonly onOpenChange?: Dispatch<SetStateAction<boolean>>;
  readonly open?: boolean;
  readonly pendingDraft?: string;
}) {
  return null;
}
