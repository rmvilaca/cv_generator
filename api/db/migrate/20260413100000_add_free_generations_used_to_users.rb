class AddFreeGenerationsUsedToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :free_generations_used, :integer, default: 0, null: false
  end
end
