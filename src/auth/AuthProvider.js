// src/auth/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, getIdTokenResult, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "utils/firebase"; // adjust alias if not using @

// Updated roles to match new structure
// Keys are used for Firebase custom claims; labels handled in UI
const ROLES = [
  "theatre_staff",
  "actor_support_staff",
  "actor",
  "pas_staff",
  "pas_support",
  "student",
  // legacy roles for backward compatibility
  "admin",
  "staff",
];

const defaultPermissionsForRoles = (roles = []) => {
  const perms = {
    actors: { read: false, write: false },
    students: { read: false, write: false },
  };
  const roleSet = new Set(Array.isArray(roles) ? roles : []);
  if (roleSet.has("theatre_staff") || roleSet.has("actor_support_staff") || roleSet.has("admin")) {
    perms.actors.read = true;
  }
  if (roleSet.has("pas_staff") || roleSet.has("pas_support") || roleSet.has("staff")) {
    perms.students.read = true;
  }
  if (roleSet.has("actor")) {
    perms.actors.read = true;
  }
  if (roleSet.has("student")) {
    perms.students.read = true;
  }
  return perms;
};

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      const token = await getIdTokenResult(fbUser, true);
      const claims = token.claims || {};
      const roles = ROLES.filter((r) => claims[r] === true);

      let profile = null;
      try {
        const snap = await getDoc(doc(db, "users", fbUser.uid));
        profile = snap.exists() ? snap.data() : null;
      } catch (err) {
        console.error("Failed to load user profile", err);
      }

      const permissions = profile?.permissions || defaultPermissionsForRoles(roles);
      const email = (fbUser.email || "").toLowerCase();
      const isSuperUser = email === "ensemble@blueteapot.ie";

      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        roles,
        permissions,
        isSuperUser,
        displayName: profile?.displayName || fbUser.displayName || fbUser.email || "",
        group: claims.group || profile?.group || null, // 'actors' | 'year1' | 'year2' | 'year3'
      });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signOutNow: () => signOut(auth),
      hasRole: (...r) => !!user && r.some((x) => user.roles.includes(x)),
      canReadStrand: (strand) => !!user?.permissions?.[strand]?.read,
      canWriteStrand: (strand) => !!user?.permissions?.[strand]?.write,
      canReadUsers: () => !!user?.isSuperUser || !!user?.permissions?.users?.read,
      canWriteUsers: () => !!user?.isSuperUser || !!user?.permissions?.users?.write,
    }),
    [user, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
