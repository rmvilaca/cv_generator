class Api::SessionsController < Devise::SessionsController
  respond_to :json

  private

  def respond_with(resource, _opts = {})
    render json: {
      status: { code: 200, message: "Logged in successfully." },
      data: UserSerializer.new(resource).serializable_hash[:data][:attributes]
    }, status: :ok
  end

  def respond_to_on_destroy(*)
    # `current_user` is nil after a successful sign_out, since Warden has
    # cleared the user for the :user scope. If it's still set, sign_out
    # didn't take effect (e.g. no/invalid token reached this action).
    if current_user
      render json: {
        status: { code: 401, message: "Couldn't find an active session." }
      }, status: :unauthorized
    else
      render json: {
        status: { code: 200, message: "Logged out successfully." }
      }, status: :ok
    end
  end
end
