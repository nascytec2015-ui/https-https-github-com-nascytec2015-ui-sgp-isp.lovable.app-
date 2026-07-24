import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/projetista-ftth')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/projetista-ftth"!</div>
}
