class CreateJobPostings < ActiveRecord::Migration[8.1]
  def change
    create_table :job_postings do |t|
      t.references :user, null: false, foreign_key: true
      t.text   :raw_text,        null: false
      t.string :url
      t.string :company_name
      t.string :job_title
      t.text   :analysis
      t.string :analysis_status, default: "pending", null: false
      t.timestamps
    end
  end
end
