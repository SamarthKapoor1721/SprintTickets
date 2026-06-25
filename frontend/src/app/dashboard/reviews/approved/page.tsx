import ReviewList from "@/components/review-list"

export default function ApprovedReviewsPage() {
  return (
    <ReviewList
      title="Approved"
      description="Reviews that have been approved by the CEO."
      status="approved"
    />
  )
}
