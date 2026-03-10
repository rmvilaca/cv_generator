# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_14_190935) do
  create_table "jwt_denylists", force: :cascade do |t|
    t.datetime "exp", null: false
    t.string "jti", null: false
    t.index ["jti"], name: "index_jwt_denylists_on_jti", unique: true
  end

  create_table "token_purchases", force: :cascade do |t|
    t.integer "amount_cents", null: false
    t.datetime "created_at", null: false
    t.string "status", default: "pending", null: false
    t.string "stripe_session_id", null: false
    t.integer "token_amount", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["stripe_session_id"], name: "index_token_purchases_on_stripe_session_id", unique: true
    t.index ["user_id"], name: "index_token_purchases_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.integer "token_balance", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "token_purchases", "users"
end
