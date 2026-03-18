import { Card } from '@/components/ui';

const INFO_CARDS = [
  {
    title: '🐸 How to use Froddle',
    body: 'Browse or create a room, invite your crew, and start sketching together in real time with chat, reactions, and live cursors.',
  },
  {
    title: '🎨 What the app does',
    body: 'Froddle is a collaborative whiteboard for playful brainstorming, doodles, quick diagrams, and lightweight team ideation.',
  },
  {
    title: '✨ Quick tips',
    body: 'Use two fingers to pan and pinch-zoom on mobile, Shift + drag to pan on desktop, and switch brush styles for different textures.',
  },
];

export function InfoCardsSection() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {INFO_CARDS.map((card) => (
        <Card key={card.title} className="space-y-2 bg-[color:var(--surface)] p-5">
          <h2 className="text-lg font-black text-[color:var(--text-main)]">{card.title}</h2>
          <p className="text-sm leading-6 text-[color:var(--text-muted)]">{card.body}</p>
        </Card>
      ))}
    </section>
  );
}
