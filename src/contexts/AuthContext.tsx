import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "driver" | "passenger" | "master";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: any | null;
  driverData: any | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  switchRole: (role: AppRole) => Promise<void>;
  signUp: (email: string, password: string, metadata: Record<string, string>) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_ROLE_KEY = "vamoo_active_role";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [driverData, setDriverData] = useState<any | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);

  const loadUserData = useCallback(async (uid: string) => {
    // Profile
    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("user_id", uid).maybeSingle();
    setProfile(profileData);

    // Roles
    const { data: rolesData } = await supabase
      .from("user_roles").select("role").eq("user_id", uid);
    const userRoles = (rolesData || []).map((r: any) => r.role as AppRole);
    setRoles(userRoles);

    // Driver
    let driver: any = null;
    if (userRoles.includes("driver")) {
      const { data } = await supabase
        .from("drivers").select("*").eq("user_id", uid).maybeSingle();
      driver = data;
    }
    setDriverData(driver);

    // Active role: localStorage > profile.active_role > primeiro role > user_type
    const stored = localStorage.getItem(ACTIVE_ROLE_KEY) as AppRole | null;
    let active: AppRole | null = null;
    if (stored && userRoles.includes(stored)) active = stored;
    else if (profileData?.active_role && userRoles.includes(profileData.active_role)) active = profileData.active_role;
    else if (userRoles.includes("admin")) active = "admin";
    else if (userRoles.length > 0) active = userRoles[0];
    else if (profileData?.user_type) active = profileData.user_type as AppRole;
    setActiveRole(active);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const handleSession = async (sess: Session | null) => {
      if (cancelled) return;
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        const pendingKey = `signup_finalize_pending_${sess.user.id}`;
        if (sessionStorage.getItem(pendingKey) === "1") {
          try { await supabase.functions.invoke("finalize-signup-uploads"); }
          catch (err) { console.error("finalize-signup-uploads failed", err); }
          finally { sessionStorage.removeItem(pendingKey); }
        }
        await loadUserData(sess.user.id);
      } else {
        setProfile(null);
        setDriverData(null);
        setRoles([]);
        setActiveRole(null);
      }
      if (!cancelled) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Defer async work so we don't block the auth callback
        setTimeout(() => handleSession(session), 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [loadUserData]);

  // 🔄 Realtime: atualiza profile/driver/roles automaticamente sem recarregar
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`auth-rt-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, () => {
        loadUserData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers", filter: `user_id=eq.${user.id}` }, () => {
        loadUserData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, () => {
        loadUserData(user.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadUserData]);

  const switchRole = async (role: AppRole) => {
    if (!roles.includes(role)) return;
    setActiveRole(role);
    localStorage.setItem(ACTIVE_ROLE_KEY, role);
    if (user) {
      await supabase.from("profiles").update({ active_role: role }).eq("user_id", user.id);
    }
  };

  const signUp = async (email: string, password: string, metadata: Record<string, string>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: window.location.origin },
    });
    if (!error && data?.user?.id) {
      try { sessionStorage.setItem(`signup_finalize_pending_${data.user.id}`, "1"); } catch {}
    }
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(ACTIVE_ROLE_KEY);
    setUser(null);
    setSession(null);
    setProfile(null);
    setDriverData(null);
    setRoles([]);
    setActiveRole(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    await loadUserData(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, profile, driverData,
      roles, activeRole, switchRole,
      signUp, signIn, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
