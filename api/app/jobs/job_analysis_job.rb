class JobAnalysisJob < ApplicationJob
  queue_as :default

  def perform(job_posting_id)
    posting = JobPosting.find(job_posting_id)
    posting.update!(analysis_status: "processing")

    analysis = JobAnalysisService.new(posting.raw_text).call

    posting.update!(
      analysis:        analysis,
      analysis_status: "completed",
      company_name:    analysis["company_name"],
      job_title:       analysis["job_title"]
    )
  rescue JobAnalysisService::Error => e
    Rails.logger.error("JobAnalysisJob failed for posting #{job_posting_id}: #{e.message}")
    posting&.update!(analysis_status: "failed")
  end
end
