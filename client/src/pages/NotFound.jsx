import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-4">
      <EmptyState emoji="🗺️" title="This road doesn’t go anywhere" description="The page you’re looking for has moved or never existed." action={<Button to="/app">Back to my trips</Button>} />
    </div>
  );
}
