import ChesscapeGame from './chesscape-game';
import DiscoveryContent from './discovery-content';
import { structuredData } from '@/lib/discovery';
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <ChesscapeGame>
        <DiscoveryContent />
      </ChesscapeGame>
    </>
  );
}
