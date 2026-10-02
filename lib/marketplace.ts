export type PostStatus = "pending" | "approved" | "rejected";

export type TuitionPost = {
  id: string;
  title: string;
  classLevel: string;
  subject: string;
  numberOfStudents: "1" | "2" | "Group";
  preferredTeacherGender: "Male" | "Female" | "Any";
  daysPerWeek: number;
  preferredTime: string;
  salaryMin: number;
  salaryMax: number;
  district: string;
  area: string;
  tuitionType: "Home" | "Online";
  studentGender: "Male" | "Female";
  description: string;
  contactNumber?: string;
  createdBy: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
};

export function formatTuitionBudget(minimum: unknown, maximum: unknown) {
  const format = (value: unknown) => typeof value === "number" && Number.isFinite(value)
    ? `৳${value.toLocaleString()}`
    : null;
  const min = format(minimum);
  const max = format(maximum);

  if (min && max) return `${min}–${max} / month`;
  if (min) return `From ${min} / month`;
  if (max) return `Up to ${max} / month`;
  return "Budget not specified";
}

export const classLevels = [
  "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
  "Class 11", "Class 12", "Admission", "University", "Other",
];

export const tuitionSubjects = [
  "ICT", "Mathematics", "English", "Physics", "Chemistry", "Biology",
  "Bangla", "Accounting", "Quran", "Other",
];

export const districts = [
  "Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet",
  "Rangpur", "Mymensingh", "Cumilla", "Gazipur", "Narayanganj", "Other",
];