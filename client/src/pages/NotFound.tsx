import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-content-muted mb-2">404</h1>
        <h2 className="text-xl font-bold text-content mb-2">Page not found</h2>
        <p className="text-sm text-content-muted mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
