
import { useCallback, useEffect, useState } from "react";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AcceptInvitation from "./pages/auth/AcceptInvitation";

import Dashboard from "./pages/landlord/Dashboard";
import Settings from "./pages/landlord/Settings";
import Profile from "./pages/landlord/Profile";
import Reports from "./pages/landlord/Reports";
import InviteTenant from "./pages/landlord/InviteTenant";
import Properties from "./pages/landlord/Properties";
import Inspections from "./pages/landlord/Inspections";
import FinalHandoverPage from "./pages/shared/FinalHandoverPage";
import ResetPassword from "./pages/auth/ResetPassword";

import TenantDashboard from "./pages/tenant/Dashboard";
import LandlordLayout from "./components/LandlordLayout";

const VALID_PAGES = new Set([
  "login",
  "register",
  "acceptInvitation",
  "dashboard",
  "addProperty",
  "settings",
  "profile",
  "reports",
  "inviteTenant",
  "properties",
  "propertyDetails",
  "inspections",
  "tenantDashboard",
  "finalHandover",
  "resetPassword",
]);

const PROTECTED_PAGES = new Set([
  "dashboard", "addProperty", "settings", "profile", "reports", "inviteTenant",
  "properties", "propertyDetails", "inspections", "tenantDashboard", "finalHandover",
]);

const LANDLORD_PAGES = new Set([
  "dashboard", "addProperty", "settings", "profile", "reports", "inviteTenant", "properties",
  "propertyDetails", "inspections",
]);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getInvitationToken() {
  const match = window.location.pathname.match(
    /^\/accept-invitation\/([^/]+)\/?$/
  );

  return match ? decodeURIComponent(match[1]) : "";
}

function getCurrentRoute() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const invitationToken = getInvitationToken();

  if (invitationToken) {
    return {
      page: "acceptInvitation",
      propertyId: "",
      invitationToken,
    };
  }

  const propertyMatch = path.match(/^\/properties\/([^/]+)\/?$/);

  if (propertyMatch) {
    return {
      page: "propertyDetails",
      propertyId: decodeURIComponent(propertyMatch[1]),
      invitationToken: "",
    };
  }

  if (path === "/properties" || path === "/properties/") {
    return {
      page: "properties",
      propertyId: "",
      invitationToken: "",
    };
  }

  const savedPage = params.get("page");
  if (savedPage === "resetPassword") return { page: "resetPassword", propertyId: "", invitationToken: "", resetToken: params.get("token") || "" };
  const page = VALID_PAGES.has(savedPage) ? savedPage : "login";

  return {
    page,
    propertyId: "",
    invitationToken: "",
  };
}

function App() {
  const [route, setRoute] = useState(getCurrentRoute);
  const { page: routePage, propertyId, invitationToken, resetToken } = route;
  const user = readStoredUser();
  const token = localStorage.getItem("token");
  const role = user?.role;
  const isAuthenticated = Boolean(token && user?.id && ["landlord", "tenant"].includes(role));
  const page = PROTECTED_PAGES.has(routePage)
    ? !isAuthenticated
      ? "login"
      : LANDLORD_PAGES.has(routePage) && role !== "landlord"
        ? "tenantDashboard"
        : routePage === "tenantDashboard" && role !== "tenant"
          ? "dashboard"
          : routePage
    : routePage;

  const navigateTo = useCallback((nextPage, options = {}) => {
    if (!VALID_PAGES.has(nextPage)) return;

    let url;

    if (nextPage === "login") {
      url = "/";
    } else if (nextPage === "properties") {
      url = "/properties";
    } else if (nextPage === "propertyDetails" && options.propertyId) {
      url = `/properties/${encodeURIComponent(options.propertyId)}`;
    } else if (nextPage === "acceptInvitation" && options.token) {
      url = `/accept-invitation/${encodeURIComponent(options.token)}`;
    } else {
      url = `/?page=${encodeURIComponent(nextPage)}`;
    }

    window.history.pushState(
      { page: nextPage, propertyId: options.propertyId || "" },
      "",
      url
    );

    setRoute({
      page: nextPage,
      propertyId: options.propertyId || "",
      invitationToken: options.token || "",
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getCurrentRoute());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (page === routePage) return;
    const url = page === "login" ? "/" : `/?page=${encodeURIComponent(page)}`;
    window.history.replaceState({ page }, "", url);
  }, [page, routePage]);

  useEffect(() => {
    if (!invitationToken) return;

    window.history.replaceState(
      { page: "acceptInvitation" },
      "",
      window.location.pathname
    );
  }, [invitationToken]);

  const handleLoginSuccess = (user) => {
    navigateTo(
      user?.role === "tenant" ? "tenantDashboard" : "dashboard"
    );
  };

  const goToLogin = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    navigateTo("login");
  };

  const openPropertyDetails = (id) => {
    navigateTo("propertyDetails", { propertyId: id });
  };

  const backToProperties = () => {
    navigateTo("properties");
  };
  const withLandlordLayout = (content) => role === "landlord"
    ? <LandlordLayout page={page} navigateTo={navigateTo} onLogout={goToLogin}>{content}</LandlordLayout>
    : content;

  if (page === "login") {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onRegister={() => navigateTo("register")}
      />
    );
  }

  if (page === "resetPassword") {
    return <ResetPassword token={resetToken} onLogin={() => navigateTo("login")} />;
  }

  if (page === "register") {
    return (
      <Register
        onRegisterSuccess={handleLoginSuccess}
        onLogin={() => navigateTo("login")}
      />
    );
  }

  if (page === "acceptInvitation") {
    return (
      <AcceptInvitation
        token={invitationToken}
        onSuccess={handleLoginSuccess}
        onLogin={() => navigateTo("login")}
      />
    );
  }

  if (page === "tenantDashboard") {
    return <TenantDashboard user={user} onLogout={goToLogin} />;
  }

  if (page === "dashboard") {
    return withLandlordLayout(
      <Dashboard
        user={user}
        onLogout={goToLogin}
        onProperties={() => navigateTo("properties")}
        onAddProperty={() => navigateTo("addProperty")}
        onReports={() => navigateTo("reports")}
        onInviteTenant={() => navigateTo("inviteTenant")}
        onInspections={() => navigateTo("inspections")}
        onFinalHandover={() => navigateTo("finalHandover")}
        onSettings={() => navigateTo("settings")}
        onProfile={() => navigateTo("profile")}
      />
    );
  }

  if (page === "properties" || page === "addProperty") {
    return withLandlordLayout(
      <Properties
        mode={page === "addProperty" ? "add" : undefined}
        onBack={() => navigateTo("dashboard")}
        onProperties={backToProperties}
        onPropertyDetails={openPropertyDetails}
      />
    );
  }

  if (page === "propertyDetails") {
    return withLandlordLayout(
      <Properties
        propertyId={propertyId}
        onBack={backToProperties}
        onProperties={backToProperties}
        onPropertyDetails={openPropertyDetails}
      />
    );
  }

  if (page === "settings") {
    return withLandlordLayout(<Settings onBack={() => navigateTo("dashboard")} />);
  }

  if (page === "profile") {
    return withLandlordLayout(<Profile user={user} />);
  }

  if (page === "reports") {
    return withLandlordLayout(<Reports onBack={() => navigateTo("dashboard")} />);
  }

  if (page === "inviteTenant") {
    return withLandlordLayout(<InviteTenant />);
  }

  if (page === "inspections") {
    return withLandlordLayout(<Inspections onBack={() => navigateTo("dashboard")} />);
  }

  if (page === "finalHandover") {
    return withLandlordLayout(<FinalHandoverPage />);
  }

  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      onRegister={() => navigateTo("register")}
    />
  );
}

export default App;
