import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page:     { padding: 40, fontFamily: "Helvetica", fontSize: 11, color: "#1a1a1a" },
  name:     { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  contact:  { color: "#444", marginBottom: 6 },
  divider:  { borderBottom: "1px solid #d0d0d0", marginBottom: 8 },
  section:  { marginTop: 16 },
  heading:  { fontSize: 13, fontWeight: "bold", borderBottom: "1px solid #ccc",
               paddingBottom: 2, marginBottom: 6 },
  expTitle: { fontWeight: "bold" },
  expMeta:  { color: "#555", marginBottom: 3 },
  bullet:   { marginLeft: 12, marginBottom: 2 },
  skill:    { marginRight: 8 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
});

export default function CvDocument({
  content,
  profileName,
  profileEmail,
  profilePhone,
  profileLocation,
}) {
  const { summary, experience = [], skills = [], education = [] } = content;
  const contacts = [profilePhone, profileEmail, profileLocation].filter(Boolean).join(" | ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{profileName}</Text>
        {contacts && <Text style={styles.contact}>{contacts}</Text>}
        <View style={styles.divider} />

        {summary && (
          <View style={styles.section}>
            <Text style={styles.heading}>Summary</Text>
            <Text>{summary}</Text>
          </View>
        )}

        {experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Experience</Text>
            {experience.map((exp, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={styles.expTitle}>{exp.title} — {exp.company}</Text>
                <Text style={styles.expMeta}>{exp.period}</Text>
                {(exp.bullets ?? []).map((b, j) => (
                  <Text key={j} style={styles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Skills</Text>
            <View style={styles.skillRow}>
              {skills.map((s, i) => <Text key={i} style={styles.skill}>{s}</Text>)}
            </View>
          </View>
        )}

        {education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Education</Text>
            {education.map((edu, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={styles.expTitle}>{edu.degree} — {edu.institution}</Text>
                {edu.year && <Text style={styles.expMeta}>{edu.year}</Text>}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
