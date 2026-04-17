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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const pendingKey = `signup_finalize_pending_${session.user.id}`;
            if (sessionStorage.getItem(pendingKey) === "1") {
              try { await supabase.functions.invoke("finalize-signup-uploads"); }
              catch (err) { console.error("finalize-signup-uploads failed", err); }
              finally { sessionStorage.removeItem(pendingKey); }
            }
            await loadUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setDriverData(null);
          setRoles([]);
          setActiveRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

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
