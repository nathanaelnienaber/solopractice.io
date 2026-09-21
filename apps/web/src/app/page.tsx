export default function Home() {
  return (
    <div className="space-y-8">
      <div className="card text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to solopractice</h2>
        <p className="text-gray-600 mb-6">
          Your secure client portal for managing consents, appointments, and payments.
        </p>
        <p className="text-sm text-gray-500">
          If you received a link from your therapist, please use that link to access your
          personalized portal.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <FeatureCard
          title="E-Sign Consents"
          description="Complete required consent forms securely online before your first session."
          icon="📝"
        />
        <FeatureCard
          title="View Appointments"
          description="See your upcoming sessions and receive reminders."
          icon="📅"
        />
        <FeatureCard
          title="Pay Invoices"
          description="Securely pay for sessions with card or bank transfer."
          icon="💳"
        />
      </div>

      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Your Privacy</h3>
        <p className="text-sm text-blue-800">
          This portal handles only scheduling, consents, and billing. Your session notes,
          recordings, and clinical information are stored exclusively on your therapist&apos;s
          local device and are never uploaded to the web.
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="card text-center">
      <span className="text-4xl mb-4 block">{icon}</span>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
