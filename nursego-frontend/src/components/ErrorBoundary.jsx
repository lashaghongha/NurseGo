import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '40px 20px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>😕</div>
          <h2 style={{ marginBottom: 8 }}>რაღაც შეცდა</h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            გვერდი ვერ ჩაიტვირთა. გთხოვ, სცადე თავიდან.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre style={{
              background: '#fef2f2', color: '#dc2626', padding: 16,
              borderRadius: 8, fontSize: 12, textAlign: 'left',
              overflow: 'auto', marginBottom: 24,
            }}>
              {this.state.error?.toString()}
            </pre>
          )}
          <button
            className="btn btn-primary"
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          >
            🔄 გვერდის განახლება
          </button>
        </div>
      </div>
    );
  }
}
