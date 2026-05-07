"use client";
import React from "react";

interface Props {
  name: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: "#ef4444", fontSize: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{this.props.name} crashed</div>
          <div style={{ opacity: 0.7 }}>{this.state.error}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: "" })}
            style={{ marginTop: 16, padding: "8px 16px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#fff", cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}