import React from "react";
import ReactDOM from "react-dom/client";
import ClinicalBoard from "./ClinicalBoard.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#F2EFE4", color: "#262019", fontFamily: "'Segoe UI', -apple-system, sans-serif", padding: 20 }}>
          <div style={{ background: "#A23B3B", color: "#fff", padding: 16, borderRadius: 4, fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap", marginBottom: 16 }}>
            <b>Application Error</b>
            <p style={{ margin: "8px 0 0" }}>{this.state.error?.message || "An unexpected error occurred."}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ marginTop: 12, background: "#F2EFE4", color: "#A23B3B", border: "none", padding: "8px 16px", borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClinicalBoard />
    </ErrorBoundary>
  </React.StrictMode>
);
