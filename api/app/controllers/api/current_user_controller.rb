class Api::CurrentUserController < ApplicationController
  before_action :authenticate_user!

  def show
    render json: {
      status: { code: 200, message: "User found." },
      data: UserSerializer.new(current_user).serializable_hash[:data][:attributes]
    }, status: :ok
  end
end
