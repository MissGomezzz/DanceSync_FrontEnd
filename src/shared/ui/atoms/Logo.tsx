interface LogoProps {
  className?: string
}

export function Logo({ className = 'h-10' }: LogoProps) {
  return <img src="/logo.png" alt="DanceSync" className={className} />
}