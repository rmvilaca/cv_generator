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

ActiveRecord::Schema[8.1].define(version: 2026_04_14_045929) do
  create_table "cv_generations", force: :cascade do |t|
    t.text "content"
    t.datetime "created_at", null: false
    t.integer "job_posting_id", null: false
    t.string "status", default: "pending", null: false
    t.integer "tokens_used", default: 0, null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["job_posting_id"], name: "index_cv_generations_on_job_posting_id"
    t.index ["user_id"], name: "index_cv_generations_on_user_id"
  end

  create_table "education_entries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "degree", null: false
    t.text "description"
    t.string "end_year"
    t.string "field_of_study"
    t.string "institution", null: false
    t.integer "position", default: 0, null: false
    t.text "skills", default: "[]", null: false
    t.string "start_year"
    t.datetime "updated_at", null: false
    t.integer "user_profile_id", null: false
    t.index ["user_profile_id"], name: "index_education_entries_on_user_profile_id"
  end

  create_table "job_postings", force: :cascade do |t|
    t.text "analysis"
    t.string "analysis_status", default: "pending", null: false
    t.string "company_name"
    t.datetime "created_at", null: false
    t.string "job_title"
    t.text "raw_text", null: false
    t.datetime "updated_at", null: false
    t.string "url"
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_job_postings_on_user_id"
  end

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

  create_table "user_profiles", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email"
    t.string "full_name", null: false
    t.string "location"
    t.string "phone"
    t.text "skills", default: "[]", null: false
    t.text "summary"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["user_id"], name: "index_user_profiles_on_user_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.integer "free_generations_used", default: 0, null: false
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.integer "token_balance", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  create_table "work_experiences", force: :cascade do |t|
    t.text "bullet_points", default: "[]", null: false
    t.string "company", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "end_date"
    t.string "location"
    t.integer "position", default: 0, null: false
    t.text "skills", default: "[]", null: false
    t.string "start_date", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.integer "user_profile_id", null: false
    t.index ["user_profile_id"], name: "index_work_experiences_on_user_profile_id"
  end

  add_foreign_key "cv_generations", "job_postings"
  add_foreign_key "cv_generations", "users"
  add_foreign_key "education_entries", "user_profiles"
  add_foreign_key "job_postings", "users"
  add_foreign_key "token_purchases", "users"
  add_foreign_key "user_profiles", "users"
  add_foreign_key "work_experiences", "user_profiles"
end
