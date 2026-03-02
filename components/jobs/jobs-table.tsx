    <Modal open={open} onClose={() => setOpen(false)} title="Add New Application">
      <div className="space-y-4">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          <button
            onClick={() => setEntryMode("url")}
            className={`rounded-md px-3 py-1 ${entryMode === "url" ? "bg-white shadow" : ""}`}
          >
            URL scraper
          </button>
          <button
            onClick={() => setEntryMode("manual")}
            className={`rounded-md px-3 py-1 ${entryMode === "manual" ? "bg-white shadow" : ""}`}
          >
            Add manually
          </button>
        </div>

        <div className="grid gap-3">
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Job URL (required)"
            required
          />

          {entryMode === "manual" ? (
            <Textarea
              value={pageContent}
              onChange={(e) => setPageContent(e.target.value)}
              className="min-h-44"
              placeholder="Paste content. AI keeps only clean job description and fills other fields."
            />
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              We will scrape the URL and auto-fill all job information using AI.
            </p>
          )}

          <div>
            <p className="mb-1 text-sm font-medium">CV version for this application</p>
            <Select value={selectedCvId} onChange={(e) => setSelectedCvId(e.target.value)}>
              <option value="">No CV profile selected</option>
              {cvVersions.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.name}
                  {cv.isDefault ? " (default)" : ""}
                </option>
              ))}
            </Select>
          </div>

          {previewScore != null ? (
            <p className="rounded bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">
              Profile match score: {previewScore}%
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => startTransition(previewImport)}
              disabled={!sourceUrl.trim() || pending}
            >
              Preview match / duplicates
            </Button>

            <Button
              disabled={
                pending ||
                !sourceUrl.trim() ||
                (entryMode === "manual" && !pageContent.trim())
              }
              onClick={() => startTransition(() => importText(false))}
            >
              {pending || processingState === "processing"
                ? "Analyzing..."
                : "Analyze with AI & create application"}
            </Button>
          </div>

          {processingState === "processing" ? (
            <div className="relative overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-cyan-50 to-fuchsia-50 px-4 py-3 text-center">
              <div className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]">
                <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-indigo-300/60 border-t-indigo-500 animate-spin" />
                <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/70 animate-ping" />
              </div>
              <p className="relative text-sm font-semibold text-indigo-700">
                🤖 AI is processing your job...
              </p>
              <p className="relative mt-1 text-xs text-indigo-500">
                Parsing details, scoring your profile, and creating the application.
              </p>
            </div>
          ) : null}

          {processingState === "done" ? (
            <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 px-4 py-3 text-center">
              <div className="pointer-events-none absolute inset-0">
                <span className="absolute left-4 top-3 text-emerald-400 animate-bounce">✨</span>
                <span className="absolute right-5 top-2 text-cyan-400 animate-bounce [animation-delay:120ms]">🎉</span>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-teal-400 animate-pulse">✦</span>
              </div>
              <p className="relative flex items-center justify-center gap-1 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} className="animate-pulse" /> Job added successfully!
              </p>
              <p className="relative mt-1 text-xs text-emerald-600">
                Ready to track progress and next steps.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>