"use client";

import { useMemo, useState } from "react";

import { defaultPrompt } from "../web/lib/evolink.mjs";

const DEFAULT_PROMPT = defaultPrompt();

function splitUrls(value) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function Home() {
  const [mode, setMode] = useState("images");
  const [source, setSource] = useState("url");
  const [files, setFiles] = useState([]);
  const [imageUrlsText, setImageUrlsText] = useState("");
  const [videoUrlsText, setVideoUrlsText] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [duration, setDuration] = useState(5);
  const [quality, setQuality] = useState("720p");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [task, setTask] = useState(null);
  const [spin, setSpin] = useState(null);

  const selectedSummary = useMemo(() => {
    const images = source === "upload" ? files.filter((file) => file.type.startsWith("image/")).length : splitUrls(imageUrlsText).length;
    const videos = source === "upload" ? files.filter((file) => file.type.startsWith("video/")).length : splitUrls(videoUrlsText).length;
    return mode === "images" ? `${images}/2 foto` : `${videos}/1 video`;
  }, [files, imageUrlsText, mode, source, videoUrlsText]);

  function onFilesSelected(fileList) {
    const selected = Array.from(fileList || []);
    if (mode === "images") {
      setFiles(selected.filter((file) => file.type.startsWith("image/")).slice(0, 2));
      return;
    }
    setFiles(selected.filter((file) => file.type.startsWith("video/")).slice(0, 1));
  }

  async function uploadReferences() {
    if (files.length === 0) throw new Error(mode === "images" ? "Carica 1 o 2 foto." : "Carica 1 video max 5 sec.");

    setMessage("Upload temporaneo reference...");
    const formData = new FormData();
    for (const file of files) formData.append("files", file);

    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Upload fallito.");

    const uploaded = body.uploads || [];
    return {
      imageUrls: uploaded.filter((item) => item.type.startsWith("image/")).map((item) => item.url),
      videoUrls: uploaded.filter((item) => item.type.startsWith("video/")).map((item) => item.url),
      fileNames: uploaded.map((item) => item.fileName).filter(Boolean)
    };
  }

  async function cleanupUploads(fileNames) {
    if (!fileNames.length) return;
    await fetch("/api/cleanup-uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileNames })
    }).catch(() => {});
  }

  async function pollTask(taskId) {
    setMessage("Generazione in corso...");
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      const response = await fetch(`/api/tasks/${taskId}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Query task fallita.");
      setTask(body);
      if (body.status === "completed" || body.status === "failed") return body;
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setStatus("running");
    setTask(null);
    setSpin(null);
    setMessage("");
    let tempFileNames = [];

    try {
      const uploaded = source === "upload" ? await uploadReferences() : { imageUrls: [], videoUrls: [], fileNames: [] };
      tempFileNames = uploaded.fileNames;
      const imageUrls = mode === "images" ? (source === "upload" ? uploaded.imageUrls : splitUrls(imageUrlsText).slice(0, 2)) : [];
      const videoUrls = mode === "video" ? (source === "upload" ? uploaded.videoUrls : splitUrls(videoUrlsText).slice(0, 1)) : [];

      if (mode === "images" && imageUrls.length === 0) throw new Error(source === "upload" ? "Carica 1 o 2 foto." : "Inserisci 1 o 2 URL immagine.");
      if (mode === "video" && videoUrls.length !== 1) throw new Error(source === "upload" ? "Carica 1 video max 5 sec." : "Inserisci 1 URL video pubblico, max 5 sec.");

      setMessage("Creo task Seedance...");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls, videoUrls, prompt, duration, quality, aspectRatio: "adaptive" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Generazione fallita.");

      setTask(body);
      const finalTask = await pollTask(body.id);
      if (finalTask.status !== "completed") {
        setStatus("failed");
        setMessage(finalTask.error?.message || "Task fallito.");
        return;
      }

      setMessage("Video pronto. Creo modellino ruotabile...");
      const spinResponse = await fetch("/api/render-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: finalTask.results?.[0] })
      });
      const spinBody = await spinResponse.json();
      if (!spinResponse.ok) throw new Error(spinBody.error || "Render modellino fallito.");

      setSpin(spinBody);
      setStatus("completed");
      setMessage("Modellino pronto.");
    } catch (error) {
      setStatus("failed");
      setMessage(error.message);
    } finally {
      await cleanupUploads(tempFileNames);
    }
  }

  const resultUrl = task?.results?.[0];

  return (
    <main className="shell">
      <section className="panel">
        <div className="brand">
          <span>Outfit Motion Lab</span>
          <strong>Seedance 2.0</strong>
        </div>

        <form onSubmit={onSubmit} className="form">
          <div className="modeSwitch" role="tablist" aria-label="Tipo reference">
            <button type="button" className={mode === "images" ? "active" : ""} onClick={() => setMode("images")}>
              1-2 foto
            </button>
            <button type="button" className={mode === "video" ? "active" : ""} onClick={() => setMode("video")}>
              1 video max 5 sec
            </button>
          </div>

          <div className="modeSwitch sourceSwitch" role="tablist" aria-label="Sorgente reference">
            <button type="button" className={source === "url" ? "active" : ""} onClick={() => setSource("url")}>
              URL pubblico
            </button>
            <button type="button" className={source === "upload" ? "active" : ""} onClick={() => setSource("upload")}>
              Upload temporaneo
            </button>
          </div>

          <div className="grid single">
            {source === "url" ? (
              <label>
                <span>{mode === "images" ? "Image URL pubblici (max 2)" : "Video URL pubblico (max 5 sec)"}</span>
                <textarea
                  value={mode === "images" ? imageUrlsText : videoUrlsText}
                  onChange={(event) => (mode === "images" ? setImageUrlsText(event.target.value) : setVideoUrlsText(event.target.value))}
                  placeholder={mode === "images" ? "https://...\nhttps://..." : "https://.../clip.mp4"}
                />
              </label>
            ) : (
              <label className="drop">
                <input
                  type="file"
                  multiple={mode === "images"}
                  accept={mode === "images" ? "image/png,image/jpeg,image/webp" : "video/mp4,video/quicktime"}
                  onChange={(event) => onFilesSelected(event.target.files)}
                />
                <span>{mode === "images" ? "Carica 1-2 foto" : "Carica 1 video"}</span>
                <small>
                  {files.length > 0
                    ? files.map((file) => file.name).join(", ")
                    : mode === "images"
                      ? "PNG, WEBP, JPG"
                      : "MP4 o MOV · max 5 sec consigliati"}
                </small>
              </label>
            )}
            {source === "upload" && (
              <p className="hint">
                I file vengono pubblicati temporaneamente, usati per EvoLink e cancellati automaticamente a fine job.
              </p>
            )}
          </div>

          <label>
            <span>Prompt</span>
            <textarea className="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>

          <div className="actions">
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} aria-label="Durata">
              <option value={5}>5 sec</option>
              <option value={6}>6 sec</option>
              <option value={7}>7 sec</option>
              <option value={8}>8 sec</option>
              <option value={9}>9 sec</option>
              <option value={10}>10 sec</option>
            </select>
            <select value={quality} onChange={(event) => setQuality(event.target.value)} aria-label="Qualità">
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
            <div className="summary">{selectedSummary}</div>
            <button disabled={status === "running"}>{status === "running" ? "Processo..." : "Genera modellino"}</button>
          </div>
        </form>
      </section>

      <section className="preview">
        <div className="status">
          <span>{task?.status || status}</span>
          <strong>{task?.progress ?? 0}%</strong>
        </div>
        {resultUrl ? (
          <div className="outputStack">
            <div className="outputBlock">
              <div className="outputTitle">AI video</div>
              <video src={resultUrl} controls autoPlay loop muted playsInline />
            </div>
            {spin?.frames?.length ? (
              <div className="outputBlock">
                <div className="outputTitle">Modellino 360</div>
                <SpinViewer frames={spin.frames} />
              </div>
            ) : (
              <div className="empty compact">
                <span>Creo modellino ruotabile...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="empty">
            <span>{message || "Nessun video ancora."}</span>
          </div>
        )}
        {message && <p>{message}</p>}
        {spin?.manifestUrl && (
          <a className="download" href={spin.manifestUrl} target="_blank" rel="noreferrer">
            Apri manifest
          </a>
        )}
        {resultUrl && (
          <a className="download" href={resultUrl} target="_blank" rel="noreferrer">
            Apri video AI
          </a>
        )}
      </section>
    </main>
  );
}

function SpinViewer({ frames }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(null);
  const current = frames[((index % frames.length) + frames.length) % frames.length];

  function onPointerMove(event) {
    if (!drag) return;
    const delta = event.clientX - drag.x;
    if (Math.abs(delta) < 5) return;
    setIndex((value) => value + (delta > 0 ? 1 : -1));
    setDrag({ x: event.clientX });
  }

  return (
    <div
      className="spinStage"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ x: event.clientX });
      }}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <img src={current} alt="" draggable={false} />
      <span>{String(index + 1).padStart(3, "0")} / {frames.length}</span>
    </div>
  );
}
