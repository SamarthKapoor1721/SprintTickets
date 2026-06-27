export function TeamLogo({
  name,
  logo,
  size = 40,
}: {
  name: string
  logo: string | null
  size?: number
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={`${name} logo`}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-[10px] border border-slate-200 bg-white object-contain"
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-tr from-primary to-blue-600 font-bold text-white"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}
