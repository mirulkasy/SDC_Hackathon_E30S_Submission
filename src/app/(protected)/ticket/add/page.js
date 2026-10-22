"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./addTicket.module.css";
import AppBar from "@/components/layout/AppBar";
import CustomInput from "@/components/input/CustomInput";
import CustomSelect from "@/components/input/CustomSelect";
import { useAuth } from "@/context/AuthContext";
import { addTicket, TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/tickets";

const EMPTY_FORM = {
  title: "",
  category: "",
  priority: "medium",
  description: "",
};

const validate = (form) => {
  const errors = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.category) errors.category = "Pick a category.";
  if (!form.description.trim()) errors.description = "Description is required.";
  return errors;
};

export default function AddTicketPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const orgId = profile?.orgId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgId) {
      console.error("Organization ID is not loaded yet.");
      return;
    }

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const id = await addTicket({ orgId, user, ticket: form });
      router.push(`/ticket/${id}`);
      setForm(EMPTY_FORM);
      setErrors({});
      setSaving(false);
    } catch (err) {
      console.error("Add ticket failed:", err);
      setSaving(false);
    }
  };

  return (
    <main className={styles.addTicketPage}>
      <AppBar title="New Ticket" />

      <form className={styles.formSection} onSubmit={handleSubmit} noValidate>
        <h2>What happened?</h2>
        <p className={styles.hint}>
          Report a problem and the owner will review it here.
        </p>

        <div className={styles.formCard}>
          <CustomInput
            label="Title"
            name="title"
            value={form.title}
            onChange={handleChange}
            error={errors.title}
            placeholder="e.g. Duplicate salary entry in October"
          />

          <div className={styles.fieldGrid}>
            <CustomSelect
              label="Category"
              name="category"
              options={TICKET_CATEGORIES}
              value={form.category}
              onChange={handleChange}
              error={errors.category}
              placeholder="Select category"
            />
            <CustomSelect
              label="Priority"
              name="priority"
              options={TICKET_PRIORITIES}
              value={form.priority}
              onChange={handleChange}
            />
          </div>

          <CustomInput
            label="Description"
            name="description"
            longInput
            value={form.description}
            onChange={handleChange}
            error={errors.description}
            placeholder="Describe the problem — what you expected, what actually happened, dates and amounts if relevant."
          />
        </div>

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={saving || !orgId}
        >
          {!orgId ? "Loading..." : saving ? "Submitting..." : "Submit Ticket"}
        </button>
      </form>
    </main>
  );
}
