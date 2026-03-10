class CustomDeviseFailure < Devise::FailureApp
  def respond
    json_api_error_response
  end

  def json_api_error_response
    self.status = 401
    self.content_type = "application/json"
    self.response_body = { status: { code: 401, message: error_message } }.to_json
  end

  private

  def error_message
    msg = i18n_message
    if msg.include?("revoked") || msg.include?("segment") || msg.include?("expired") || msg.include?("decode")
      "Invalid or expired token."
    else
      msg
    end
  end
end
