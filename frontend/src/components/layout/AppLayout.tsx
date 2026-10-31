import { useState, useRef, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const backgroundContentRef = useRef<HTMLDivElement | null>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const prevIsOpenRef = useRef(false);

  // Background accessibility inactivation and focus restoration
  useEffect(() => {
    const backgroundEl = backgroundContentRef.current;
    if (!backgroundEl) return;

    if (isMobileDrawerOpen) {
      backgroundEl.setAttribute('aria-hidden', 'true');
      backgroundEl.setAttribute('inert', '');
      document.body.style.overflow = 'hidden';
      prevIsOpenRef.current = true;
    } else {
      backgroundEl.removeAttribute('aria-hidden');
      backgroundEl.removeAttribute('inert');
      document.body.style.overflow = '';

      // Restore focus to trigger only after background inactivation is removed
      if (prevIsOpenRef.current) {
        prevIsOpenRef.current = false;
        mobileTriggerRef.current?.focus();
      }
    }

    return () => {
      backgroundEl.removeAttribute('aria-hidden');
      backgroundEl.removeAttribute('inert');
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  return (
    <div className="min-h-screen bg-midnight-950 text-midnight-300 flex flex-col font-sans relative">
      {/* Accessibility Skip Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Main Background Content Shell (Inactivated when mobile drawer is open) */}
      <div
        id="app-background-content"
        ref={backgroundContentRef}
        className="flex flex-col flex-1 min-h-screen"
      >
        <TopBar
          onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
          isMobileDrawerOpen={isMobileDrawerOpen}
          mobileTriggerRef={mobileTriggerRef}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Responsive Sidebar */}
          <Sidebar
            isDesktopCollapsed={isDesktopCollapsed}
            onToggleDesktopCollapse={() => setIsDesktopCollapsed((prev) => !prev)}
          />

          {/* Main Module Content Area */}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-4 sm:p-6 bg-midnight-950 focus:outline-none"
          >
            <div className="max-w-7xl mx-auto space-y-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Navigation Drawer (Rendered outside background content) */}
      <Sidebar
        isMobileDrawer={true}
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />
    </div>
  );
}
