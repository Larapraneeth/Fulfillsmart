import React from 'react';
import { Layers, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { StatusTicker } from './StatusTicker';
import { useSystemInfo } from '../../api/queries/useSystemStatus';
import { NAVIGATION_ITEMS } from './Sidebar';

export interface TopBarProps {
  onToggleMobileDrawer?: () => void;
  isMobileDrawerOpen?: boolean;
  mobileTriggerRef?: React.RefObject<HTMLButtonElement>;
}

export function TopBar({
  onToggleMobileDrawer,
  isMobileDrawerOpen = false,
  mobileTriggerRef,
}: TopBarProps) {
  const { data: systemInfo } = useSystemInfo();
  const location = useLocation();

  const currentItem =
    NAVIGATION_ITEMS.find((item) => item.path === location.pathname) || NAVIGATION_ITEMS[0];

  return (
    <header className="h-16 bg-midnight-900 border-b border-midnight-700 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Brand Identity & Mobile Trigger */}
      <div className="flex items-center gap-3">
        {/* Mobile Navigation Drawer Toggle */}
        <button
          ref={mobileTriggerRef}
          type="button"
          onClick={onToggleMobileDrawer}
          className="md:hidden p-2 rounded-lg bg-midnight-800 hover:bg-midnight-700 text-midnight-300 hover:text-midnight-100 border border-midnight-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-teal/50"
          aria-label="Open navigation menu"
          aria-expanded={isMobileDrawerOpen}
          aria-controls="mobile-navigation-drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-9 h-9 rounded-lg bg-tactical-cyan/10 border border-tactical-cyan/30 flex items-center justify-center text-tactical-teal shadow-glow-teal shrink-0">
          <Layers className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-midnight-100 font-display tracking-tight leading-none truncate">
              FulfillSmart
            </h1>
            {systemInfo && (
              <span className="hidden sm:inline-block font-mono text-[10px] text-tactical-cyan bg-tactical-cyan/10 px-1.5 py-0.5 rounded border border-tactical-cyan/20 uppercase shrink-0">
                {systemInfo.environment} v{systemInfo.version}
              </span>
            )}
          </div>
          <p className="text-[11px] text-midnight-400 font-sans tracking-wide truncate hidden xs:block">
            Intelligent Fulfillment Control Tower
          </p>
        </div>

        {/* Dynamic Route Context Breadcrumb (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-midnight-400 pl-4 border-l border-midnight-800 ml-2">
          <span>Control Tower</span>
          <span className="text-midnight-600">/</span>
          <span className="text-tactical-teal font-medium">{currentItem.label}</span>
        </div>
      </div>

      {/* Backend Health, Readiness & Measured Latency */}
      <div className="flex items-center gap-4 shrink-0">
        <StatusTicker />
      </div>
    </header>
  );
}
