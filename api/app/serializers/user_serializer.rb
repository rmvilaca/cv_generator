class UserSerializer
  include JSONAPI::Serializer

  attributes :id, :email, :token_balance, :created_at
end
