class JobPostingSerializer
  include JSONAPI::Serializer

  attributes :id, :raw_text, :url, :company_name, :job_title,
             :analysis, :analysis_status, :created_at
end
