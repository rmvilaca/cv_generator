class ApplicationController < ActionController::API
  before_action :configure_permitted_parameters, if: :devise_controller?
  before_action :require_jwt_authorization, unless: :devise_controller?

  private

  # JWT-only API: if no Bearer token is present, discard any session-stored user
  # so that authenticate_user! cannot fall back to session-based authentication.
  def require_jwt_authorization
    warden.logout(:user) unless request.headers["Authorization"].present?
  end

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: %i[email password password_confirmation])
    devise_parameter_sanitizer.permit(:account_update, keys: %i[email password password_confirmation current_password])
  end
end
