"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, ShoppingCart, Package, Archive, Users,
  BarChart2, Plug, MoreHorizontal, Settings, Globe, ChevronDown, Bell,
} from "lucide-react";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Sales", href: "/sales", icon: ShoppingCart },
  { label: "Purchase", href: "/purchase/new", icon: Package },
  { label: "Stock", href: "/stock", icon: Archive },
  { label: "Member", href: "/member", icon: Users },
  { label: "Analysis", href: "/analysis", icon: BarChart2 },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "More", href: "/more", icon: MoreHorizontal },
];

const getTopLevelPath = (href: string) => (href === "/" ? "/" : `/${href.split("/")[1]}`);

export function TopBar() {
  const pathname = usePathname();
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("EN");

  return (
    <div
      style={{ background: "#1e3828", borderBottom: "1px solid #2e5040" }}
      className="flex items-center justify-between px-4 h-14 shrink-0"
    >
      {/* Left: Logo + Nav */}
      <div className="flex items-center h-full">
        {/* Logo */}
        <div className="flex items-center gap-2.5 pr-5 mr-2" style={{ borderRight: "1px solid #354e3e" }}>
          <div className="w-8 h-8 flex items-center justify-center" style={{ background: "#4a8c65" }}>
            <svg width="21.6" height="21.6" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#d4eedd"/>
              <path d="M9 12h6M12 9v6" stroke="#1e3828" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p style={{ color: "#f0f7f3", fontSize: "15.6px", fontWeight: 700, letterSpacing: 0, lineHeight: 1 }}>RxPro</p>
            <p style={{ color: "#8bbfa0", fontSize: "10.8px", lineHeight: 0.9 }}>Pharmacy</p>
          </div>
        </div>

        {/* Nav Items */}
        {navItems.map(({ label, href, icon: Icon }) => {
          const topLevelPath = getTopLevelPath(href);
          const isActive = topLevelPath === "/" ? pathname === "/" : pathname.startsWith(topLevelPath);
          const isHome = label === "Home";
          return (
            <Link
              key={label}
              href={href}
              className={`flex h-full items-center transition-colors ${isHome ? "w-11 justify-center" : "gap-2 px-4"}`}
              style={{
                background: isActive ? "#275c3a" : "transparent",
                color: isActive ? "#f0f7f3" : "#b8d4c4",
                borderRadius: 0,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "#243d2e";
                  (e.currentTarget as HTMLElement).style.color = "#e0f0e8";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#b8d4c4";
                }
              }}
            >
              <Icon
                size={16.8}
                strokeWidth={isActive ? 2.2 : 1.8}
                style={isHome ? { transform: "translateX(-1px)" } : undefined}
              />
              {!isHome && (
                <span style={{ fontSize: "15.6px", fontWeight: isActive ? 600 : 400 }}>{label}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Right: Language, Bell, Gear, Profile */}
      <div className="flex items-center gap-0.5">
        {/* Language */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 h-9 transition-colors"
            style={{ color: "#b8d4c4", background: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#243d2e"; (e.currentTarget as HTMLElement).style.color = "#e0f0e8"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#b8d4c4"; }}
          >
            <Globe size={16.8} />
            <span style={{ fontSize: "14.4px" }}>{lang}</span>
            <ChevronDown size={12} />
          </button>
          {langOpen && (
            <div className="absolute right-0 top-10 w-32 shadow-xl border z-50"
              style={{ background: "#1e3828", borderColor: "#2e5040", borderRadius: 0 }}>
              {["EN", "TH", "ZH", "JP"].map(l => (
                <button key={l} onClick={() => { setLang(l); setLangOpen(false); }}
                  className="w-full text-left px-4 py-2 transition-colors"
                  style={{
                    fontSize: "12px",
                    color: l === lang ? "#f0f7f3" : "#b8d4c4",
                    background: l === lang ? "#275c3a" : "transparent",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#243d2e"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = l === lang ? "#275c3a" : "transparent"}>
                  {l === "EN" ? "🇺🇸 English" : l === "TH" ? "🇹🇭 Thai" : l === "ZH" ? "🇨🇳 Chinese" : "🇯🇵 Japanese"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bell */}
        <button className="relative flex items-center justify-center w-9 h-9 transition-colors"
          style={{ color: "#b8d4c4", background: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#243d2e"; (e.currentTarget as HTMLElement).style.color = "#e0f0e8"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#b8d4c4"; }}>
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: "#e8813a" }} />
        </button>

        {/* Settings */}
        <button className="flex items-center justify-center w-9 h-9 transition-colors"
          style={{ color: "#b8d4c4", background: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#243d2e"; (e.currentTarget as HTMLElement).style.color = "#e0f0e8"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#b8d4c4"; }}>
          <Settings size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 mx-2" style={{ background: "#354e3e" }} />

        {/* User Profile */}
        <button className="flex items-center gap-2.5 px-3 h-9 transition-colors"
          style={{ background: "transparent" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#243d2e"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
          <div className="w-7 h-7 flex items-center justify-center"
            style={{ background: "#4a7a5e", color: "#d8f0e4", fontSize: "14.4px", fontWeight: 700 }}>
            JD
          </div>
          <div className="text-left">
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#f0f7f3", lineHeight: 0.95 }}>John Doe</p>
            <p style={{ fontSize: "12px", color: "#8bbfa0", lineHeight: 0.85 }}>Pharmacist</p>
          </div>
          <ChevronDown size={13.2} style={{ color: "#8bbfa0" }} />
        </button>
      </div>
    </div>
  );
}
