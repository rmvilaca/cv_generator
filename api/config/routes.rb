Rails.application.routes.draw do
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # API routes
  scope :api, defaults: { format: :json } do
    devise_for :users,
      path: "",
      path_names: {
        sign_in: "login",
        sign_out: "logout",
        registration: "signup"
      },
      controllers: {
        sessions: "api/sessions",
        registrations: "api/registrations"
      }
  end

  namespace :api do
    # Health endpoint
    get "health", to: proc { [ 200, { "Content-Type" => "application/json" }, [ '{"status":"ok"}' ] ] }

    # Current user
    get "me", to: "current_user#show"

    # Stripe checkout
    post "checkout", to: "checkout_sessions#create"

    # Stripe webhook
    namespace :webhooks do
      post "stripe", to: "stripe#create"
    end
  end
end
