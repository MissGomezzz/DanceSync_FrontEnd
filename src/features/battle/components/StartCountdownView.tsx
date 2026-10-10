import { createPortal } from 'react-dom'

interface StartCountdownViewProps {
  /** "Get ready", "3", "2", "1" or "Dance!". */
  step: string
}

/**
 * Full-screen start countdown over a dimmed page. It only informs, so clicks go
 * through to the page (a dancer may still need to turn the camera on).
 */
export function StartCountdownView({ step }: StartCountdownViewProps) {
  const numeral = /^\d$/.test(step)
  const tone = numeral ? 'text-white' : step === 'Dance!' ? 'text-fuchsia-300' : 'text-slate-200'
  const size = numeral ? 'text-[10rem] leading-none sm:text-[14rem]' : 'text-6xl sm:text-8xl'

  return createPortal(
    <div
      data-testid="start-countdown"
      className="pointer-events-none fixed inset-0 z-(--layer-countdown) flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm animate-fade-in"
    >
      <div role="status" aria-live="assertive" className="text-center">
        {/* Keyed by step, so every new numeral pops in again. */}
        <span
          key={step}
          className={`block font-black tracking-tight tabular-nums [text-shadow:0_6px_40px_rgb(217_70_239/0.55)] motion-safe:animate-count-pop motion-reduce:animate-fade-in ${tone} ${size}`}
        >
          {step}
        </span>
      </div>
    </div>,
    document.body,
  )
}
