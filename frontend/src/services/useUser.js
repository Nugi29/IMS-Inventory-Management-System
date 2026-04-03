import { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { AppContext } from "../context/AppContext";

const ENDPOINTS = {
  list:   "/api/user/all-profiles",
  create: "/api/user/user-register",
  update: "/api/user/update-user",
  remove: "/api/user/delete",
};

export function useUser() {
  const { backendUrl, token } = useContext(AppContext);
  const [users, setUsers]         = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const headers  = useCallback(() => ({ headers: { token } }), [token]);
  const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl]);

  const parseUsers = (data) =>
    data?.usersData ?? data?.userData ?? (Array.isArray(data) ? data : []);

  // ── load ──────────────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    if (!token) { setUsers([]); return; }
    setIsLoadingUsers(true);
    try {
      const { data } = await axios.get(endpoint(ENDPOINTS.list), headers());
      setUsers(parseUsers(data));
    } catch {
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [token, endpoint, headers]);

  // ── create ────────────────────────────────────────────────────────────────

  const addUser = async (payload) => {
    try {
      const { data } = await axios.post(endpoint(ENDPOINTS.create), payload, headers());
      if (data?.success) { await loadUsers(); return { success: true, message: data.message }; }
      return { success: false, message: data?.message ?? "Failed to add user" };
    } catch (err) {
      return { success: false, message: err?.response?.data?.message ?? err.message };
    }
  };

  // ── update ────────────────────────────────────────────────────────────────

  const updateUser = async (user) => {
    const id = Number(user?.id ?? user?.user_id ?? user?._id);
    if (!id) return { success: false, message: "Missing user id" };

    const payload = Object.fromEntries(
      Object.entries({
        id,
        name:           user.name,
        username:       user.username?.trim(),
        password:       user.password,
        role_id:        user.role_id,
        user_status_id: user.user_status_id,
        createdAt:      user.createdAt,
      }).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );

    // try PUT first, fall back to POST
    for (const method of ["put", "post"]) {
      try {
        const fn = method === "put" ? axios.put : axios.post;
        const { data } = await fn(endpoint(`${ENDPOINTS.update}/${id}`), payload, headers());
        if (data?.success) { await loadUsers(); return { success: true, message: data.message }; }
      } catch { /* try next */ }
    }
    return { success: false, message: "Failed to update user" };
  };

  // ── delete ────────────────────────────────────────────────────────────────

  const deleteUser = async (user) => {
    const id = Number(user?.id ?? user?.user_id ?? user?._id);
    if (!id) return { success: false, message: "Missing user id" };

    try {
      const { data } = await axios.delete(endpoint(`${ENDPOINTS.remove}/${id}`), headers());
      if (data?.success) { await loadUsers(); return { success: true, message: data.message }; }
      return { success: false, message: data?.message ?? "Failed to delete user" };
    } catch (err) {
      return { success: false, message: err?.response?.data?.message ?? err.message };
    }
  };

  useEffect(() => { loadUsers(); }, [loadUsers]);

  return { users, isLoadingUsers, reloadUsers: loadUsers, addUser, updateUser, deleteUser };
}

export const useUsers = useUser;