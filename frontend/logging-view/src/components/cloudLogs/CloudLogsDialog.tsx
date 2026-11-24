import { useEffect, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SidebarMenuButton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@hyperloopupv/frontend-kit/components";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileDown,
  FolderOpen,
  RefreshCw,
  Upload,
  X,
} from "@hyperloopupv/frontend-kit/icons";
import type {
  CloudCredentialsStatus,
  CloudLog,
  CloudLogProgress,
  CloudLogsAPI,
  DownloadedLog,
  LocalLogSession,
} from "@hyperloopupv/frontend-kit/core";
import { useSessionFolder } from "../../hooks/useSessionFolder";

const failureMessage = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    "",
  );
const dateLabel = (date: string) => {
  if (!date) return "";
  const clean = date.replace(/Z$/, "");
  return clean
    .replace("T", " · ")
    .replace(/(\d{2})[-:](\d{2})[-:](\d{2})$/, "$1:$2:$3");
};
const sizeLabel = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;
const phases = {
  compressing: "Compressing session…",
  uploading: "Uploading ZIP…",
  downloading: "Downloading ZIP…",
  extracting: "Extracting session…",
};

const noticeTones = {
  info: "bg-muted/40 text-muted-foreground",
  success:
    "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
  // The theme's dark `--destructive` is too dim for text on a dark background.
  error: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
};

/** Inline feedback: grey for hints, green when an operation worked, red when it failed. */
function Notice({
  children,
  error = false,
  success = false,
}: {
  children: React.ReactNode;
  error?: boolean;
  success?: boolean;
}) {
  const tone = error ? "error" : success ? "success" : "info";
  const Icon = error ? AlertCircle : success ? CheckCircle2 : null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${noticeTones[tone]}`}
    >
      {Icon && <Icon aria-hidden className="mt-px size-3.5 shrink-0" />}
      <p className="min-w-0 break-words">{children}</p>
    </div>
  );
}

function CredentialsPanel({
  api,
  status,
  onSaved,
}: {
  api: CloudLogsAPI;
  status: CloudCredentialsStatus | null;
  onSaved: (status: CloudCredentialsStatus) => void;
}) {
  const [user, setUser] = useState(status?.user ?? "");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => setUser(status?.user ?? ""), [status?.user]);

  const save = async (clear = false) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = clear
        ? await api.clearCredentials()
        : await api.setCredentials({ user, apiKey: key });
      setKey("");
      setConfirmClear(false);
      onSaved(next);
      setMessage(
        clear
          ? "Credentials removed."
          : "Credentials saved. They are shared by Logging View and Testing View.",
      );
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="text-muted-foreground text-sm">
        Set the account used to access Cloud Logs and identify your uploads.
      </p>
      <div className="space-y-2">
        <Label htmlFor="cloud-user">User</Label>
        <Input
          id="cloud-user"
          value={user}
          maxLength={200}
          disabled={busy}
          autoComplete="username"
          onChange={(e) => setUser(e.target.value)}
          placeholder="Your user name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cloud-key">API key</Label>
        <Input
          id="cloud-key"
          type="password"
          value={key}
          maxLength={8192}
          disabled={busy}
          autoComplete="off"
          onChange={(e) => setKey(e.target.value)}
          placeholder={
            status?.hasApiKey
              ? "Key configured — leave blank to keep it"
              : "Enter your API key"
          }
        />
        <p className="text-muted-foreground text-xs">
          {status?.persistent
            ? "Stored encrypted on this computer. The saved key is never displayed."
            : "Secure storage is unavailable. Your API key will only be kept until the app closes."}
        </p>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice success>{message}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={busy || !user.trim() || (!key.trim() && !status?.hasApiKey)}
        >
          {busy ? "Saving…" : "Save credentials"}
        </Button>
        {status?.hasApiKey && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmClear((v) => !v)}
          >
            Remove credentials
          </Button>
        )}
      </div>
      {confirmClear && (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-xs">
          <span>Remove the saved user and API key from this computer?</span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void save(true)}
          >
            Remove
          </Button>
        </div>
      )}
    </form>
  );
}

function UploadPanel({
  api,
  ready,
  busy,
  onUpload,
}: {
  api: CloudLogsAPI;
  ready: boolean;
  busy: boolean;
  onUpload: (
    session: LocalLogSession,
    notes: string,
    tags: string[],
    title?: string,
  ) => Promise<boolean>;
}) {
  const [sessions, setSessions] = useState<LocalLogSession[]>([]);
  const [selected, setSelected] = useState<LocalLogSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [tagError, setTagError] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [stopped, setStopped] = useState(false);
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setSessions(await api.getLocalSessions());
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    let current = true;
    setTagBusy(true);
    setTagError("");
    setSuggestions([]);
    const timer = setTimeout(() => {
      api
        .autocompleteTags(query)
        .then((items) => {
          if (current) setSuggestions([...new Set(items)]);
        })
        .catch((err) => {
          if (current) setTagError(failureMessage(err));
        })
        .finally(() => {
          if (current) setTagBusy(false);
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, query, ready]);
  const choose = (session: LocalLogSession | null) => {
    setSelected(session);
    setStopped(false);
  };
  const browse = async () => {
    setLoading(true);
    setError("");
    try {
      choose(await api.selectSession());
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = (rawTag?: string) => {
    const candidate = (rawTag ?? query).trim();
    if (!candidate || tags.includes(candidate) || tags.length >= 30) return;
    setTags((prev) => [...prev, candidate]);
    setQuery("");
  };

  return (
    <form
      className="space-y-4"
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          (e.target as HTMLElement)?.tagName === "INPUT"
        ) {
          e.preventDefault();
        }
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (selected) {
          const ok = await onUpload(
            selected,
            notes,
            tags,
            title.trim() || undefined,
          );
          if (ok) {
            setSelected(null);
            setTitle("");
            setNotes("");
            setTags([]);
            setStopped(false);
          }
        }
      }}
    >
      <p className="text-muted-foreground text-sm">
        Share one completed recording. Its CSV files and session settings are
        compressed into a ZIP before upload.
      </p>
      <fieldset disabled={busy || loading} className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="cloud-session">Local recording</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refresh()}
            aria-label="Refresh local sessions"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        <select
          id="cloud-session"
          className="bg-background border-input h-9 w-full rounded-md border px-3 text-sm"
          value={
            sessions.some((s) => s.id === selected?.id) ? selected?.id : ""
          }
          onChange={(e) =>
            choose(sessions.find((s) => s.id === e.target.value) ?? null)
          }
        >
          <option value="">
            {loading
              ? "Finding recordings…"
              : "Select a recording from logger/"}
          </option>
          {sessions.map((s) => (
            <option value={s.id} key={s.id}>
              {s.launch} / {s.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void browse()}
        >
          <FolderOpen className="mr-2 size-4" />
          Browse session folder
        </Button>
        {!loading && !sessions.length && (
          <p className="text-muted-foreground text-xs">
            No completed recordings found in the configured logger folder. You
            can browse to another session.
          </p>
        )}
      </fieldset>
      {selected && (
        <div className="bg-muted/40 space-y-1 rounded-lg border p-3 text-xs">
          <p className="truncate font-medium">{selected.name}</p>
          <p className="text-muted-foreground">Launch: {selected.launch}</p>
          <p>Log date: {dateLabel(selected.date)}</p>
          <p className="text-muted-foreground">
            {selected.fileCount} files · {sizeLabel(selected.bytes)} before
            compression
          </p>
        </div>
      )}
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cloud-title">Title (optional)</Label>
          <Input
            id="cloud-title"
            value={title}
            maxLength={200}
            placeholder="e.g. Failed precharge (defaults to recording date)"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cloud-notes">Notes</Label>
          <Textarea
            id="cloud-notes"
            value={notes}
            maxLength={10000}
            rows={3}
            placeholder="Describe the test, conditions or anything worth reviewing…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cloud-tags">Tags</Label>
          <div className="flex gap-2">
            <Input
              id="cloud-tags"
              value={query}
              maxLength={100}
              disabled={!ready}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddTag();
                }
              }}
              placeholder="Search or type a tag and press Enter…"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={
                !ready ||
                !query.trim() ||
                tags.includes(query.trim()) ||
                tags.length >= 30
              }
              onClick={() => handleAddTag()}
            >
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  key={tag}
                  aria-label={`Remove tag ${tag}`}
                  onClick={() =>
                    setTags((items) => items.filter((item) => item !== tag))
                  }
                >
                  {tag}
                  <X className="ml-1 size-3" />
                </Button>
              ))}
            </div>
          )}
          <div aria-live="polite" className="text-muted-foreground text-xs">
            {tagBusy
              ? "Looking up tags…"
              : tagError ||
                (!ready
                  ? "Configure credentials to load tags."
                  : suggestions.length === 0
                    ? "No matching tags."
                    : "Choose a tag below.")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions
              .filter((s) => !tags.includes(s))
              .slice(0, 20)
              .map((tag) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  key={tag}
                  disabled={tags.length >= 30}
                  onClick={() => handleAddTag(tag)}
                >
                  {tag}
                </Button>
              ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="cloud-stopped"
            checked={stopped}
            onCheckedChange={(value) => setStopped(value === true)}
          />
          <Label htmlFor="cloud-stopped" className="text-xs">
            This recording has stopped and is ready to share.
          </Label>
        </div>
      </fieldset>
      {error && <Notice error>{error}</Notice>}
      {!ready && (
        <Notice>
          Configure your user and API key in Credentials before uploading.
        </Notice>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={busy || loading || !selected || !stopped || !ready}
        >
          <Upload className="mr-2 size-4" />
          Compress & upload
        </Button>
      </div>
    </form>
  );
}

function LibraryPanel({
  api,
  ready,
  busy,
  downloads,
  onDownload,
  onOpen,
}: {
  api: CloudLogsAPI;
  ready: boolean;
  busy: boolean;
  downloads: DownloadedLog[];
  onDownload: (item: CloudLog) => void;
  onOpen: (session: DownloadedLog) => void;
}) {
  const [items, setItems] = useState<CloudLog[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refresh = async (next?: string) => {
    setLoading(true);
    setError("");
    try {
      const page = await api.list(next);
      setItems((old) =>
        next
          ? [
              ...old,
              ...page.items.filter(
                (item) => !old.some((s) => s.id === item.id),
              ),
            ]
          : page.items,
      );
      setCursor(page.nextCursor);
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (ready) void refresh();
  }, [api, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Browse shared recordings and download them for analysis.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!ready || loading || busy}
          onClick={() => void refresh()}
        >
          <RefreshCw
            className={`mr-2 size-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      {!ready && (
        <Notice>
          Configure your user and API key in Credentials to browse Cloud Logs.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      {loading && (
        <p role="status" className="text-muted-foreground text-xs">
          Loading cloud recordings…
        </p>
      )}
      {ready && !loading && !error && !items.length && (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No recordings in Cloud Logs yet.
        </div>
      )}
      {items.map((item) => {
        const headline = item.title || item.fileName || dateLabel(item.date);
        const hasTitleOrFileName = Boolean(item.title || item.fileName);
        return (
          <div key={item.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{headline}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {hasTitleOrFileName
                    ? `${item.user} · ${dateLabel(item.date)}`
                    : `${item.user} · ${item.id}`}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onDownload(item)}
              >
                <FileDown className="mr-2 size-4" />
                Download
              </Button>
            </div>
            {item.notes && (
              <p className="text-xs break-words whitespace-pre-wrap">
                {item.notes}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-muted rounded px-2 py-0.5 text-[11px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {cursor && (
        <Button
          variant="outline"
          size="sm"
          disabled={loading || busy}
          onClick={() => void refresh(cursor)}
        >
          Load more
        </Button>
      )}
      <div className="border-t pt-4">
        <h3 className="mb-2 text-sm font-medium">On this computer</h3>
        <p className="text-muted-foreground mb-3 text-xs">
          Downloaded recordings are stored in logger/cloud-logs and can be
          opened offline.
        </p>
        {downloads.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No downloaded recordings yet.
          </p>
        ) : (
          downloads.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 border-b py-2"
            >
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium">
                  {item.title || item.fileName || dateLabel(item.date)}
                </p>
                <p className="text-muted-foreground truncate">
                  {dateLabel(item.date)} · {item.id}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onOpen(item)}
              >
                <FolderOpen className="mr-2 size-4" />
                Open
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function CloudLogsDialog() {
  const api = window.electronAPI?.cloudLogs;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CloudCredentialsStatus | null>(null);
  const [downloads, setDownloads] = useState<DownloadedLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CloudLogProgress | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const request = useRef<string | null>(null);
  const { openPath, busyPath, failure } = useSessionFolder();
  useEffect(() => {
    if (!open || !api) return;
    let current = true;
    Promise.all([api.getCredentialsStatus(), api.getDownloads()])
      .then(([next, local]) => {
        if (current) {
          setStatus(next);
          setDownloads(local);
        }
      })
      .catch((err) => {
        if (current) setError(failureMessage(err));
      });
    return () => {
      current = false;
    };
  }, [api, open]);
  useEffect(
    () =>
      api?.onProgress((value) => {
        if (value.requestId === request.current) setProgress(value);
      }),
    [api],
  );
  const run = async (operation: (id: string) => Promise<void>) => {
    if (request.current) return false;
    const id = crypto.randomUUID();
    request.current = id;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress(null);
    try {
      await operation(id);
      return true;
    } catch (err) {
      setError(failureMessage(err));
      return false;
    } finally {
      request.current = null;
      setBusy(false);
      setProgress(null);
    }
  };
  const openDownloaded = async (session: DownloadedLog) => {
    if (await openPath(session.path)) setOpen(false);
  };
  const onDownload = (item: CloudLog) => {
    if (!api) return;
    run(async (requestId) => {
      const downloaded = await api.download({
        id: item.id,
        title: item.title,
        fileName: item.fileName,
        requestId,
      });
      setDownloads((items) => [
        downloaded,
        ...items.filter((entry) => entry.id !== downloaded.id),
      ]);
      setMessage("Recording downloaded and ready to open.");
    });
  };
  const percent = progress?.total
    ? Math.min(
        100,
        Math.round((100 * (progress.completed ?? 0)) / progress.total),
      )
    : undefined;
  const locked = busy || !!busyPath;
  return (
    <>
      <SidebarMenuButton
        tooltip="Cloud Logs"
        onClick={() => {
          setError("");
          setMessage("");
          setOpen(true);
        }}
      >
        <Database className="size-4" />
        <span>Cloud Logs</span>
      </SidebarMenuButton>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!locked) setOpen(value);
        }}
      >
        <DialogContent className="flex h-[min(48rem,calc(100dvh-2rem))] min-h-0 flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="text-primary size-5" />
              Cloud Logs
            </DialogTitle>
            <DialogDescription>
              Share recordings, manage downloads and configure your account.
            </DialogDescription>
          </DialogHeader>
          {!api ? (
            <Notice>
              Cloud Logs is available in the Control Station desktop app. Open
              Logging View from Electron to manage local recordings and
              credentials.
            </Notice>
          ) : (
            <>
              <Tabs
                defaultValue="library"
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
              >
                <TabsList>
                  <TabsTrigger value="library" disabled={locked}>
                    Library
                  </TabsTrigger>
                  <TabsTrigger value="upload" disabled={locked}>
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="credentials" disabled={locked}>
                    Credentials
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="library"
                  className="min-h-0 flex-1 overflow-y-auto"
                >
                  <LibraryPanel
                    api={api}
                    ready={!!status?.hasApiKey && !!status.user}
                    busy={locked}
                    downloads={downloads}
                    onOpen={(s) => void openDownloaded(s)}
                    onDownload={onDownload}
                  />
                </TabsContent>
                <TabsContent
                  value="upload"
                  className="min-h-0 flex-1 overflow-y-auto"
                >
                  <UploadPanel
                    api={api}
                    ready={!!status?.hasApiKey && !!status.user}
                    busy={locked}
                    onUpload={(session, notes, tags, title) =>
                      run(async (requestId) => {
                        await api.upload({
                          sessionId: session.id,
                          title,
                          notes,
                          tags,
                          requestId,
                        });
                        setMessage("Recording uploaded successfully.");
                      })
                    }
                  />
                </TabsContent>
                <TabsContent
                  value="credentials"
                  className="min-h-0 flex-1 overflow-y-auto"
                >
                  <CredentialsPanel
                    api={api}
                    status={status}
                    onSaved={setStatus}
                  />
                </TabsContent>
              </Tabs>
              {(busy || busyPath) && (
                <div
                  role="status"
                  aria-live="polite"
                  className="bg-muted/40 space-y-2 rounded-lg border p-3"
                >
                  <p className="flex items-center gap-2 text-sm">
                    <RefreshCw className="text-primary size-4 animate-spin" />
                    {busyPath
                      ? "Opening recording…"
                      : progress
                        ? phases[progress.phase]
                        : "Preparing transfer…"}
                    {percent !== undefined && (
                      <span className="ml-auto text-xs tabular-nums">
                        {percent}%
                      </span>
                    )}
                  </p>
                  {percent !== undefined && (
                    <progress
                      aria-label="Transfer progress"
                      max={100}
                      value={percent}
                      className="h-1.5 w-full accent-current"
                    />
                  )}
                  <p className="text-muted-foreground text-xs">
                    Keep this window open until the operation finishes.
                  </p>
                </div>
              )}
              {(error || failure) && (
                <Notice error>{error || failure?.message}</Notice>
              )}
              {message && <Notice success>{message}</Notice>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
