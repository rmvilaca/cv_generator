class StripeCheckoutSessionService
  TOKEN_PRICE_CENTS = 100  # 1 token = €1.00 = 100 cents

  def initialize(user:, token_amount:, success_url:, cancel_url:)
    @user          = user
    @token_amount  = token_amount
    @amount_cents  = token_amount * TOKEN_PRICE_CENTS
    @success_url   = success_url
    @cancel_url    = cancel_url
  end

  def call
    session = Stripe::Checkout::Session.create(
      payment_method_types: [ "card" ],
      mode: "payment",
      client_reference_id: @user.id.to_s,
      customer_email: @user.email,
      line_items: [ {
        price_data: {
          currency: "eur",
          unit_amount: TOKEN_PRICE_CENTS,
          product_data: { name: "Token" }
        },
        quantity: @token_amount
      } ],
      metadata: {
        user_id: @user.id.to_s,
        token_amount: @token_amount.to_s
      },
      success_url: @success_url,
      cancel_url: @cancel_url
    )

    TokenPurchase.create!(
      user: @user,
      stripe_session_id: session.id,
      amount_cents: @amount_cents,
      token_amount: @token_amount,
      status: "pending"
    )

    session
  end
end
