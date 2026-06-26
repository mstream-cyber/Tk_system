import { Component } from 'react';
import { Button } from './ui/Button';
import { XCircleIcon } from './ui/Icons';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-danger-subtle flex items-center justify-center mx-auto mb-4">
              <XCircleIcon className="text-danger-light" size={28} />
            </div>
            <h2 className="text-xl font-bold text-content mb-2">Something went wrong</h2>
            <p className="text-sm text-content-muted mb-4">An unexpected error occurred. Please try reloading the page.</p>
            <Button onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
