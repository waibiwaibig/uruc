import { MainLayout } from '../components/layout/MainLayout';
import { ParkViewProvider } from '../context';
import { useParkFeed } from '../hooks';
import { PlaceholderPage } from './PlaceholderPage';

export function ProfilePage() {
  const park = useParkFeed();

  return (
    <ParkViewProvider value={park}>
      <MainLayout>
        <PlaceholderPage title="Profile" />
      </MainLayout>
    </ParkViewProvider>
  );
}
