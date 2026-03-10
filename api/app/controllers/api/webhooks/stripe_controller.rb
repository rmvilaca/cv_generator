class Api::Webhooks::StripeController < ApplicationController
  # Skip Devise auth — Stripe calls this endpoint, not a logged-in user
  skip_before_action :verify_authenticity_token, raise: false

  def create
    payload   = request.body.read
    sig       = request.env["HTTP_STRIPE_SIGNATURE"]
    endpoint_secret = Rails.application.credentials.dig(:stripe, :webhook_secret)

    begin
      event = Stripe::Webhook.construct_event(payload, sig, endpoint_secret)
    rescue JSON::ParserError
      return head :bad_request
    rescue Stripe::SignatureVerificationError
      return head :bad_request
    end

    case event.type
    when "checkout.session.completed"
      handle_checkout_completed(event.data.object)
    when "checkout.session.expired"
      handle_checkout_expired(event.data.object)
    else
      Rails.logger.info("Unhandled Stripe event: #{event.type}")
    end

    head :ok
  end

  private

  def handle_checkout_completed(session)
    TokenFulfillmentService.new(stripe_session_id: session.id).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error("TokenPurchase not found for session #{session.id}: #{e.message}")
  end

  def handle_checkout_expired(session)
    purchase = TokenPurchase.find_by(stripe_session_id: session.id)
    purchase&.update!(status: "failed")
  end
end
