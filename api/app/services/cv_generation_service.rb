class CvGenerationService
  Error = Class.new(StandardError)

  SYSTEM_PROMPT = <<~PROMPT.freeze
    You are an expert CV writer. Given a candidate's structured profile and a job posting, generate a tailored CV.

    Return a JSON object with EXACTLY this structure:
    {
      "summary": "<2-3 sentence professional summary tailored to the role>",
      "experience": [
        {
          "company": "<company name>",
          "title":   "<job title>",
          "period":  "<start> – <end or Present>",
          "bullets": ["<achievement or responsibility tailored to the job posting>"]
        }
      ],
      "skills":    ["<skill 1>", "<skill 2>"],
      "education": [
        { "institution": "<name>", "degree": "<degree>", "field_of_study": "<field>", "year": "<start> – <end>" }
      ]
    }

    Rules:
    - Tailor bullet points to emphasize experience most relevant to the job posting
    - Reorder skills to prioritize those mentioned in the job posting
    - Keep language professional and achievement-focused
    - Respond in the same language as the job posting
    - Return ONLY valid JSON. No markdown, no commentary.
  PROMPT

  def initialize(user:, job_posting:)
    @user        = user
    @job_posting = job_posting
  end

  def call
    raise Error, "Job analysis not ready yet" unless @job_posting.analysis_status == "completed"

    profile = @user.user_profile
    raise Error, "Profile not found — please complete your profile first" unless profile

    client = OpenAI::Client.new(access_token: Rails.application.credentials.dig(:openai, :api_key))

    response = client.chat(parameters: {
      model:           "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: build_user_message(profile) }
      ],
      temperature: 0.4
    })

    content = response.dig("choices", 0, "message", "content")
    raise Error, "Empty response from OpenAI" unless content

    JSON.parse(content)
  rescue OpenAI::Error => e
    raise Error, "OpenAI request failed: #{e.message}"
  rescue JSON::ParserError => e
    raise Error, "Invalid JSON from OpenAI: #{e.message}"
  end

  private

  def build_user_message(profile)
    <<~MSG
      ## Candidate Profile

      Name:     #{profile.full_name}
      Location: #{profile.location}
      Summary:  #{profile.summary}
      Skills:   #{profile.skills.join(", ")}

      ### Work Experience
      #{format_work_experience(profile)}

      ### Education
      #{format_education(profile)}

      ---

      ## Job Posting (Full Text)
      #{@job_posting.raw_text}

      ---

      ## Job Posting Analysis
      #{JSON.pretty_generate(@job_posting.analysis)}
    MSG
  end

  def format_work_experience(profile)
    profile.work_experiences.map do |exp|
      period  = exp.end_date.present? ? "#{exp.start_date} – #{exp.end_date}" : "#{exp.start_date} – Present"
      lines = []
      lines << "#{exp.title} at #{exp.company} (#{period})"
      lines << "Location: #{exp.location}" if exp.location.present?
      lines << exp.description if exp.description.present?
      lines << "Skills: #{exp.skills.join(", ")}" if exp.skills.present?
      bullets = exp.bullet_points.map { |b| "  - #{b}" }.join("\n")
      lines << bullets if bullets.present?
      lines.join("\n")
    end.join("\n\n")
  end

  def format_education(profile)
    profile.education_entries.map do |edu|
      period = [ edu.start_year, edu.end_year ].compact.join(" – ")
      lines = []
      lines << "#{edu.degree} — #{edu.institution}"
      lines << "Field of study: #{edu.field_of_study}" if edu.field_of_study.present?
      lines << "(#{period})" if period.present?
      lines << edu.description if edu.description.present?
      lines << "Skills: #{edu.skills.join(", ")}" if edu.skills.present?
      lines.join("\n")
    end.join("\n\n")
  end
end
