// How-to-play popup opened from the home screen.

const STEPS: { title: string; text: string; image?: { src: string; alt: string; caption: string } }[] = [
  {
    title: 'Pick a game mode',
    text: 'After pressing Play, choose Addition, Add & Multiply, or Challenge. Only Challenge gets harder over time.',
  },
  {
    title: 'Get in position',
    text: 'Next, hold both open hands inside the outlines for 3 seconds. The game starts on its own.',
  },
  {
    title: 'Keep your hands upright',
    text: 'Hold your hands vertically with your fingers pointing up and palms facing the camera, so it can clearly see each finger.',
  },
  {
    title: 'Rest your hands',
    text: 'The moment the game starts your scythes will be out, because your hands are still held open. Relax your hands into the resting pose below: on each hand, curl your ring and little fingers down and touch them with your thumb, and keep your pointer and middle fingers pointing up. Your gloves come back, and the scythe only returns when you open a hand fully.',
    image: {
      src: '/img/resting-hands.png',
      alt: 'Two gloved hands at rest: the pointer and middle fingers pointing up, the ring and little fingers curled down and touched by the thumb.',
      caption: 'Resting hands: thumb touching the two curled fingers, pointer and middle fingers up.',
    },
  },
  {
    title: 'Grab a cannonball',
    text: 'Pinch your index and middle fingertips together over a ball to pick it up. Open your fingers to let go.',
  },
  {
    title: 'Make a number',
    text: 'Hold a ball in each hand and touch them together. They join into one ball in your right hand, using the operation highlighted in the top-right corner. Subtraction takes the left ball away from the right one.',
  },
  {
    title: 'Switch operations',
    text: 'Stretch out either thumb to move to the next operation your game mode allows (addition, subtraction or multiplication). It works even while you hold a ball. The top-right corner shows the active one.',
  },
  {
    title: 'Fire the cannon',
    text: 'Drop a ball onto the cannon in front of a ship. After a moment it fires up that lane.',
  },
  {
    title: 'Sink the ships',
    text: 'Each ship carries a number. Hit it with the same number to sink it and score that many points. A wrong number bounces off.',
  },
  {
    title: 'Chase off birds',
    text: 'A bird lands and blocks your view. Open the hand on the other side fully, all four fingers out, to get a scythe, then swing it into the bird before it attacks. Each bird is worth 10 points.',
  },
  {
    title: 'Stay alive',
    text: 'You have 3 hearts. You lose one when a ship reaches the shore or a bird hits you. Lose all 3 and the game is over. In Challenge mode, every 60 seconds the numbers get bigger and the ships come faster.',
  },
]

export default function Instructions({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '100%',
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: '24px 26px',
          borderRadius: 14,
          border: '2px solid #f2c14e',
          background: 'rgba(30, 22, 12, 0.96)',
          color: '#f1e6c8',
          font: '16px system-ui, sans-serif',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ font: 'bold 32px Georgia, serif', color: '#f2c14e', textAlign: 'center', marginBottom: 18 }}>
          How to play
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STEPS.map((step, i) => (
            <li key={step.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                style={{
                  flex: '0 0 auto',
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: '#8a5a1c',
                  border: '2px solid #f2c14e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: 'bold 15px system-ui, sans-serif',
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{step.title}</div>
                <div style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.9 }}>{step.text}</div>
                {step.image && (
                  <figure style={{ margin: '10px 0 0', padding: 0 }}>
                    <img
                      src={step.image.src}
                      alt={step.image.alt}
                      style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: 420,
                        borderRadius: 10,
                        background: 'rgba(241, 230, 200, 0.92)',
                      }}
                    />
                    <figcaption style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>{step.image.caption}</figcaption>
                  </figure>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div style={{ marginTop: 16, fontSize: 13, opacity: 0.7, textAlign: 'center' }}>
          Press Exit or Escape during a game to return here.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 40px',
              border: '2px solid #f2c14e',
              borderRadius: 10,
              background: '#8a5a1c',
              color: '#f1e6c8',
              font: 'bold 18px system-ui, sans-serif',
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
