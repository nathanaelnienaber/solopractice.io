"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActionStack,
  touchStackActionClassName,
} from "@/components/ui/page";

export interface PracticeInfo {
  firstName: string;
  lastName: string;
  credentials: string;
  licenseState: string;
  practiceName: string | null;
  email: string;
}

interface PracticeInfoPanelProps {
  initial: PracticeInfo;
}

export function PracticeInfoPanel({ initial }: PracticeInfoPanelProps) {
  const router = useRouter();
  const [info, setInfo] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [credentials, setCredentials] = useState(initial.credentials);
  const [licenseState, setLicenseState] = useState(initial.licenseState);
  const [practiceName, setPracticeName] = useState(initial.practiceName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setFirstName(info.firstName);
    setLastName(info.lastName);
    setCredentials(info.credentials);
    setLicenseState(info.licenseState);
    setPracticeName(info.practiceName ?? "");
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setError(null);
    setEditing(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/therapist/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          credentials,
          licenseState,
          practiceName: practiceName.trim() || null,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        therapist?: PracticeInfo;
      };

      if (!res.ok || !data.therapist) {
        throw new Error(data.error || "Failed to save practice information");
      }

      setInfo({
        firstName: data.therapist.firstName,
        lastName: data.therapist.lastName,
        credentials: data.therapist.credentials,
        licenseState: data.therapist.licenseState,
        practiceName: data.therapist.practiceName,
        email: info.email,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">
              {info.firstName} {info.lastName}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Credentials</p>
            <p className="font-medium">{info.credentials}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">License State</p>
            <p className="font-medium">{info.licenseState}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Practice Name</p>
            <p className="font-medium">
              {info.practiceName?.trim() || (
                <span className="text-muted-foreground font-normal">
                  Not set
                </span>
              )}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{info.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Email is your sign-in identity and cannot be changed here.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className={touchStackActionClassName}
          onClick={startEditing}
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          name="firstName"
          label="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoComplete="given-name"
        />
        <Input
          name="lastName"
          label="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          autoComplete="family-name"
        />
        <Input
          name="credentials"
          label="Credentials"
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          placeholder="LMHC, LCSW, …"
          required
        />
        <Input
          name="licenseState"
          label="License state"
          value={licenseState}
          onChange={(e) =>
            setLicenseState(e.target.value.toUpperCase().slice(0, 2))
          }
          placeholder="FL"
          maxLength={2}
          pattern="[A-Za-z]{2}"
          title="2-letter state code"
          required
          autoComplete="address-level1"
        />
        <div className="sm:col-span-2">
          <Input
            name="practiceName"
            label="Practice name"
            value={practiceName}
            onChange={(e) => setPracticeName(e.target.value)}
            placeholder="Your Practice Name"
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            name="email"
            label="Email"
            value={info.email}
            disabled
            readOnly
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Email is your sign-in identity and cannot be changed here.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ActionStack className="flex-col-reverse sm:flex-row">
        <Button
          type="submit"
          loading={saving}
          className={touchStackActionClassName}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={cancelEditing}
          disabled={saving}
          className={touchStackActionClassName}
        >
          Cancel
        </Button>
      </ActionStack>
    </form>
  );
}
