class Api::CheckoutSessionsController < ApplicationController
  before_action :authenticate_user!

  def create
    token_amount = params.require(:token_amount).to_i

    if token_amount <= 0
      return render json: { error: "token_amount must be positive" }, status: :unprocessable_entity
    end

    session = StripeCheckoutSessionService.new(
      user: current_user,
      token_amount: token_amount,
      # TODO: Replace with frontend URLs
      success_url: params[:success_url] || "http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:  params[:cancel_url]  || "http://localhost:3000/checkout/cancel"
    ).call

    render json: { checkout_url: session.url, session_id: session.id }, status: :created
  end
end
