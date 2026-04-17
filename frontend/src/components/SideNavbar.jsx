import { useState, useRef, useEffect, useContext } from "react";
import { AppContext } from "../context/AppContext";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: "dashboard",
    path: "/",
    access: ["Admin", "Manager", "StoreKeeper", "Cashier"],
  },

  {
    label: "Items",
    icon: "inventory_2",
    path: "/items",
    access: ["Admin", "Manager", "StoreKeeper"],
  },

  {
    label: "Categories",
    icon: "category",
    path: "/categories",
    access: ["Admin", "Manager"],
  },

  {
    label: "Suppliers",
    icon: "local_shipping",
    path: "/suppliers",
    access: ["Admin", "Manager", "StoreKeeper"],
  },

  {
    label: "GRN",
    icon: "input",
    path: "/grn",
    access: ["Admin", "StoreKeeper"],
  },

  {
    label: "Sales",
    icon: "point_of_sale",
    path: "/sales",
    access: ["Admin", "Cashier"],
  },

  {
    label: "Stock Movement",
    icon: "compare_arrows",
    path: "/stock-movement",
    access: ["Admin", "Manager"],
  },

  {
    label: "Users",
    icon: "group",
    path: "/users",
    access: ["Admin"],
  },

  {
    label: "Reports",
    icon: "assessment",
    path: "/reports",
    access: ["Admin", "Manager"],
  },

  {
    label: "Settings",
    icon: "settings",
    path: "/settings",
    access: ["Admin"],
  },
];
const FALLBACK_AVATAR =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDDomMYVtyZqZfIRbfYixjbaAmONSiEZhd1dcpKXZ7s87rXXbP8-qi1KSmghPkvKjpyzNPjetvI9Xx-P_YTwjOcXVj51L2DOreNWfouW9ptN3-UNzoQPwNmslkY3TRM5bRIvawgvj0gXoYCjZymLNhzQ0qM09dS29xYJUU81yuPBQVxxWWv0V9KceclekCDVtMqd0RmatB7mQ0yDlLAbeWVluJ6W-6F10SPDi5HeOmNswbE5J9Cz05zvpkK5ZT0Aw3LTtAGtNw-7HBr";

const SideNavbar = () => {
    const [menuOpen, setMenuOpen] = useState(false);

    const menuRef = useRef();

    const { userData, logout } = useContext(AppContext);
    const navigate = useNavigate();
    const location = useLocation();

    /* close dropdown when clicking outside */
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selectNav = (item) => {
        navigate(item.path);
    };

    const isItemActive = (itemPath) => {
        if (itemPath === "/") {
            return location.pathname === "/";
        }

        // Keep Users highlighted for related user-management routes.
        if (itemPath === "/users" && location.pathname.startsWith("/userform")) {
            return true;
        }

        return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
    };

    const onLogout = () => {
        logout();
        navigate("/login", { replace: true });
    };

    const user = {
        name: userData?.name ?? "User",
        role: userData?.role?.name ?? userData?.role ?? "Account",
        status: userData?.user_status?.name ?? "Active",
        avatarUrl: userData?.avatarUrl ?? FALLBACK_AVATAR,
    };

    return (
        <aside className="h-screen w-64 fixed left-0 top-0 border-r border-slate-200 bg-white flex flex-col p-4">

            {/* Logo */}
            <div className="mb-8 px-2 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-white text-[20px]">
                        inventory_2
                    </span>
                </div>

                <div>
                    <h1 className="text-xl font-bold text-slate-900">
                        IMS
                    </h1>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">
                        Premium Retail
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-0.5">
                {NAV_ITEMS.map((item) => {
                    // Check if the user has access to this navigation item
                    const hasAccess = userData?.role && item.access.includes(userData.role.name);

                    if (!hasAccess) {
                        return null;
                    }

                    const isActive = isItemActive(item.path);

                    return (
                        <button
                            key={item.label}
                            onClick={() => selectNav(item)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition
                                ${isActive
                                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                                    : "text-slate-500 hover:bg-slate-100"
                                }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">
                                {item.icon}
                            </span>

                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* User Profile */}
            <div className="mt-auto">
                <div className="border-t border-slate-100 mb-3" />

                <div
                    ref={menuRef}
                    className="relative rounded-2xl bg-slate-50 border border-slate-100 p-3"
                >
                    <div className="flex items-center gap-3">

                        <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover"
                        />

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-slate-400">
                                {user.name}
                            </p>
                            <p className="text-[11px] text-slate-400 capitalize">
                                {user.role} · {user.status}
                            </p>
                        </div>

                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200"
                        >
                            <span className="material-symbols-outlined text-[18px] text-slate-400">
                                more_horiz
                            </span>
                        </button>
                    </div>

                    {menuOpen && (
                        <div className="absolute left-0 right-0 bottom-full mb-2 rounded-xl border bg-white shadow-xl p-1.5">

                            <button
                                onClick={() => navigate("/profile")}
                                className="w-full text-slate-700 text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-lg"
                            >
                                Edit Profile
                            </button>

                            <button
                                onClick={onLogout}
                                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                Log Out
                            </button>

                        </div>
                    )}
                </div>
            </div>

        </aside>
    );
};

export default SideNavbar;