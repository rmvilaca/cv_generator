class CvGenerationSerializer
  include JSONAPI::Serializer

  attributes :id, :content, :status, :tokens_used, :created_at
end
