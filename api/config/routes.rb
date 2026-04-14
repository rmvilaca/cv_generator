Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  scope :api, defaults: { format: :json } do
    devise_for :users,
      path: "",
      path_names: { sign_in: "login", sign_out: "logout", registration: "signup" },
      controllers: { sessions: "api/sessions", registrations: "api/registrations" }
  end

  namespace :api do
    get  "health",   to: proc { [ 200, { "Content-Type" => "application/json" }, [ '{"status":"ok"}' ] ] }
    get  "me",       to: "current_user#show"
    post "checkout", to: "checkout_sessions#create"

    namespace :webhooks do
      post "stripe", to: "stripe#create"
    end

    resource  :profile,      only: [ :show, :update ], controller: "profiles"
    resources :job_postings, only: [ :index, :show, :create, :destroy ] do
      resources :cv_generations, only: [ :index, :show, :create ]
    end
  end
end
