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
  const tone = numeral ? 'text-gradient-brand' : step === 'Dance!' ? 'text-primary' : 'text-white'
  const size = numeral ? 'text-[10rem] leading-none sm:text-[14rem]' : 'text-6xl sm:text-8xl'

  return createPortal(
    <div
      data-testid="start-countdown"
      className="pointer-events-none fixed inset-0 z-(--layer-countdown) flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm animate-fade-in"
    >
      <div role="status" aria-live="assertive" className="text-center">
        {/* Keyed by step, so every new numeral pops in again. */}
        <span
          key={step}
          className={`block font-black tracking-tight tabular-nums [filter:drop-shadow(0_0_3px_rgb(255_255_255/0.95))_drop-shadow(0_8px_36px_rgb(230_25_92/0.6))] motion-safe:animate-count-pop motion-reduce:animate-fade-in ${tone} ${size}`}
        >
          {step}
        </span>
      </div>
    </div>,
    document.body,
  )
}
