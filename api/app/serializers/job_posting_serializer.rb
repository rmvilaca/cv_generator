class JobPostingSerializer
  include JSONAPI::Serializer

  attributes :id, :raw_text, :url, :company_name, :job_title,
             :analysis, :analysis_status, :created_at

  attribute :latest_cv_generation do |posting|
    cv = posting.latest_cv_generation
    CvGenerationSerializer.new(cv).serializable_hash.dig(:data, :attributes) if cv
  end
end
