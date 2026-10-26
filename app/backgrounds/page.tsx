import Link from 'next/link'

export const metadata = { title: 'Background guide' }
const examples = [
  { title: 'Plain colour', description: 'Use the first colour as a still background.', settings: { type: 'color', colors: ['#151515'], overlay: 0 } },
  { title: 'Animated preset', description: 'Choose waves, gradient or aurora. Set animation to none for a still preset, drift for movement or pulse for a slower breathing effect.', settings: { type: 'preset', preset: 'aurora', animation: 'drift', speed: 0.6, colors: ['#151515', '#6436a3', '#19758c'], overlay: 0.15 } },
  { title: 'Image', description: 'A JPG, PNG, WebP or other browser-supported image. Cover fills the screen; contain shows the whole asset.', settings: { type: 'image', src: '/backgrounds/landscape.webp', fit: 'cover', position: 'center', overlay: 0.3 } },
  { title: 'GIF', description: 'Use a static poster for reduced-motion visitors. GIF animation uses its own timing.', settings: { type: 'gif', src: '/backgrounds/scene.gif', poster: '/backgrounds/scene-still.webp', fit: 'cover', overlay: 0.3 } },
  { title: 'Video', description: 'Use a browser-supported MP4 or WebM. Video is muted, loops inline, pauses in hidden tabs, and uses the poster or fallback colour when motion or autoplay is unavailable.', settings: { type: 'video', src: '/backgrounds/ambient.webm', poster: '/backgrounds/ambient-still.webp', fit: 'cover', position: '50% 30%', overlay: 0.35 } },
]
export default function BackgroundGuide() {
  return <main className="min-h-screen bg-[#151515] px-4 py-8 text-white"><article className="mx-auto max-w-3xl space-y-5">
    <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">← Dashboard</Link><h1 className="text-2xl font-bold">Background guide</h1>
    <p className="text-sm leading-6 text-white/75">Edit <code>appearance.background</code> in <code>site.config.json</code>. Merge one of these examples with the existing background fields, then restart the development server or redeploy the site. Put local media in <code>public/backgrounds/</code>; its URL starts with <code>/backgrounds/</code>.</p>
    {examples.map(example => <section key={example.title} className="rounded-2xl border border-white/10 bg-white/5 p-4"><h2 className="font-semibold">{example.title}</h2><p className="mt-2 text-sm leading-6 text-white/65">{example.description}</p><pre className="mt-3 overflow-x-auto rounded-lg bg-black/25 p-3 text-xs"><code>{JSON.stringify(example.settings, null, 2)}</code></pre></section>)}
    <section className="rounded-2xl border border-white/10 p-4 text-sm leading-6 text-white/75"><h2 className="font-semibold text-white">Usage notes</h2><p className="mt-2">Use one to eight six-digit hex colours. The first is the fallback colour if media fails. Speed accepts 0.1–3 and affects presets; overlay accepts 0–1 and darkens the background for readability.</p><p className="mt-2">HTTPS media URLs also work. Use the final media host if the URL redirects. The site allows only the configured media origins in its content security policy. Keep files compressed and short; decorative backgrounds should load quickly on a mobile connection. Still-image mode must use a genuinely static asset.</p><p className="mt-2">The repository’s <code>CONFIGURATION.md</code> contains the complete configuration reference, including modules, seasons and fork setup. Media files and licence permissions belong to the site owner.</p></section>
  </article></main>
}
