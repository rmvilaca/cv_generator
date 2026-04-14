class UserSerializer
  include JSONAPI::Serializer

  attributes :id, :email, :token_balance, :free_generations_used, :created_at
end
