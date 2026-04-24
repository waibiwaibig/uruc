import { MainLayout } from './components/layout/MainLayout';
import { ParkViewProvider } from './context';
import { useParkFeed } from './hooks';
import { Home } from './pages/Home';

export function ParkHomePage() {
  const park = useParkFeed();

  return (
    <ParkViewProvider value={park}>
      <MainLayout>
        <Home />
      </MainLayout>
    </ParkViewProvider>
  );
}
