import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { ROLES } from "@shared/schema";

export default function LoginPage() {
  const { login, isLoggingIn, register, isRegistering } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: ROLES.CLIENT, // default for registration
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      register(formData, {
        onSuccess: () => setIsRegister(false),
      });
    } else {
      login(
        { username: formData.username, password: formData.password },
        { onSuccess: () => setLocation("/dashboard") }
      );
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl shadow-black/5 border border-border">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-muted-foreground">
            {isRegister ? "Sign up to get started" : "Enter your credentials to access the portal"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/80">Username</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-xl bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="johndoe"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/80">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground/80">Role</label>
              <select
                className="w-full px-4 py-3 rounded-xl bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              >
                {Object.values(ROLES).map((role) => (
                  <option key={role} value={role} className="capitalize">
                    {role.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            disabled={isLoggingIn || isRegistering}
            className="w-full mt-6 py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {(isLoggingIn || isRegistering) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRegister ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-primary hover:underline font-medium"
          >
            {isRegister ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
