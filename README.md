# Outfit 360 MVP

Pipeline locale per creare un viewer stile Yafa partendo da un video.

## App Next EvoLink

Configura la key solo lato server:

```bash
cp .env.example .env.local
# inserisci EVOLINK_API_KEY in .env.local
# per upload temporaneo configura anche Supabase Storage:
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET
# per scontorno semantico persona:
# REMOVE_BG_API_KEY
npm install
npm run dev
```

Apri `http://localhost:3000`.

L'app permette di:

- scegliere **1-2 foto** oppure **1 video reference max 5 sec**;
- usare URL pubblici già pronti oppure upload temporaneo;
- creare un task Seedance 2.0 Reference-to-Video da 5-10 secondi;
- rimuovere automaticamente lo sfondo uniforme dal video generato;
- creare frame WebP ruotabili stile YafaFits;
- vedere stato, preview video e modellino drag-to-rotate.

Nota: EvoLink richiede URL pubblici diretti. Gli upload temporanei vengono salvati in Supabase Storage e cancellati a fine job. Il bucket configurato in `SUPABASE_STORAGE_BUCKET` deve essere pubblico, così EvoLink può scaricare i reference.

Per scontorno persona accurato configura `REMOVE_BG_API_KEY`. Senza questa key l'app usa solo un fallback chroma key basato sul colore dello sfondo.

## Supabase Storage

Non serve creare tabelle database per questa app. Serve solo un bucket Storage pubblico.

1. In Supabase apri `Storage`.
2. Crea un bucket chiamato `tredifits-temp`.
3. Rendi il bucket pubblico.
4. In Vercel aggiungi queste environment variables:

```env
SUPABASE_URL=https://zjyneszamncexwxpjgtm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=tredifits-temp
```

Non esporre `SUPABASE_SERVICE_ROLE_KEY` nel frontend e non committare `.env`.

## Setup

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Uso

Metti il video in `input/video.mp4`, poi:

```bash
python -m outfit360.pipeline input/video.mp4 --out output --prefix outfit_001_ --fps 24 --frames 160
```

Output:

```text
output/viewer/index.html
output/viewer/frames/outfit_001_00000.webp
output/viewer/frames/outfit_001_00001.webp
...
```

Apri `output/viewer/index.html` nel browser e trascina l'immagine.

## Flusso con Higgsfield

Higgsfield espone soprattutto CLI/MCP. Per usarlo:

```bash
npm install -g @higgsfield/cli
higgsfield auth login
```

Genera un video di rotazione partendo da un keyframe pulito:

```bash
python -m outfit360.higgsfield work/keyframe.png --out-json output/higgsfield-result.json
```

Il JSON contiene l'URL/risultato del job Higgsfield. Scarica il video generato in `input/generated.mp4`, poi crea il viewer:

```bash
python -m outfit360.pipeline input/generated.mp4 --out output --prefix outfit_001_ --fps 24 --frames 160
```

## Flusso con EvoLink Seedance 2.0

Questo è più adatto al nostro caso perché accetta **reference video** e **reference images**.
I file devono essere URL pubblici diretti, non base64.

```bash
export EVOLINK_API_KEY="..."
python -m outfit360.evolink \
  --video-url "https://example.com/input.mp4" \
  --image-url "https://example.com/keyframe.webp" \
  --duration 5 \
  --quality 720p \
  --aspect-ratio adaptive \
  --wait \
  --out-json output/evolink-result.json
```

Quando il task è `completed`, il JSON contiene `results` con il link del video. Scaricalo in `input/generated.mp4`, poi:

```bash
python -m outfit360.pipeline input/generated.mp4 --out output --prefix outfit_001_ --fps 24 --frames 160
```

## Nota

La pipeline locale usa i frame del video che le dai. Per un risultato tipo Yafa, il video migliore da passare alla pipeline è quello generato da EvoLink Seedance o Higgsfield con rotazione 360.
