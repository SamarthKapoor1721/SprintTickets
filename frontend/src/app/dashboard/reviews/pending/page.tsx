import ReviewList from "@/components/review-list"

export default function PendingReviewsPage() {
  return (
    <ReviewList
      title="Pending Reviews"
      description="Submissions awaiting executive approval."
      status="pending"
    />
  )
}
