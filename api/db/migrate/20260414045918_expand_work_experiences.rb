class ExpandWorkExperiences < ActiveRecord::Migration[8.1]
  def change
    add_column :work_experiences, :description, :text
    add_column :work_experiences, :location, :string
    add_column :work_experiences, :skills, :text, default: "[]", null: false
  end
end
