class ExpandEducationEntries < ActiveRecord::Migration[8.1]
  def change
    add_column :education_entries, :field_of_study, :string
    add_column :education_entries, :start_year, :string
    add_column :education_entries, :end_year, :string
    add_column :education_entries, :description, :text
    add_column :education_entries, :skills, :text, default: "[]", null: false
    remove_column :education_entries, :year, :string
  end
end
