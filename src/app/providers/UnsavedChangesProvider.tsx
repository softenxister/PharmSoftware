import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBlocker } from "react-router";

type GuardedAction = () => void | Promise<void>;

type UnsavedChangesContextValue = {
  navigationBlocked: boolean;
  setGuardActive: (owner: symbol, active: boolean) => void;
  clearGuard: (owner: symbol) => void;
  requestAction: (action: GuardedAction) => void;
  navigateWithoutPrompt: (navigation: () => void) => void;
  cancelNavigation: () => void;
  confirmNavigation: () => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function shouldBlockNavigation(
  guardActive: boolean,
  currentLocation: { pathname: string; search: string; hash: string },
  nextLocation: { pathname: string; search: string; hash: string },
): boolean {
  return guardActive && (
    currentLocation.pathname !== nextLocation.pathname
    || currentLocation.search !== nextLocation.search
    || currentLocation.hash !== nextLocation.hash
  );
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const guardsRef = useRef(new Map<symbol, boolean>());
  const pendingActionRef = useRef<GuardedAction | null>(null);
  const bypassNextNavigationRef = useRef(false);
  const [guardActive, setAnyGuardActive] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const setGuardActive = useCallback((owner: symbol, active: boolean) => {
    guardsRef.current.set(owner, active);
    setAnyGuardActive([...guardsRef.current.values()].some(Boolean));
  }, []);

  const clearGuard = useCallback((owner: symbol) => {
    guardsRef.current.delete(owner);
    setAnyGuardActive([...guardsRef.current.values()].some(Boolean));
  }, []);

  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
    if (bypassNextNavigationRef.current) {
      bypassNextNavigationRef.current = false;
      return false;
    }
    return shouldBlockNavigation(guardActive, currentLocation, nextLocation);
  }, [guardActive]));

  useEffect(() => {
    if (!guardActive) return undefined;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [guardActive]);

  const requestAction = useCallback((action: GuardedAction) => {
    if (!guardActive) {
      void action();
      return;
    }
    pendingActionRef.current = action;
    setActionPending(true);
  }, [guardActive]);

  const navigateWithoutPrompt = useCallback((navigation: () => void) => {
    bypassNextNavigationRef.current = true;
    navigation();
    queueMicrotask(() => {
      bypassNextNavigationRef.current = false;
    });
  }, []);

  const cancelNavigation = useCallback(() => {
    pendingActionRef.current = null;
    setActionPending(false);
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);

  const confirmNavigation = useCallback(() => {
    const action = pendingActionRef.current;
    if (action) {
      pendingActionRef.current = null;
      setActionPending(false);
      void action();
      return;
    }
    if (blocker.state === "blocked") blocker.proceed();
  }, [blocker]);

  const value = useMemo<UnsavedChangesContextValue>(() => ({
    navigationBlocked: actionPending || blocker.state === "blocked",
    setGuardActive,
    clearGuard,
    requestAction,
    navigateWithoutPrompt,
    cancelNavigation,
    confirmNavigation,
  }), [
    actionPending,
    blocker.state,
    cancelNavigation,
    clearGuard,
    confirmNavigation,
    navigateWithoutPrompt,
    requestAction,
    setGuardActive,
  ]);

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

function useUnsavedChangesContext(): UnsavedChangesContextValue {
  const context = useContext(UnsavedChangesContext);
  if (!context) throw new Error("Unsaved changes hooks require UnsavedChangesProvider.");
  return context;
}

export function useUnsavedChangesGuard(active: boolean): void {
  const ownerRef = useRef(Symbol("unsaved-changes-guard"));
  const { setGuardActive, clearGuard } = useUnsavedChangesContext();

  useEffect(() => {
    setGuardActive(ownerRef.current, active);
  }, [active, setGuardActive]);

  useEffect(() => () => clearGuard(ownerRef.current), [clearGuard]);
}

export function useUnsavedChangesNavigation() {
  const {
    navigationBlocked,
    requestAction,
    navigateWithoutPrompt,
    cancelNavigation,
    confirmNavigation,
  } = useUnsavedChangesContext();
  return {
    navigationBlocked,
    requestAction,
    navigateWithoutPrompt,
    cancelNavigation,
    confirmNavigation,
  };
}
