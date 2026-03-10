class TokenFulfillmentService
  def initialize(stripe_session_id:)
    @stripe_session_id = stripe_session_id
  end

  def call
    purchase = TokenPurchase.find_by!(stripe_session_id: @stripe_session_id)

    return if purchase.status == "completed"   # Idempotency guard

    ActiveRecord::Base.transaction do
      purchase.update!(status: "completed")
      purchase.user.increment!(:token_balance, purchase.token_amount)
    end

    purchase
  end
end
