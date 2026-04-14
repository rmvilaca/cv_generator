class UserProfileSerializer
  include JSONAPI::Serializer

  attributes :id, :full_name, :email, :phone, :location, :summary, :skills

  attribute :work_experiences do |profile|
    profile.work_experiences.map do |exp|
      {
        id:            exp.id,
        company:       exp.company,
        title:         exp.title,
        start_date:    exp.start_date,
        end_date:      exp.end_date,
        description:   exp.description,
        location:      exp.location,
        bullet_points: exp.bullet_points,
        skills:        exp.skills,
        position:      exp.position
      }
    end
  end

  attribute :education_entries do |profile|
    profile.education_entries.map do |edu|
      {
        id:             edu.id,
        institution:    edu.institution,
        degree:         edu.degree,
        field_of_study: edu.field_of_study,
        start_year:     edu.start_year,
        end_year:       edu.end_year,
        description:    edu.description,
        skills:         edu.skills,
        position:       edu.position
      }
    end
  end
end
