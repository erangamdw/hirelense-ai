import { RegisterForm } from "@/components/auth/register-form";

export default function RecruiterRegisterPage() {
  return (
    <RegisterForm
      title="Create recruiter account"
      description="Use the recruiter workflow to create jobs, upload scoped candidate evidence, and generate structured reports."
      initialRole="recruiter"
      lockRole
      submitLabel="Create recruiter account"
    />
  );
}
