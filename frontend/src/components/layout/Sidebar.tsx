import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Map,
  PackageSearch,
  Split,
  Truck,
  Activity,
  ShieldAlert,
  FlaskConical,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { NavigationItem, NavigationSection } from '../../types/navigation';

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/overview',
    icon: LayoutDashboard,
    description: 'Executive headline metrics and trends',
  },
  {
    id: 'network',
    label: 'Network Map',
    path: '/network',
    icon: Map,
    description: '20 nodes, 50 delivery zones, corridors',
  },
  {
    id: 'orders',
    label: 'Orders',
    path: '/orders',
    icon: PackageSearch,
    description: 'Paginated order explorer and filters',
  },
  {
    id: 'allocation',
    label: 'Allocation',
    path: '/allocation',
    icon: Split,
    description: 'Node allocation sandbox and rules',
  },
  {
    id: 'carriers',
    label: 'Carriers',
    path: '/carriers',
    icon: Truck,
    description: 'Carrier scorecard and service matrix',
  },
  {
    id: 'tracking',
    label: 'Tracking',
    path: '/tracking',
    icon: Activity,
    description: 'Event lifecycle timeline and rollup',
  },
  {
    id: 'anomalies',
    label: 'Anomalies',
    path: '/anomalies',
    icon: ShieldAlert,
    description: '6 business rules detection and audit',
  },
  {
    id: 'simulation',
    label: 'Simulation Lab',
    path: '/simulation',
    icon: FlaskConical,
    description: 'What-if scenarios and cohort comparison',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    description: 'Operational KPIs and utilization',
  },
];

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'operations',
    title: 'Core Operations',
    items: NAVIGATION_ITEMS.slice(0, 3), // Overview, Network, Orders
  },
  {
    id: 'engines',
    title: 'Decision Engines',
    items: NAVIGATION_ITEMS.slice(3, 6), // Allocation, Carriers, Tracking
  },
  {
    id: 'intelligence',
    title: 'Intelligence & Audit',
    items: NAVIGATION_ITEMS.slice(6, 9), // Anomalies, Simulation, Analytics
  },
];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
]
  .map((s) => `${s}:not([hidden]):not([aria-hidden="true"])`)
  .join(', ');

/**
 * Rigorously checks whether an element inside the mobile drawer is focusable and visible.
 * Excludes elements hidden by themselves or any ancestor via:
 * - hidden attribute
 * - aria-hidden="true"
 * - inert attribute
 * - CSS display: none
 * - CSS visibility: hidden or visibility: collapse
 * Also excludes:
 * - disabled elements, aria-disabled="true", or descendants of disabled fieldsets
 * - elements without visible layout geometry
 */
export function isElementFocusableInDrawer(el: HTMLElement, container: HTMLElement): boolean {
  if (!container.contains(el)) return false;

  // 1. Check self and ancestor hidden, aria-hidden="true", or inert attributes
  if (
    el.hasAttribute('hidden') ||
    el.getAttribute('aria-hidden') === 'true' ||
    el.hasAttribute('inert') ||
    el.closest('[hidden], [aria-hidden="true"], [inert]') !== null
  ) {
    return false;
  }

  // 2. Check disabled states, aria-disabled="true", and disabled fieldset ancestors
  if (
    (el as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled ||
    el.hasAttribute('disabled') ||
    el.getAttribute('aria-disabled') === 'true' ||
    el.closest('fieldset[disabled]') !== null
  ) {
    return false;
  }

  // 3. Check computed CSS display and visibility (hidden or collapse)
  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.visibility === 'collapse'
  ) {
    return false;
  }

  // 4. Check visible layout geometry (exclude detached or zero-rect elements)
  if (el.offsetParent === null && el.getClientRects().length === 0) {
    return false;
  }

  return true;
}

export interface SidebarProps {
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
  isMobileDrawer?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  isDesktopCollapsed = false,
  onToggleDesktopCollapse,
  isMobileDrawer = false,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const drawerRef = useRef<HTMLElement | null>(null);

  // Focus management for mobile modal drawer
  useEffect(() => {
    if (!isMobileDrawer || !isOpen) return;

    // Focus the first valid focusable element inside drawer
    const focusFirstElement = () => {
      if (!drawerRef.current) return;
      const elements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => isElementFocusableInDrawer(el, drawerRef.current!));

      if (elements.length > 0) {
        elements[0].focus();
      }
    };

    const frameId = requestAnimationFrame(focusFirstElement);
    return () => cancelAnimationFrame(frameId);
  }, [isMobileDrawer, isOpen]);

  // Focus trap keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!isMobileDrawer) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
      return;
    }

    if (e.key === 'Tab') {
      if (!drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => isElementFocusableInDrawer(el, drawerRef.current!));

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement || !drawerRef.current.contains(document.activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  const renderNavSections = (isCompact: boolean, isMobileView: boolean) => (
    <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {NAVIGATION_SECTIONS.map((section) => (
        <div key={section.id} className="space-y-1">
          {!isCompact && (
            <div className="px-3 pb-1.5 text-[10px] font-mono tracking-widest text-midnight-400 uppercase">
              {section.title}
            </div>
          )}

          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={() => {
                  if (isMobileView && onClose) {
                    onClose();
                  }
                }}
                title={isCompact ? item.label : undefined}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center rounded-lg text-sm font-medium transition-all duration-150 group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-teal/50',
                    isCompact ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                    {
                      'bg-gradient-to-r from-tactical-cyan/15 to-transparent text-tactical-teal font-semibold border border-tactical-cyan/20 shadow-sm':
                        isActive,
                      'text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800/60 border border-transparent':
                        !isActive,
                    }
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active Accent Pill */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-tactical-teal rounded-r shadow-glow-teal"
                        aria-hidden="true"
                      />
                    )}

                    <Icon
                      className={clsx('w-4 h-4 shrink-0 transition-colors', {
                        'text-tactical-teal': isActive,
                        'text-midnight-400 group-hover:text-midnight-200': !isActive,
                      })}
                      aria-hidden="true"
                    />

                    {!isCompact && (
                      <span className="truncate">{item.label}</span>
                    )}

                    {!isCompact && item.badge && (
                      <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-midnight-800 text-midnight-300 border border-midnight-700">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </div>
  );

  // Mobile Slide-Over Modal Drawer
  if (isMobileDrawer) {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 md:hidden flex">
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-midnight-950/80 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal Drawer Dialog */}
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
          onKeyDown={handleKeyDown}
          className="relative w-72 max-w-[80vw] bg-midnight-900 border-r border-midnight-700 flex flex-col h-full shadow-2xl z-10"
        >
          {/* Drawer Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-midnight-700 shrink-0">
            <span className="font-display font-bold text-sm text-midnight-100">
              Fulfillment Navigation
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-midnight-800 hover:bg-midnight-700 text-midnight-300 hover:text-midnight-100 border border-midnight-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-teal/50"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          {renderNavSections(false, true)}

          {/* Mobile Footer */}
          <div className="p-4 border-t border-midnight-800 bg-midnight-950/40 text-[11px] text-midnight-400 font-mono space-y-1 shrink-0">
            <div className="flex justify-between">
              <span>Baseline Orders</span>
              <span className="text-midnight-200">50,000</span>
            </div>
            <div className="flex justify-between">
              <span>Nodes / Carriers</span>
              <span className="text-midnight-200">20 / 10</span>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  // Desktop Responsive Sidebar
  return (
    <aside
      aria-label="Primary navigation"
      className={clsx(
        'hidden md:flex flex-col shrink-0 bg-midnight-900 border-r border-midnight-700 transition-all duration-200 min-h-[calc(100vh-4rem)]',
        isDesktopCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Navigation Sections */}
      {renderNavSections(isDesktopCollapsed, false)}

      {/* Desktop Footer & Visible Collapse Button */}
      <div className="p-3 border-t border-midnight-800 bg-midnight-950/40 text-[11px] text-midnight-400 font-mono space-y-2 shrink-0">
        {!isDesktopCollapsed && (
          <div className="space-y-1 px-1 pb-1">
            <div className="flex justify-between">
              <span>Historical Baseline</span>
              <span className="text-midnight-200">50,000</span>
            </div>
            <div className="flex justify-between">
              <span>Fulfillment Nodes</span>
              <span className="text-midnight-200">20</span>
            </div>
            <div className="flex justify-between">
              <span>Active Carriers</span>
              <span className="text-midnight-200">10</span>
            </div>
          </div>
        )}

        {/* Dedicated Visible Collapse Trigger Button */}
        {onToggleDesktopCollapse && (
          <button
            type="button"
            onClick={onToggleDesktopCollapse}
            className={clsx(
              'w-full flex items-center rounded-lg py-2 text-xs font-mono text-midnight-400 hover:text-midnight-100 hover:bg-midnight-800/80 border border-midnight-700/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-teal/50',
              isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'
            )}
            aria-expanded={!isDesktopCollapsed}
            aria-label={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {!isDesktopCollapsed && <span>Collapse Sidebar</span>}
            {isDesktopCollapsed ? (
              <ChevronRight className="w-4 h-4 text-midnight-300" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-midnight-300" />
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
