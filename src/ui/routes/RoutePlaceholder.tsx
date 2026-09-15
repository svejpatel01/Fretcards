interface RoutePlaceholderProps {
  title: string
  description: string
}

export function RoutePlaceholder({ title, description }: RoutePlaceholderProps) {
  return (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}
