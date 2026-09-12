"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

type Segment = { start: number; end: number; text: string };
type Style = { fontSize: number; position: "bottom"|"center"|"top"; background: boolean };

export default function CaptionStudio() {
  const [video, setVideo] = useState<File|null>(null);
  const [url, setUrl] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState<Style>({fontSize: 28, position: "bottom", background: true});
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<FFmpeg|null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const active = useMemo(() => {
    const t = videoRef.current?.currentTime ?? 0;
    return segments.find(s => t >= s.start && t <= s.end)?.text ?? "";
  }, [segments, videoRef.current?.currentTime]);

  async function extractAudio(file: File) {
    if (!ffmpegRef.current) {
      const ff = new FFmpeg();
      setStatus("Loading video processor…");
      await ff.load({
        coreURL: await toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm", "application/wasm")
      });
      ffmpegRef.current = ff;
    }
    const ff = ffmpegRef.current;
    await ff.writeFile("input.mp4", await fetchFile(file));
    await ff.exec(["-i","input.mp4","-vn","-ac","1","-ar","16000","-c:a","aac","audio.m4a"]);
    const data = await ff.readFile("audio.m4a");
    return new File([data as Uint8Array], "audio.m4a", {type:"audio/mp4"});
  }

  async function transcribe() {
    if (!video) return;
    setBusy(true); setStatus("Preparing audio…");
    try {
      const audio = await extractAudio(video);
      const form = new FormData();
      form.append("audio", audio);
      setStatus("Transcribing speech…");
      const res = await fetch("/api/transcribe", {method:"POST", body:form});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      setSegments(data.segments || []);
      setStatus(`Done — ${data.segments?.length || 0} caption segments`);
    } catch (e:any) {
      setStatus(e.message || "Something went wrong");
    } finally { setBusy(false); }
  }

  function downloadSrt() {
    const srt = segments.map((s,i) => {
      const tc = (n:number) => {
        const ms = Math.round(n*1000), h=Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000),
          sec=Math.floor(ms%60000/1000), milli=ms%1000;
        return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(milli).padStart(3,"0")}`;
      };
      return `${i+1}\n${tc(s.start)} --> ${tc(s.end)}\n${s.text}\n`;
    }).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([srt], {type:"text/plain"}));
    a.download = "captions.srt"; a.click();
  }

  function choose(file: File) {
    if (!file.type.startsWith("video/")) return;
    if (url) URL.revokeObjectURL(url);
    setVideo(file); setUrl(URL.createObjectURL(file)); setSegments([]); setStatus("");
  }

  return (
    <main>
      <nav className="nav"><div className="logo">Caption<span>AI</span></div><div className="pill">AI VIDEO CAPTIONS</div></nav>
      <section className="hero">
        <div>
          <p className="eyebrow">SPEECH → CAPTIONS → VIDEO</p>
          <h1>Make every word<br/><span>easy to follow.</span></h1>
          <p className="lead">Upload a video. CaptionAI detects the English speech and creates synchronized subtitles in seconds.</p>
        </div>
        <div className="card">
          {!video ? (
            <label className="drop">
              <div className="uploadIcon">↑</div>
              <strong>Drop your video here</strong>
              <span>or tap to browse • MP4, MOV, WebM</span>
              <input type="file" accept="video/*" onChange={e => e.target.files?.[0] && choose(e.target.files[0])}/>
            </label>
          ) : (
            <>
              <div className="preview">
                <video ref={videoRef} src={url} controls onTimeUpdate={() => setStatus(s=>s)} />
                {active && <div className={`caption ${style.position}`} style={{fontSize:style.fontSize, background:style.background?"rgba(0,0,0,.72)":"transparent"}}>{active}</div>}
              </div>
              <div className="controls">
                <button className="primary" disabled={busy} onClick={transcribe}>{busy ? "Processing…" : "Generate captions"}</button>
                {segments.length > 0 && <button onClick={downloadSrt}>Download SRT</button>}
                <button onClick={() => {setVideo(null);setSegments([]);setUrl("");}}>Change video</button>
              </div>
              {segments.length > 0 && <div className="editor">
                <h3>Caption style</h3>
                <label>Size <input type="range" min="18" max="54" value={style.fontSize} onChange={e=>setStyle({...style,fontSize:+e.target.value})}/></label>
                <label>Position <select value={style.position} onChange={e=>setStyle({...style,position:e.target.value as Style["position"]})}><option value="bottom">Bottom</option><option value="center">Center</option><option value="top">Top</option></select></label>
                <label><input type="checkbox" checked={style.background} onChange={e=>setStyle({...style,background:e.target.checked})}/> Background</label>
              </div>}
              <p className="status">{status}</p>
            </>
          )}
        </div>
      </section>
      <section className="features">
        <div><b>01</b><h3>AI transcription</h3><p>Speech is converted into timestamped English captions.</p></div>
        <div><b>02</b><h3>Live preview</h3><p>Preview your captions directly over the video.</p></div>
        <div><b>03</b><h3>SRT export</h3><p>Download a standard subtitle file for editing or publishing.</p></div>
      </section>
      <footer>CaptionAI • Keep your API keys on the server.</footer>
    </main>
  );
}