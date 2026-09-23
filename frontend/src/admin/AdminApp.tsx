import {
  FormEvent,
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/site";
import {
  deleteResource,
  getMe,
  getResource,
  getSummary,
  login,
  logout,
  patchResource,
  postResource,
  uploadContentImage,
  type AdminContext,
} from "./api";

type ResourceKey =
  | "members"
  | "volunteers"
  | "programs"
  | "events"
  | "news"
  | "blood-requests"
  | "emergencies"
  | "contact-messages"
  | "donations"
  | "admins"
  | "audit-logs";

const navItems: {
  key: ResourceKey | "dashboard";
  label: string;
  path: string;
  superOnly?: boolean;
}[] = [
  { key: "dashboard", label: "Dashboard", path: "/admin" },
  { key: "members", label: "Members", path: "/admin/members" },
  { key: "volunteers", label: "Volunteers", path: "/admin/volunteers" },
  { key: "programs", label: "Programs", path: "/admin/programs" },
  { key: "events", label: "Events", path: "/admin/events" },
  { key: "news", label: "News", path: "/admin/news" },
  {
    key: "blood-requests",
    label: "Blood requests",
    path: "/admin/blood-requests",
  },
  {
    key: "emergencies",
    label: "Emergencies",
    path: "/admin/emergencies",
  },
  {
    key: "contact-messages",
    label: "Contact messages",
    path: "/admin/contact-messages",
  },
  { key: "donations", label: "Donations", path: "/admin/donations" },
  {
    key: "admins",
    label: "Admin management",
    path: "/admin/admins",
    superOnly: true,
  },
  {
    key: "audit-logs",
    label: "Audit logs",
    path: "/admin/audit-logs",
    superOnly: true,
  },
];

const statusOptions: Record<string, string[]> = {
  members: ["pending", "approved", "rejected", "inactive"],
  volunteers: ["pending", "approved", "rejected", "inactive"],
  "blood-requests": [
    "open",
    "matched",
    "fulfilled",
    "cancelled",
    "expired",
  ],
  emergencies: [
    "open",
    "acknowledged",
    "in_progress",
    "resolved",
    "closed",
  ],
  "contact-messages": ["new", "in_progress", "resolved", "spam"],
  donations: ["pending", "succeeded", "failed", "refunded", "cancelled"],
};

const contentResources: ResourceKey[] = ["programs", "events", "news"];

const contentStatusOptions: Record<string, string[]> = {
  programs: ["draft", "published", "archived"],
  events: ["draft", "published", "cancelled", "completed", "archived"],
  news: ["draft", "published", "archived"],
};

const programCategories = [
  "blood_donation",
  "disaster_relief",
  "health_first_aid",
  "community_welfare",
  "youth_activities",
];

function isContentResource(resource: ResourceKey) {
  return contentResources.includes(resource);
}

export function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();

  const [context, setContext] = useState<AdminContext | null>(null);
  const [loading, setLoading] = useState(
    location.pathname !== "/admin/login",
  );

  useEffect(() => {
    if (location.pathname === "/admin/login") {
      setLoading(false);
      return;
    }

    getMe()
      .then(setContext)
      .catch(() => navigate("/admin/login", { replace: true }))
      .finally(() => setLoading(false));
  }, [location.pathname, navigate]);

  if (location.pathname === "/admin/login") {
    return (
      <LoginPage
        onLogin={(next) => {
          setContext(next);
          navigate("/admin", { replace: true });
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="shell py-20">
        <LoadingState />
      </div>
    );
  }

  if (!context) return null;

  return (
    <AdminShell
      context={context}
      onLogout={() => {
        void logout().finally(() =>
          navigate("/admin/login", { replace: true }),
        );
      }}
    >
      <AdminContent context={context} />
    </AdminShell>
  );
}

function LoginPage({
  onLogin,
}: {
  onLogin: (context: AdminContext) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      onLogin(await login(email, password));
    } catch {
      setError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--light)]">
      <div className="mx-auto max-w-md px-6 py-20">
        <div className="border border-[var(--border)] bg-white p-7 sm:p-9">
          <p className="eyebrow">IRCS-NIET administration</p>

          <h1 className="mt-3 text-4xl font-semibold text-[var(--dark)]">
            Sign in
          </h1>

          <p className="mt-4 text-sm leading-6 text-[var(--grey)]">
            Authorized administrators only.
          </p>

          <form onSubmit={submit} className="mt-8 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold">
              Email

              <input
                className="field"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Password

              <input
                className="field"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button
              className="button button-primary mt-2 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>

            {error && (
              <div
                role="alert"
                className="border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              >
                {error}
              </div>
            )}
          </form>

          <Link
            to="/"
            className="mt-6 inline-block text-sm font-semibold text-[var(--crimson)]"
          >
            Return to website
          </Link>
        </div>
      </div>
    </main>
  );
}

function AdminShell({
  context,
  onLogout,
  children,
}: {
  context: AdminContext;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--light)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="shell flex min-h-20 items-center justify-between gap-4">
          <div>
            <p className="eyebrow">IRCS-NIET administration</p>

            <p className="text-sm font-semibold text-[var(--dark)]">
              {context.email}{" "}
              <span className="font-normal text-[var(--grey)]">
                ({context.role})
              </span>
            </p>
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <div className="shell grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="border border-[var(--border)] bg-white p-3">
          <nav
            className="grid gap-1"
            aria-label="Admin navigation"
          >
            {navItems
              .filter(
                (item) =>
                  !item.superOnly ||
                  context.role === "super_admin",
              )
              .map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="px-3 py-2 text-sm font-semibold text-[var(--dark)] hover:bg-[var(--light)]"
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}

function AdminContent({
  context,
}: {
  context: AdminContext;
}) {
  const path = useLocation().pathname;

  if (path === "/admin" || path === "/admin/") {
    return <Dashboard />;
  }

  const key = path.split("/")[2] as ResourceKey;

  return <ResourcePage resource={key} context={context} />;
}

function Dashboard() {
  const [summary, setSummary] =
    useState<Record<string, number> | null>(null);

  const [error, setError] = useState(false);

  useEffect(() => {
    getSummary()
      .then(setSummary)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <ErrorState
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!summary) {
    return <LoadingState />;
  }

  const cards = [
    ["pending_members", "Pending members"],
    ["pending_volunteers", "Pending volunteers"],
    ["pending_blood_requests", "Open blood requests"],
    ["open_emergencies", "Open emergencies"],
    ["new_contact_messages", "New contact messages"],
    ["pending_donations", "Donation intents to review"],
  ];

  return (
    <section>
      <p className="eyebrow">Overview</p>

      <h1 className="mt-2 text-4xl font-semibold text-[var(--dark)]">
        Dashboard
      </h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([key, label]) => (
          <div
            key={key}
            className="border border-[var(--border)] bg-white p-6"
          >
            <strong className="block text-4xl font-semibold text-[var(--dark)]">
              {summary[key] ?? 0}
            </strong>

            <span className="mt-2 block text-sm text-[var(--grey)]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResourcePage({
  resource,
  context,
}: {
  resource: ResourceKey;
  context: AdminContext;
}) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState<Record<string, unknown> | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);

    const endpoint =
      resource === "audit-logs"
        ? "/api/admin/audit-logs"
        : `/api/admin/${resource}`;

    getResource(endpoint)
      .then((result) => setItems(result.items))
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load records.",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [resource]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState onRetry={load} />;
  }

  const title =
    navItems.find((item) => item.key === resource)?.label ??
    resource;

  const canManageContent = isContentResource(resource);

  function openCreate() {
    setEditingItem(null);
    setEditorOpen(true);
  }

  function openEdit(item: Record<string, unknown>) {
    setEditingItem(item);
    setEditorOpen(true);
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Management</p>

          <h1 className="mt-2 text-4xl font-semibold text-[var(--dark)]">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--grey)]">
            {items.length} shown
          </span>

          {canManageContent && (
            <button
              type="button"
              className="button button-primary"
              onClick={openCreate}
            >
              + Add{" "}
              {resource === "programs"
                ? "program"
                : resource === "events"
                  ? "event"
                  : "news"}
            </button>
          )}
        </div>
      </div>

      {editorOpen && canManageContent && (
        <ContentEditor
          resource={
            resource as "programs" | "events" | "news"
          }
          item={editingItem}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            load();
          }}
        />
      )}

      {items.length === 0 ? (
        <div className="mt-8">
          <div className="border border-dashed border-[var(--border)] bg-white p-10 text-center text-sm text-[var(--grey)]">
            No records found.
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {items.map((item) => (
            <AdminRecord
              key={String(item.id)}
              item={item}
              resource={resource}
              context={context}
              onUpdated={load}
              onEdit={
                canManageContent
                  ? () => openEdit(item)
                  : undefined
              }
              onDeleted={
                canManageContent ? load : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AdminRecord({
  item,
  resource,
  context,
  onUpdated,
  onEdit,
  onDeleted,
}: {
  item: Record<string, unknown>;
  resource: ResourceKey;
  context: AdminContext;
  onUpdated: () => void;
  onEdit?: () => void;
  onDeleted?: () => void;
}) {
  const id = String(item.id ?? "");

  const statusField =
    resource === "donations"
      ? "payment_status"
      : "status";

  const canChange = Boolean(
    statusOptions[resource] &&
      item[statusField] !== undefined,
  );

  async function changeStatus(value: string) {
    try {
      await patchResource(
        `/api/admin/${resource}/${id}`,
        {
          [statusField]: value,
        },
      );

      onUpdated();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update status.",
      );
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this record? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      await deleteResource(
        `/api/admin/${resource}/${id}`,
      );

      onDeleted?.();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to delete this record.",
      );
    }
  }

  const shown = Object.entries(item)
    .filter(
      ([key]) =>
        ![
          "id",
          "message",
          "content",
          "description",
          "metadata",
        ].includes(key),
    )
    .slice(0, 8);

  return (
    <article className="border border-[var(--border)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          {shown.map(([key, value]) => (
            <div key={key} className="text-sm">
              <span className="font-semibold text-[var(--grey)]">
                {key.replaceAll("_", " ")}:{" "}
              </span>

              <span className="text-[var(--dark)]">
                {String(value ?? "-")}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          {canChange && (
            <label className="grid gap-1 text-xs font-semibold">
              Status

              <select
                className="field min-w-40"
                value={String(item[statusField])}
                onChange={(event) =>
                  void changeStatus(
                    event.target.value,
                  )
                }
                disabled={
                  context.role !== "admin" &&
                  context.role !== "super_admin"
                }
              >
                {statusOptions[resource].map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}

          {onEdit && (
            <button
              type="button"
              className="button button-secondary"
              onClick={onEdit}
            >
              Edit
            </button>
          )}

          {onDeleted && (
            <button
              type="button"
              className="button border border-red-200 bg-white text-red-700 hover:bg-red-50"
              onClick={() => void handleDelete()}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

type ContentResource =
  | "programs"
  | "events"
  | "news";

function ContentEditor({
  resource,
  item,
  onClose,
  onSaved,
}: {
  resource: ContentResource;
  item: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(item);

  const [title, setTitle] = useState(
    String(item?.title ?? ""),
  );

  const [description, setDescription] =
    useState(
      String(item?.description ?? ""),
    );

  const [summary, setSummary] = useState(
    String(item?.summary ?? ""),
  );

  const [content, setContent] = useState(
    String(item?.content ?? ""),
  );

  const [category, setCategory] = useState(
    String(
      item?.category ??
        programCategories[0],
    ),
  );

  const [slug, setSlug] = useState(
    String(item?.slug ?? ""),
  );

  const [imageUrl, setImageUrl] =
    useState(
      String(item?.image_url ?? ""),
    );

  const [selectedImage, setSelectedImage] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState(
      String(item?.image_url ?? ""),
    );

  const [imageUploading, setImageUploading] =
    useState(false);

  const [status, setStatus] = useState(
    String(item?.status ?? "draft"),
  );

  const [eventDate, setEventDate] =
    useState(
      item?.event_date
        ? formatDateTimeLocal(
            String(item.event_date),
          )
        : "",
    );

  const [location, setLocation] =
    useState(
      String(item?.location ?? ""),
    );

  const [programId, setProgramId] =
    useState(
      String(item?.program_id ?? ""),
    );

  const [chapterId, setChapterId] =
    useState(
      String(item?.chapter_id ?? ""),
    );

  const [registrationEnabled, setRegistrationEnabled] =
    useState(
      Boolean(
        item?.registration_enabled ??
          false,
      ),
    );

  const [isActive, setIsActive] =
    useState(
      Boolean(
        item?.is_active ?? true,
      ),
    );

  const [impact, setImpact] =
    useState(
      String(item?.impact ?? ""),
    );

  const [author, setAuthor] =
    useState(
      String(item?.author ?? ""),
    );

  const [publishedAt, setPublishedAt] =
    useState(
      item?.published_at
        ? formatDateTimeLocal(
            String(item.published_at),
          )
        : "",
    );

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!editing || !slug) {
      setSlug(generateSlug(value));
    }
  }

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Only JPEG, PNG, and WebP images are allowed.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setError(null);
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleImageUpload() {
    if (!selectedImage || imageUploading) {
      return;
    }

    setImageUploading(true);
    setError(null);

    try {
      const uploaded = await uploadContentImage(
        selectedImage,
        resource,
      );

      setImageUrl(uploaded.url);
      setImagePreview(uploaded.url);
      setSelectedImage(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to upload image.",
      );
    } finally {
      setImageUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const finalImageUrl = imageUrl.trim();

      let payload: Record<string, unknown>;

      if (resource === "programs") {
        payload = {
          title: title.trim(),
          description: description.trim(),
          category,
          slug: slug.trim(),
          image_url:
            finalImageUrl || null,
          impact:
            impact.trim() || null,
          is_active: isActive,
          status,
        };
      } else if (resource === "events") {
        payload = {
          title: title.trim(),
          description: description.trim(),
          event_date: eventDate,
          location: location.trim(),
          slug: slug.trim(),
          image_url:
            finalImageUrl || null,
          program_id:
            programId.trim() || null,
          chapter_id:
            chapterId.trim() || null,
          registration_enabled:
            registrationEnabled,
          status,
        };
      } else {
        payload = {
          title: title.trim(),
          summary: summary.trim(),
          content: content.trim(),
          slug: slug.trim(),
          image_url:
            finalImageUrl || null,
          author:
            author.trim() || null,
          published_at:
            publishedAt || null,
          status,
        };
      }

      if (editing) {
        await patchResource(
          `/api/admin/${resource}/${String(
            item?.id,
          )}`,
          payload,
        );
      } else {
        await postResource(
          `/api/admin/${resource}`,
          payload,
        );
      }

      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save content.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const contentName =
    resource === "programs"
      ? "program"
      : resource === "events"
        ? "event"
        : "news";

  return (
    <div className="mt-8 border border-[var(--border)] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {editing
              ? "Edit content"
              : "New content"}
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-[var(--dark)]">
            {editing
              ? `Edit ${contentName}`
              : `Add ${contentName}`}
          </h2>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>

      <form
        onSubmit={submit}
        className="mt-6 grid gap-5"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Title

            <input
              className="field"
              value={title}
              onChange={(event) =>
                handleTitleChange(
                  event.target.value,
                )
              }
              required
              maxLength={200}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold">
            Slug

            <input
              className="field"
              value={slug}
              onChange={(event) =>
                setSlug(
                  event.target.value
                    .toLowerCase(),
                )
              }
              placeholder="example-program"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </label>
        </div>

        {resource === "programs" && (
          <>
            <label className="grid gap-2 text-sm font-semibold">
              Description

              <textarea
                className="field min-h-32"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                required
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Category

                <select
                  className="field"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value,
                    )
                  }
                  required
                >
                  {programCategories.map(
                    (value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value.replaceAll(
                          "_",
                          " ",
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Impact

                <input
                  className="field"
                  value={impact}
                  onChange={(event) =>
                    setImpact(
                      event.target.value,
                    )
                  }
                  maxLength={500}
                />
              </label>
            </div>

            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) =>
                  setIsActive(
                    event.target.checked,
                  )
                }
              />

              Active program
            </label>
          </>
        )}

        {resource === "events" && (
          <>
            <label className="grid gap-2 text-sm font-semibold">
              Description

              <textarea
                className="field min-h-32"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                required
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Event date

                <input
                  className="field"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(event) =>
                    setEventDate(
                      event.target.value,
                    )
                  }
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Location

                <input
                  className="field"
                  value={location}
                  onChange={(event) =>
                    setLocation(
                      event.target.value,
                    )
                  }
                  required
                  maxLength={300}
                />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Program ID

                <input
                  className="field"
                  value={programId}
                  onChange={(event) =>
                    setProgramId(
                      event.target.value,
                    )
                  }
                  placeholder="Optional UUID"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Chapter ID

                <input
                  className="field"
                  value={chapterId}
                  onChange={(event) =>
                    setChapterId(
                      event.target.value,
                    )
                  }
                  placeholder="Optional UUID"
                />
              </label>
            </div>

            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={
                  registrationEnabled
                }
                onChange={(event) =>
                  setRegistrationEnabled(
                    event.target.checked,
                  )
                }
              />

              Registration enabled
            </label>
          </>
        )}

        {resource === "news" && (
          <>
            <label className="grid gap-2 text-sm font-semibold">
              Summary

              <textarea
                className="field min-h-24"
                value={summary}
                onChange={(event) =>
                  setSummary(
                    event.target.value,
                  )
                }
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Content

              <textarea
                className="field min-h-48"
                value={content}
                onChange={(event) =>
                  setContent(
                    event.target.value,
                  )
                }
                required
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Author

                <input
                  className="field"
                  value={author}
                  onChange={(event) =>
                    setAuthor(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Published at

                <input
                  className="field"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(event) =>
                    setPublishedAt(
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>
          </>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="grid gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--dark)]">Image</p>
              <p className="mt-1 text-xs text-[var(--grey)]">Add a cover image for this content.</p>
            </div>

            <label className="group relative block cursor-pointer overflow-hidden rounded-lg border border-dashed border-[var(--border)] bg-[var(--light)] transition hover:border-[var(--crimson)] hover:bg-white">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleImageChange}
                disabled={submitting || imageUploading}
              />

              <div className="flex min-h-36 flex-col items-center justify-center px-6 py-7 text-center">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--crimson)] shadow-sm ring-1 ring-[var(--border)] transition group-hover:scale-105">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
                  </svg>
                </span>
                <span className="text-sm font-semibold text-[var(--dark)]">
                  {imagePreview ? "Choose a different image" : "Choose an image"}
                </span>
                <span className="mt-1 text-xs text-[var(--grey)]">
                  JPEG, PNG or WebP · Maximum 5 MB
                </span>
              </div>
            </label>

            {imagePreview && (
              <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-sm">
                <div className="relative aspect-[16/9] overflow-hidden bg-[var(--light)]">
                  <img
                    src={imagePreview}
                    alt="Selected content preview"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                    {selectedImage ? "New image" : "Current image"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--dark)]">
                      {selectedImage ? selectedImage.name : "Image uploaded"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--grey)]">
                      {selectedImage
                        ? `${(selectedImage.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload`
                        : "Stored in IRCS content storage"}
                    </p>
                  </div>

                  {selectedImage && (
                    <button
                      type="button"
                      className="button button-primary shrink-0 px-4 py-2 text-xs"
                      onClick={() => void handleImageUpload()}
                      disabled={imageUploading || submitting}
                    >
                      {imageUploading ? "Uploading..." : "Upload image"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {imageUploading && (
              <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--grey)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--crimson)]" />
                Uploading image securely...
              </div>
            )}

            {selectedImage && !imageUploading && (
              <p className="text-xs text-[var(--grey)]">
                Upload the image before saving this content.
              </p>
            )}
          </div>

          <label className="grid gap-2 text-sm font-semibold">
            Status

            <select
              className="field"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value,
                )
              }
              required
            >
              {contentStatusOptions[
                resource
              ].map((value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value.replaceAll(
                    "_",
                    " ",
                  )}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="button button-primary"
            disabled={
              submitting ||
              imageUploading ||
              Boolean(selectedImage)
            }
          >
            {submitting
              ? "Saving..."
              : editing
                ? "Save changes"
                : "Create content"}
          </button>

          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function formatDateTimeLocal(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60 * 1000,
  );

  return local
    .toISOString()
    .slice(0, 16);
}