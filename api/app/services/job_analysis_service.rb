class JobAnalysisService
  Error = Class.new(StandardError)

  SYSTEM_PROMPT = <<~PROMPT.freeze
    You are an expert career coach. The user will provide a job posting.
    Analyze it and return a JSON object with EXACTLY this structure:

    {
      "company_name": "<extracted from posting>",
      "job_title":    "<extracted from posting>",
      "skills": [{ "<skill title>": ["detail 1", "detail 2"] }],
      "job":    [{ "<topic title>": ["detail 1", "detail 2"] }],
      "tech":   [{ "<technology>":  ["detail 1", "detail 2"] }]
    }

    Rules:
    - company_name and job_title: extract directly from the posting
    - skills: the 5 most important skills to highlight on a CV for this role
    - job: 5 job history topics/responsibilities the candidate should emphasize
    - tech: 5 tools and technologies most relevant to this role
    - Each array MUST have exactly 5 items
    - Each item is an object with one key (the real title) mapped to 2-4 detail strings
    - Respond in the same language as the job posting
    - Return ONLY valid JSON. No markdown, no commentary.
  PROMPT

  def initialize(raw_text)
    @raw_text = raw_text
  end

  def call
    client = OpenAI::Client.new(access_token: Rails.application.credentials.dig(:openai, :api_key))

    response = client.chat(parameters: {
      model:           "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: @raw_text }
      ],
      temperature: 0.3
    })

    content = response.dig("choices", 0, "message", "content")
    raise Error, "Empty response from OpenAI" unless content

    JSON.parse(content)
  rescue OpenAI::Error => e
    raise Error, "OpenAI request failed: #{e.message}"
  rescue JSON::ParserError => e
    raise Error, "Invalid JSON from OpenAI: #{e.message}"
  end
end
