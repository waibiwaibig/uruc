const GAME_WINDOW_NAME = 'uruc-game';

export interface PreparedGameWindow {
  navigate: (path: string) => void;
  close: () => void;
}

export function prepareGameWindow(): PreparedGameWindow | null {
  const popup = window.open('', GAME_WINDOW_NAME);
  if (!popup) return null;

  try {
    popup.document.title = 'Uruc';
    popup.document.body.style.margin = '0';
    popup.document.body.style.background = '#0b0906';
    popup.document.body.style.color = '#f3ead5';
    popup.document.body.style.fontFamily = 'system-ui, sans-serif';
    popup.document.body.style.display = 'grid';
    popup.document.body.style.placeItems = 'center';
    popup.document.body.innerHTML = '<div style="padding:24px;opacity:.82;letter-spacing:.08em;text-transform:uppercase">Launching Uruc...</div>';
  } catch {
    // Ignore cross-document styling failures and still reuse the window handle.
  }

  return {
    navigate(path: string) {
      popup.location.replace(new URL(path, window.location.origin).toString());
      popup.focus();
    },
    close() {
      popup.close();
    },
  };
}
