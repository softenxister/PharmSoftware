import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/app/providers/AuthProvider";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import type { TranslationKey } from "@/i18n/i18n";
import type { PharmUser } from "@server/auth/pharmUser";
import { getSalesLandingHref } from "@/config/preferences/posPreferences";
import { usePosPreferences } from "@/hooks/usePosPreferences";
import logoImage from "@/styles/vector/logo.png";
import { shouldCloseProfileMenu } from "./profileMenu";
import {
  Home, ShoppingCart, Package, Archive, Users,
  BarChart2, Plug, MoreHorizontal, Settings, Globe, ChevronDown, Bell,
  RefreshCw, Tag, SlidersHorizontal, Gauge,
  LogOut,
} from "lucide-react";

const navItems = [
  { labelKey: "nav.home", href: "/", icon: Home },
  { labelKey: "nav.sales", href: "/sales", icon: ShoppingCart },
  { labelKey: "nav.purchase", href: "/purchase", icon: Package },
  { labelKey: "nav.stock", href: "/stock", icon: Archive },
  { labelKey: "nav.member", href: "/member", icon: Users },
  { labelKey: "nav.analysis", href: "/analysis", icon: BarChart2 },
  { labelKey: "nav.integrations", href: "/integrations", icon: Plug },
  { labelKey: "nav.more", href: "/more", icon: MoreHorizontal },
] satisfies Array<{ labelKey: TranslationKey; href: string; icon: typeof Home }>;

const stockMenuItems = [
  { labelKey: "stock.migration", href: "/stock/migration", icon: RefreshCw },
  { labelKey: "stock.discounts", href: "/stock/discounts", icon: Tag },
  { labelKey: "stock.adjustment", href: "/stock/adjustment", icon: SlidersHorizontal },
  { labelKey: "stock.minMax", href: "/stock/min-max", icon: Gauge },
] satisfies Array<{ labelKey: TranslationKey; href: string; icon: typeof Home }>;

const getTopLevelPath = (href: string) => (href === "/" ? "/" : `/${href.split("/")[1]}`);

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export function TopBar({ user }: { user: PharmUser }) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  const [stockMenuOpen, setStockMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const { preferences: appPreferences, isSaving: isSavingPreferences, updatePreferences, t } = usePreferences();
  const { preferences } = usePosPreferences(user);
  const salesHref = getSalesLandingHref(preferences.defaultSalesLanding);
  const roleLabel = user.role === "owner" ? t("common.owner") : t("common.pharmacist");

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (shouldCloseProfileMenu(profileRef.current, event.target as Node)) setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!langOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) setLangOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [langOpen]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div
      style={{ background: "var(--app-header)", borderBottom: "1px solid var(--app-header-border)" }}
      className="flex items-center justify-between px-4 h-13 shrink-0"
    >
      {/* Left: Logo + Nav */}
      <div className="flex items-center h-full">
        {/* Logo */}
        <div className="flex items-center pr-5 mr-2" style={{ borderRight: "1px solid var(--app-header-divider)" }}>
          <img src={logoImage} alt="" className="h-auto w-5 object-contain" />
        </div>

        {/* Nav Items */}
        {navItems.map(({ labelKey, href, icon: Icon }) => {
          const label = t(labelKey);
          const resolvedHref = labelKey === "nav.sales" ? salesHref : href;
          const topLevelPath = getTopLevelPath(href);
          const isActive = topLevelPath === "/" ? pathname === "/" : pathname.startsWith(topLevelPath);
          const isHome = labelKey === "nav.home";
          const isStock = labelKey === "nav.stock";
          const navLink = (
            <Link
              key={labelKey}
              to={resolvedHref}
              className={`flex h-full items-center transition-colors ${isHome ? "w-11 justify-center" : "gap-2 px-4"}`}
              style={{
                background: isActive ? "var(--app-header-active)" : "transparent",
                color: isActive ? "var(--app-header-text-strong)" : "var(--app-header-text)",
                borderRadius: 0,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "var(--app-header-hover)";
                  (e.currentTarget as HTMLElement).style.color = "var(--app-header-text-strong)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--app-header-text)";
                }
              }}
            >
              <Icon
                size={16.8}
                strokeWidth={isActive ? 2.2 : 1.8}
                style={isHome ? { transform: "translateX(-1px)" } : undefined}
              />
              {!isHome && (
                <span style={{ fontSize: "15px", fontWeight: isActive ? 600 : 400 }}>{label}</span>
              )}
            </Link>
          );

          if (!isStock) return navLink;

          return (
            <div
              key={labelKey}
              className="relative h-full"
              onMouseEnter={() => setStockMenuOpen(true)}
              onMouseLeave={() => setStockMenuOpen(false)}
              onFocus={() => setStockMenuOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setStockMenuOpen(false);
                }
              }}
            >
              {navLink}
              {stockMenuOpen && (
                <div
                  className="absolute left-0 top-full z-50 w-56 border py-1 shadow-lg"
                  style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }}
                  role="menu"
                  aria-label={t("nav.stockActions")}
                >
                  {stockMenuItems.map(({ labelKey: menuLabelKey, href: menuHref, icon: MenuIcon }, index) => (
                    <Link
                      key={menuHref}
                      to={menuHref}
                      className="flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                      style={{
                        color: "var(--app-ink)",
                        fontSize: "14px",
                        borderTop: index > 0 ? "1px solid var(--app-border-soft)" : undefined,
                      }}
                      role="menuitem"
                      onMouseEnter={(event) => { event.currentTarget.style.background = "var(--app-accent-soft)"; }}
                      onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
                      onClick={() => setStockMenuOpen(false)}
                    >
                      <MenuIcon size={16} strokeWidth={1.9} aria-hidden="true" />
                      <span>{t(menuLabelKey)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Right: Language, Bell, Gear, Profile */}
      <div className="flex items-center gap-0.5">
        {/* Language */}
        <div className="relative" ref={languageRef}>
          <button
            type="button"
            onClick={() => setLangOpen(v => !v)}
            aria-haspopup="menu"
            aria-expanded={langOpen}
            aria-label={t("appearance.language")}
            className="flex items-center gap-1.5 px-3 h-9 transition-colors"
            style={{ color: "var(--app-header-text)", background: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--app-header-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--app-header-text-strong)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--app-header-text)"; }}
          >
            <Globe size={16.8} />
            <span style={{ fontSize: "14.4px" }}>{appPreferences.locale.toUpperCase()}</span>
            <ChevronDown size={12} />
          </button>
          {langOpen && (
            <div className="absolute right-0 top-10 w-32 shadow-xl border z-50"
              style={{ background: "var(--app-header)", borderColor: "var(--app-header-border)", borderRadius: 0 }}>
              {(["en", "th"] as const).map(locale => (
                <button key={locale} type="button" disabled={isSavingPreferences}
                  onClick={() => { void updatePreferences({ locale }); setLangOpen(false); }}
                  className="w-full text-left px-4 py-2 transition-colors"
                  style={{
                    fontSize: "12px",
                    color: locale === appPreferences.locale ? "var(--app-header-text-strong)" : "var(--app-header-text)",
                    background: locale === appPreferences.locale ? "var(--app-header-active)" : "transparent",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--app-header-hover)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = locale === appPreferences.locale ? "var(--app-header-active)" : "transparent"}>
                  {locale === "en" ? `EN · ${t("common.english")}` : `TH · ${t("common.thai")}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bell */}
        <button type="button" aria-label={t("common.notifications")} className="relative flex items-center justify-center w-9 h-9 transition-colors"
          style={{ color: "var(--app-header-text)", background: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--app-header-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--app-header-text-strong)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--app-header-text)"; }}>
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: "#e8813a" }} />
        </button>

        {/* Settings */}
        <Link to="/settings" aria-label={t("common.openSettings")} title={t("nav.settings")}
          className="flex items-center justify-center w-9 h-9 transition-colors"
          style={{ color: "var(--app-header-text)", background: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--app-header-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--app-header-text-strong)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--app-header-text)"; }}>
          <Settings size={18} />
        </Link>

        {/* Divider */}
        <div className="w-px h-5 mx-2" style={{ background: "var(--app-header-divider)" }} />

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button className="flex items-center gap-2.5 px-3 h-9 transition-colors"
            type="button"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((value) => !value)}
            style={{ background: profileOpen ? "var(--app-header-hover)" : "transparent" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--app-header-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = profileOpen ? "var(--app-header-hover)" : "transparent"}>
            <div className="w-7 h-7 flex items-center justify-center overflow-hidden"
              style={{ background: "var(--app-header-avatar)", color: "var(--app-header-text-strong)", fontSize: "14.4px", fontWeight: 700 }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                : getInitials(user.name)}
            </div>
            <div className="text-left min-w-0 max-w-36">
              <p className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: "15px", fontWeight: 600, color: "var(--app-header-text-strong)", lineHeight: 0.95 }}>{user.name}</p>
            </div>
            <ChevronDown size={13.2} style={{ color: "var(--app-header-text-soft)", transform: profileOpen ? "rotate(180deg)" : undefined }} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-11 z-50 w-52 border bg-white p-1.5 shadow-xl" style={{ borderColor: "var(--app-border)" }} role="menu">
              <div className="border-b px-3 py-2" style={{ borderColor: "var(--app-border-soft)" }}>
                <p className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--app-ink)", fontSize: "12px", fontWeight: 700 }}>{user.name}</p>
                <p className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--app-muted)", fontSize: "10.5px", marginTop: "2px" }}>@{user.username} · {roleLabel}</p>
              </div>
              <button type="button" role="menuitem" onClick={logout} disabled={loggingOut}
                className="mt-1 flex h-9 w-full items-center gap-2 px-3 text-left transition-colors"
                style={{ color: "#74453e", background: "transparent", fontSize: "12px", fontWeight: 650 }}
                onMouseEnter={event => { event.currentTarget.style.background = "#f8efed"; }}
                onMouseLeave={event => { event.currentTarget.style.background = "transparent"; }}>
                <LogOut size={15} aria-hidden="true" />{loggingOut ? t("common.loggingOut") : t("common.logOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
