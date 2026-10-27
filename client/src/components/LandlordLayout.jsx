import { useState } from "react";
import Logo from "../Logo";
import { getLandlordActivePage, landlordFooterNavigation, landlordNavigation } from "../utils/landlordNavigation";

export default function LandlordLayout({ page, navigateTo, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activePage = getLandlordActivePage(page);
  const navigate = (destination) => {
    setMenuOpen(false);
    navigateTo(destination);
  };

  return (
    <div className="landlord-app-shell">
      <button className="landlord-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="landlord-navigation" onClick={() => setMenuOpen((open) => !open)}>
        {menuOpen ? "Close menu" : "Menu"}
      </button>
      <aside id="landlord-navigation" className={`sidebar landlord-app-sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="sidebar-logo"><Logo /><small className="sidebar-tagline">Record. Compare. Trust.</small><span>Landlord</span></div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {landlordNavigation.map(([target, icon, label]) => (
            <button key={target} type="button" className={`nav-item${activePage === target ? " active" : ""}`} aria-current={activePage === target ? "page" : undefined} onClick={() => navigate(target)}>
              <span aria-hidden="true">{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {landlordFooterNavigation.map(([target, icon, label]) => (
            <button key={target} type="button" className={`nav-item${target === "logout" ? " logout-item" : page === target ? " active" : ""}`} aria-current={page === target ? "page" : undefined} onClick={target === "logout" ? onLogout : () => navigate(target)}>
              <span aria-hidden="true">{icon}</span>{label}
            </button>
          ))}
        </div>
      </aside>
      <div className="landlord-app-content">{children}</div>
    </div>
  );
}
