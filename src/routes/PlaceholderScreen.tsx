export function PlaceholderScreen({ name }: { name: string }) {
  return (
    <div className="flex h-full min-h-screen items-center justify-center">
      <h1 className="font-display text-4xl text-text">{name}</h1>
    </div>
  )
}
