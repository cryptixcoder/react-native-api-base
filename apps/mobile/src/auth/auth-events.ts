/**
 * Decouples the API client from React state: when a refresh fails, the client emits
 * "session expired" and the AuthProvider resets the app to the signed-out state.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  listeners.forEach((listener) => listener());
}
