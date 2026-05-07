"use client";

import { useState } from "react";

import { C, RADIUS, FONT } from "../lib/theme";
import { createClient } from "../lib/supabase";

const supabase = createClient();

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: C.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      {/* Logo / App Name */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div
          style={{
            fontSize: FONT.xxl,
            fontWeight: 700,
            color: C.text,
            letterSpacing: "-0.5px",
          }}
        >
          GeniLead
        </div>
        <div style={{ fontSize: FONT.sm, color: C.sub, marginTop: 6 }}>
          Sign in to your account
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          backgroundColor: C.s2,
          borderRadius: RADIUS.lg,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Email */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: FONT.sm, color: C.sub, fontWeight: 500 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              backgroundColor: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md,
              padding: "12px 14px",
              fontSize: FONT.md,
              color: C.text,
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Password */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: FONT.sm, color: C.sub, fontWeight: 500 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
            style={{
              backgroundColor: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md,
              padding: "12px 14px",
              fontSize: FONT.md,
              color: C.text,
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Error */}
        {error ? (
          <div
            style={{
              fontSize: FONT.sm,
              color: C.danger,
              backgroundColor: `${C.danger}18`,
              borderRadius: RADIUS.sm,
              padding: "10px 12px",
            }}
          >
            {error}
          </div>
        ) : null}

        {/* Sign In Button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            backgroundColor: loading ? C.muted : C.accent,
            color: "#fff",
            border: "none",
            borderRadius: RADIUS.md,
            padding: "14px",
            fontSize: FONT.md,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 4,
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </div>

      {/* Footer note */}
      <div style={{ fontSize: FONT.xs, color: C.sub, marginTop: 32, textAlign: "center" }}>
        Agent access only. Contact your administrator to get access.
      </div>
    </div>
  );
}