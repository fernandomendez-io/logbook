"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CARRIERS } from "@/lib/data/carriers";

export interface ProfileInitialValues {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  seat: string;
  base: string;
  operatingCarrier: string;
}

export default function ProfileEditForm({
  initial,
}: {
  initial: ProfileInitialValues;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [employeeNumber, setEmployeeNumber] = useState(initial.employeeNumber);
  const [seat, setSeat] = useState(initial.seat);
  const [base, setBase] = useState(initial.base);
  const [operatingCarrier, setOperatingCarrier] = useState(
    initial.operatingCarrier,
  );

  const selectedCarrier = CARRIERS.find((c) => c.value === operatingCarrier);

  function handleCarrierChange(val: string) {
    setOperatingCarrier(val);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);

    const carrier = CARRIERS.find((c) => c.value === operatingCarrier);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        employeeNumber,
        seat: seat || null,
        base: base.toUpperCase() || null,
        operatingCarrier: operatingCarrier || null,
        flightPrefix: carrier?.flightPrefix ?? null,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.profile) {
      setSuccess(true);
      router.refresh();
    } else {
      setError(data.error || "Save failed");
    }
  }

  const carrierOptions = CARRIERS.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
      </CardHeader>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <Input
          label="Employee #"
          value={employeeNumber}
          onChange={(e) => setEmployeeNumber(e.target.value)}
          placeholder="12345"
        />
        <Select
          label="Seat"
          value={seat}
          onChange={(e) => setSeat(e.target.value)}
          placeholder="Select"
          options={[
            { value: "CA", label: "Captain (CA)" },
            { value: "FO", label: "First Officer (FO)" },
          ]}
        />
        <Input
          label="Base"
          value={base}
          onChange={(e) => setBase(e.target.value.toUpperCase())}
          placeholder="DFW"
          maxLength={3}
        />
      </div>

      <div className="mt-4">
        <Select
          label="Airline / Operating Carrier"
          value={operatingCarrier}
          onChange={(e) => handleCarrierChange(e.target.value)}
          placeholder="Select your airline"
          options={carrierOptions}
        />
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {success && (
        <p className="mt-4 text-sm text-green-primary">Profile saved.</p>
      )}

      <div className="mt-6">
        <Button onClick={handleSave} loading={saving}>
          Save Changes
        </Button>
      </div>
    </Card>
  );
}
