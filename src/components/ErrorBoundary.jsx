import React from 'react';

/**
 * Wrap each tab so a render error in one tab doesn't crash the whole app.
 * Shows a compact, themed error card and stashes the error on `window.__lastError__`
 * for debugging.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    window.__lastError__ = {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-destructive">
              Tab failed to render
            </div>
            <div className="font-serif text-xl font-semibold text-foreground">
              {this.props.name || 'component'}
            </div>
            <div className="mt-3 rounded-lg border border-destructive/20 bg-card p-3 font-mono text-xs text-destructive">
              {String(this.state.error?.message || this.state.error)}
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              Switch to another tab and back to retry. Full stack is on{' '}
              <code>window.__lastError__</code>.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
