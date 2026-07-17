import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateFund } from "../hooks/funds";
import { useT } from "../i18n";
import { Button, Card, ErrorNote, Field } from "../components/ui";

const CURRENCIES = ["SAR", "USD", "EUR", "GBP", "AED", "KWD", "BHD", "QAR", "EGP"];

export default function NewFund() {
  const { t } = useT();
  const navigate = useNavigate();
  const createFund = useCreateFund();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("SAR");

  function submit(e: FormEvent) {
    e.preventDefault();
    createFund.mutate(
      { name: name.trim(), description: description.trim(), currency },
      { onSuccess: (fund) => navigate(`/funds/${fund.id}`, { replace: true }) }
    );
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">{t.createFundTitle}</h2>
      <form onSubmit={submit} className="space-y-4">
        <Field
          label={t.fundName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          autoFocus
        />
        <Field
          label={t.fundDesc}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">{t.currency}</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-xl border border-line bg-paper/70 px-3.5 py-2.5 text-ink focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/40"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <ErrorNote>{createFund.error?.message}</ErrorNote>
        <div className="flex gap-2">
          <Button type="submit" disabled={createFund.isPending} className="flex-1">
            {t.create}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
