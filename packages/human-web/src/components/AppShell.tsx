import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Crown, Landmark, LoaderCircle, LogOut, Map, Pin, PinOff, UserRoundCog, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import {
  getSavedAppShellAnchor,
  getSavedAppShellExpanded,
  setSavedAppShellAnchor,
  setSavedAppShellExpanded,
  type AppShellAnchor,
} from '../lib/storage';
import { resolvePluginIcon } from '../plugins/icons';
import { usePluginHost } from '../plugins/context';
import { LanguageToggle } from './LanguageToggle';

const DESKTOP_SHELL_OFFSET = 24;
const MOBILE_SHELL_OFFSET = 12;
const DESKTOP_LAUNCHER_SIZE = 68;
const MOBILE_LAUNCHER_SIZE = 60;
const DESKTOP_PANEL_WIDTH = 328;
const MOBILE_PANEL_WIDTH = 336;
const DESKTOP_PANEL_HEIGHT = 720;

type ShellMetrics = {
  offset: number;
  launcherSize: number;
  panelWidth: number;
  panelHeight: number;
};

function getShellMetrics(): ShellMetrics {
  if (typeof window === 'undefined') {
    return {
      offset: DESKTOP_SHELL_OFFSET,
      launcherSize: DESKTOP_LAUNCHER_SIZE,
      panelWidth: DESKTOP_PANEL_WIDTH,
      panelHeight: DESKTOP_PANEL_HEIGHT,
    };
  }

  const isCompact = window.innerWidth <= 960;
  const offset = isCompact ? MOBILE_SHELL_OFFSET : DESKTOP_SHELL_OFFSET;
  const launcherSize = isCompact ? MOBILE_LAUNCHER_SIZE : DESKTOP_LAUNCHER_SIZE;
  const panelWidth = Math.max(
    240,
    Math.min(isCompact ? MOBILE_PANEL_WIDTH : DESKTOP_PANEL_WIDTH, window.innerWidth - (offset * 2)),
  );
  const panelHeight = isCompact
    ? Math.max(280, window.innerHeight - (offset * 2))
    : Math.min(DESKTOP_PANEL_HEIGHT, Math.max(360, window.innerHeight - (offset * 2)));

  return { offset, launcherSize, panelWidth, panelHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function clampLauncherAnchor(anchor: AppShellAnchor): AppShellAnchor {
  if (typeof window === 'undefined') {
    return anchor;
  }

  const { offset, launcherSize } = getShellMetrics();
  return {
    left: clamp(anchor.left, offset, window.innerWidth - launcherSize - offset),
    top: clamp(anchor.top, offset, window.innerHeight - launcherSize - offset),
  };
}

function resolvePanelAnchor(anchor: AppShellAnchor): AppShellAnchor {
  if (typeof window === 'undefined') {
    return anchor;
  }

  const { offset, launcherSize, panelWidth, panelHeight } = getShellMetrics();
  let left = anchor.left;
  let top = anchor.top;

  if (left + panelWidth > window.innerWidth - offset) {
    left = anchor.left + launcherSize - panelWidth;
  }

  if (top + panelHeight > window.innerHeight - offset) {
    top = anchor.top + launcherSize - panelHeight;
  }

  return {
    left: clamp(left, offset, window.innerWidth - panelWidth - offset),
    top: clamp(top, offset, window.innerHeight - panelHeight - offset),
  };
}

function clampPanelAnchor(anchor: AppShellAnchor): AppShellAnchor {
  if (typeof window === 'undefined') {
    return anchor;
  }

  const { offset, panelWidth, panelHeight } = getShellMetrics();
  return {
    left: clamp(anchor.left, offset, window.innerWidth - panelWidth - offset),
    top: clamp(anchor.top, offset, window.innerHeight - panelHeight - offset),
  };
}

function resolveLauncherAnchorFromPanel(anchor: AppShellAnchor): AppShellAnchor {
  if (typeof window === 'undefined') {
    return anchor;
  }

  const clampedPanel = clampPanelAnchor(anchor);
  const { offset, launcherSize, panelWidth, panelHeight } = getShellMetrics();
  const rightLimit = window.innerWidth - panelWidth - offset;
  const bottomLimit = window.innerHeight - panelHeight - offset;

  return clampLauncherAnchor({
    left: clampedPanel.left >= rightLimit ? clampedPanel.left + panelWidth - launcherSize : clampedPanel.left,
    top: clampedPanel.top >= bottomLimit ? clampedPanel.top + panelHeight - launcherSize : clampedPanel.top,
  });
}

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startLeft: number;
  startTop: number;
  moved: boolean;
};

export function AppShell() {
  const { t } = useTranslation(['nav', 'common']);
  const { user, logout } = useAuth();
  const runtime = useAgentRuntime();
  const { enabledNavEntries } = usePluginHost();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(() => getSavedAppShellExpanded());
  const [anchorPosition, setAnchorPosition] = useState<AppShellAnchor | null>(() => getSavedAppShellAnchor());
  const [isDraggingLauncher, setIsDraggingLauncher] = useState(false);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [runtimeAction, setRuntimeAction] = useState('');
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const launcherDragStateRef = useRef<DragState | null>(null);
  const panelDragStateRef = useRef<DragState | null>(null);
  const suppressOpenRef = useRef(false);
  const links = useMemo(() => [
    { to: '/lobby', label: t('nav:lobby'), icon: Landmark },
    { to: '/play', label: t('nav:city'), icon: Map },
    { to: '/agents', label: t('nav:agents'), icon: UserRoundCog },
    ...enabledNavEntries
      .filter((entry) => !entry.requiresRole || entry.requiresRole === user?.role)
      .map((entry) => ({
        to: entry.to,
        label: t(entry.labelKey),
        icon: resolvePluginIcon(entry.icon),
      })),
  ], [enabledNavEntries, t, user?.role]);
  const runtimeLabel = runtime.isConnected ? t('common:status.connectedWs') : t('common:status.disconnectedWs');
  const roleLabel = user?.role === 'admin' ? t('common:status.adminRole') : t('common:status.ownerRole');

  const updateExpanded = (nextExpanded: boolean) => {
    setIsExpanded(nextExpanded);
    setSavedAppShellExpanded(nextExpanded);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setAnchorPosition((current) => {
        if (!current) return current;
        const next = clampLauncherAnchor(current);
        if (next.left === current.left && next.top === current.top) {
          return current;
        }
        setSavedAppShellAnchor(next);
        return next;
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isExpanded || isPinned || typeof document === 'undefined') {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (isDraggingLauncher || isDraggingPanel) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (controlRef.current?.contains(target) || launcherRef.current?.contains(target)) {
        return;
      }

      updateExpanded(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        updateExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDraggingLauncher, isDraggingPanel, isExpanded, isPinned]);

  const handleLogout = () => {
    runtime.disconnect();
    logout();
    navigate('/login');
  };

  const connectRuntime = async () => {
    setRuntimeAction('connect');
    try {
      await runtime.connect();
      await runtime.refreshSessionState();
    } catch {
      // Runtime context already records the user-facing error message.
    } finally {
      setRuntimeAction('');
    }
  };

  const claimRuntimeControl = async () => {
    setRuntimeAction('claim');
    try {
      await runtime.claimControl();
    } catch {
      // Runtime context already records the user-facing error message.
    } finally {
      setRuntimeAction('');
    }
  };

  const handleLauncherPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    launcherDragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };
    suppressOpenRef.current = false;
    setIsDraggingLauncher(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleLauncherPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = launcherDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = clampLauncherAnchor({
      left: event.clientX - dragState.offsetX,
      top: event.clientY - dragState.offsetY,
    });

    if (!dragState.moved) {
      const distance = Math.hypot(nextPosition.left - dragState.startLeft, nextPosition.top - dragState.startTop);
      if (distance > 4) {
        dragState.moved = true;
        suppressOpenRef.current = true;
      }
    }

    setAnchorPosition(nextPosition);
    setSavedAppShellAnchor(nextPosition);
  };

  const finishLauncherDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = launcherDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    launcherDragStateRef.current = null;
    setIsDraggingLauncher(false);
  };

  const handleLauncherClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressOpenRef.current) {
      suppressOpenRef.current = false;
      event.preventDefault();
      return;
    }

    updateExpanded(true);
  };

  const handlePanelPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const control = event.currentTarget.parentElement;
    if (!(control instanceof HTMLDivElement)) {
      return;
    }

    const rect = control.getBoundingClientRect();
    panelDragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };
    setIsDraggingPanel(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePanelPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = panelDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextPanelAnchor = clampPanelAnchor({
      left: event.clientX - dragState.offsetX,
      top: event.clientY - dragState.offsetY,
    });
    const nextLauncherAnchor = resolveLauncherAnchorFromPanel(nextPanelAnchor);

    setAnchorPosition(nextLauncherAnchor);
    setSavedAppShellAnchor(nextLauncherAnchor);
  };

  const finishPanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = panelDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    panelDragStateRef.current = null;
    setIsDraggingPanel(false);
  };

  const launcherStyle = anchorPosition
    ? { left: `${anchorPosition.left}px`, top: `${anchorPosition.top}px` }
    : undefined;
  const controlAnchor = anchorPosition ? resolvePanelAnchor(anchorPosition) : null;
  const controlStyle = controlAnchor
    ? { left: `${controlAnchor.left}px`, top: `${controlAnchor.top}px` }
    : undefined;
  const pinLabel = isPinned ? t('common:actions.unpinNavigation') : t('common:actions.pinNavigation');
  const shouldShowBackdrop = isExpanded && !isPinned;

  return (
    <div className={`app-shell ${isExpanded ? 'is-shell-expanded' : 'is-shell-collapsed'}`}>
      <button
        ref={launcherRef}
        type="button"
        className={`app-shell-launcher${isExpanded ? ' is-hidden' : ''}${isDraggingLauncher ? ' is-dragging' : ''}`}
        aria-label={t('common:actions.openNavigation')}
        title={t('common:actions.openNavigation')}
        style={launcherStyle}
        onClick={handleLauncherClick}
        onPointerCancel={finishLauncherDrag}
        onPointerDown={handleLauncherPointerDown}
        onPointerMove={handleLauncherPointerMove}
        onPointerUp={finishLauncherDrag}
      >
        <span className="app-shell-launcher__glow" aria-hidden="true" />
        <span className="brand-mark app-shell-launcher__seal" aria-hidden="true" />
        <span className="app-shell-launcher__chevron" aria-hidden="true">
          <ChevronRight size={18} />
        </span>
      </button>

      <aside className={`app-side-shell${isExpanded ? ' is-open' : ''}`}>
        <div ref={controlRef} className={`app-side-shell__control${isDraggingPanel ? ' is-dragging' : ''}`} style={controlStyle}>
          <div
            className={`app-side-shell__drag-handle${isDraggingPanel ? ' is-dragging' : ''}`}
            onPointerCancel={finishPanelDrag}
            onPointerDown={handlePanelPointerDown}
            onPointerMove={handlePanelPointerMove}
            onPointerUp={finishPanelDrag}
          />
          <div className="app-side-shell__panel-head">
            <NavLink to="/lobby" className="brand app-side-shell__brand">
              <span className="brand-mark" />
              <span className="brand-copy">
                <span className="brand-title">Uruc</span>
                <span className="brand-subtitle">golden city human console</span>
              </span>
            </NavLink>

            <div className="app-side-shell__panel-actions">
              <button
                type="button"
                className={`app-side-shell__toggle app-side-shell__pin${isPinned ? ' is-active' : ''}`}
                aria-label={pinLabel}
                aria-pressed={isPinned}
                title={pinLabel}
                onClick={() => setIsPinned((value) => !value)}
              >
                {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
              </button>

              <button
                type="button"
                className="app-side-shell__toggle"
                aria-label={t('common:actions.collapseNavigation')}
                title={t('common:actions.collapseNavigation')}
                onClick={() => updateExpanded(false)}
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>

          <div className="app-side-shell__meta">
            <span className="role-chip mono">
              <span className="row">
                {runtime.isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                {runtimeLabel}
              </span>
            </span>
            {user ? (
              <span className="role-chip">
                {user.username} · {roleLabel}
              </span>
            ) : null}
            <div className="app-side-shell__actions">
              {!runtime.isConnected ? (
                <button
                  type="button"
                  className="app-btn app-side-shell__action-btn"
                  onClick={() => void connectRuntime()}
                  disabled={runtimeAction === 'connect' || runtime.status === 'connecting' || runtime.status === 'reconnecting'}
                >
                  <span className="row">
                    {runtimeAction === 'connect' || runtime.status === 'connecting' || runtime.status === 'reconnecting'
                      ? <LoaderCircle size={14} className="spin" />
                      : <Wifi size={14} />}
                    {t('common:actions.connect')}
                  </span>
                </button>
              ) : null}
              {runtime.isConnected && !runtime.isController ? (
                <button
                  type="button"
                  className="app-btn secondary app-side-shell__action-btn"
                  onClick={() => void claimRuntimeControl()}
                  disabled={runtimeAction === 'claim'}
                >
                  <span className="row">
                    {runtimeAction === 'claim' ? <LoaderCircle size={14} className="spin" /> : <Crown size={14} />}
                    {t('common:actions.claimControl')}
                  </span>
                </button>
              ) : null}
            </div>
            {runtime.error ? (
              <div className="app-side-shell__notice" role="status">
                {runtime.error}
              </div>
            ) : null}
          </div>

          <nav className="app-side-shell__nav">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `app-side-shell__nav-link${isActive ? ' active' : ''}`}
              >
                <span className="row">
                  <link.icon size={16} />
                  {link.label}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="app-side-shell__footer">
            <LanguageToggle />
            {user ? (
              <button className="app-btn secondary app-side-shell__logout" onClick={handleLogout}>
                <span className="row"><LogOut size={14} /> {t('common:actions.logout')}</span>
              </button>
            ) : (
              <NavLink to="/login" className="app-btn app-side-shell__logout">{t('common:actions.login')}</NavLink>
            )}
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={`app-side-shell__backdrop${shouldShowBackdrop ? ' is-visible' : ''}`}
        aria-hidden={!shouldShowBackdrop}
        tabIndex={shouldShowBackdrop ? 0 : -1}
        onClick={() => updateExpanded(false)}
      />

      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
