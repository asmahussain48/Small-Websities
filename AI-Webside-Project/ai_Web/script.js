    // Clear any stale cached Gemini model URL from older versions
    (function() {
      const cached = localStorage.getItem('recallme_gemini_url') || '';
      if (cached.includes('gemini-1.5-flash') || cached.includes('v1beta/models/gemini-1.5')) {
        localStorage.removeItem('recallme_gemini_url');
        localStorage.removeItem('recallme_gemini_model');
      }
    })();

    // ═══════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════
    let transcriptBlocks = [];
    let selFile = null;
    let hist = [], busy = false;
    let isRec = false, recog = null, finalTxStr = '', notesDone = false;
    let waveInt = null, waveAnimFrame = null;
    let liveBlockId = null;
    let recRestartAttempts = 0;
    let recRestartTimer = null;
    const MAX_RESTART_ATTEMPTS = 99; // keep trying indefinitely

    // ═══════════════════════════════════════════════
    //  API KEY MANAGEMENT (Gemini — free)
    // ═══════════════════════════════════════════════
    let apiKey = localStorage.getItem('recallme_gemini_key') || '';

    function checkApiKey() {
      if (apiKey) return true;
      const key = prompt(
        '🔑 Letta needs a FREE Google Gemini API key.\n\n' +
        'Quick setup (1 minute):\n' +
        '1. Open: https://aistudio.google.com/apikey\n' +
        '2. Sign in with Google\n' +
        '3. Click "Create API Key" → copy it\n' +
        '4. Paste it here\n\n' +
        'Free tier: 15 requests/min — no credit card needed.\n\n' +
        'Letta auto-selects the best available model for your key.\n' +
        'No manual configuration needed.'
      );
      if (key && key.trim().length > 10) {
        apiKey = key.trim();
        localStorage.setItem('recallme_gemini_key', apiKey);
        showToast('✅ API key saved! Letta is ready.');
        return true;
      }
      showToast('⚠️ No API key — Letta cannot respond without one.');
      return false;
    }

    function promptChangeApiKey() {
      const current = apiKey ? '(current key hidden for security)' : '(no key set)';
      const key = prompt(
        'Enter your Google Gemini API key\n' +
        'Get one free at: aistudio.google.com/apikey\n\n' +
        current
      );
      if (key !== null && key.trim().length > 10) {
        apiKey = key.trim();
        localStorage.setItem('recallme_gemini_key', apiKey);
        showToast('✅ API key updated! Letta is ready.');
      } else if (key !== null) {
        showToast('⚠️ Key too short — not saved.');
      }
    }

    // ═══════════════════════════════════════════════
    //  PAGE ROUTING
    // ═══════════════════════════════════════════════
    function showLibrary() { stopRec(); show('pg-library'); hide('pg-session'); }
    function show(id) { document.getElementById(id).classList.add('active'); }
    function hide(id) { document.getElementById(id).classList.remove('active'); }

    function openSession(title, type, fileName) {
      hist = []; notesDone = false; transcriptBlocks = [];
      finalTxStr = ''; liveBlockId = null;
      document.getElementById('txBlocks').innerHTML = '';
      document.getElementById('txPlaceholder').style.display = 'block';
      document.getElementById('chatScroll').innerHTML = `
    <div class="chat-empty" id="chatEmpty">
      <div class="chat-empty-orb">🎓</div>
      <div class="chat-empty-t">Letta is ready</div>
      <div class="chat-empty-s">Ask questions about your transcript. Letta can also search the web to enrich your notes with accurate information.</div>
    </div>`;
      document.getElementById('fixBtn').disabled = true;
      document.getElementById('recStatusBar').classList.remove('visible');
      hide('pg-library'); show('pg-session');
      if (type === 'sample') setTimeout(loadSample, 350);
    }

    function loadSample() {
      const tx = `and maybe talk louder please give me a sec already yeah so how this platform works in real time audio streaming you can see that as im talking the information what im saying is being transcribed right here on the text and there are definitions in the class you can see that its compiling the important points of what the professor would be saying into notes from there looking through this lets just say i have a question in this its like what was the suggestion for speaking louder for example i could go in type that its okay i dont think it has but i could go in and type that in here and as its transcribing notes it can also handle suppose this is what i said in the recording on and all got written now it generated auto notes like how the platform works platform enables real time audio streaming and live transcription spoken words appear instantly as text on screen system compiles professor key points into organized notes`;
      addTranscriptBlock('video', 'The 10 Stages of AI.mp4', tx);
      setTimeout(() => generateNotes(getAllText()), 900);
    }

    // ═══════════════════════════════════════════════
    //  MODALS
    // ═══════════════════════════════════════════════
    function openModal(id) { document.getElementById(id).classList.add('open'); }
    function closeModal(id) { document.getElementById(id).classList.remove('open'); }
    function closeOnBg(e, id) { if (e.target.classList.contains('overlay')) closeModal(id); }

    function switchTab(t) {
      document.getElementById('pane-url').style.display = t === 'url' ? 'block' : 'none';
      document.getElementById('pane-file').style.display = t === 'file' ? 'block' : 'none';
      document.getElementById('tab-url').classList.toggle('active', t === 'url');
      document.getElementById('tab-file').classList.toggle('active', t === 'file');
    }

    function addFromUrl() {
      const name = document.getElementById('vidName').value.trim();
      const url = document.getElementById('vidUrl').value.trim();
      if (!url) { alert('Please enter a video URL.'); return; }
      let title = name;
      if (!title) { try { title = new URL(url).hostname.replace('www.', ''); } catch (e) { title = 'Lecture'; } }
      addLibraryCard(title, 'url', url);
      closeModal('modal-upload');
      document.getElementById('vidName').value = '';
      document.getElementById('vidUrl').value = '';
    }

    function handleDrop(e) {
      e.preventDefault();
      document.getElementById('dropZone').classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) setSelectedFile(f);
    }
    function onFileSelect(e) { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }
    function setSelectedFile(f) {
      selFile = f;
      const d = document.getElementById('fileDisplay');
      document.getElementById('fileDisplayName').textContent = '📎 ' + f.name + ' (' + (f.size / 1024 / 1024).toFixed(1) + ' MB)';
      d.style.display = 'flex';
    }

    async function processUploadedFile() {
      if (!selFile) { alert('Please select a file first.'); return; }
      const btn = document.getElementById('uploadBtn');
      btn.disabled = true; btn.textContent = 'Processing...';
      const pw = document.getElementById('progressWrap');
      const pb = document.getElementById('progressBar');
      const pl = document.getElementById('progressLabel');
      pw.style.display = 'block'; pl.style.display = 'block';
      pl.style.color = 'var(--t2)';
      pl.textContent = 'Loading file...'; pb.style.width = '5%';

      const fileName = selFile.name;
      const title = fileName.replace(/\.[^.]+$/, '');

      try {
        const transcript = await transcribeFile(selFile, (pct, label) => {
          pb.style.width = (10 + pct * 0.85) + '%';
          pl.textContent = label;
        });
        pb.style.width = '100%';
        pl.textContent = '✓ Transcription complete!';
        pl.style.color = 'var(--green)';
        setTimeout(() => {
          closeModal('modal-upload');
          addLibraryCard(title, 'video', fileName);
          openSession(title, 'video', fileName);
          setTimeout(() => {
            addTranscriptBlock('video', fileName, transcript);
            setTimeout(() => generateNotes(getAllText()), 900);
          }, 300);
          selFile = null;
          document.getElementById('fileDisplay').style.display = 'none';
          pw.style.display = 'none'; pl.style.display = 'none';
          pb.style.width = '0%';
          btn.disabled = false; btn.textContent = 'Extract & Transcribe';
        }, 800);
      } catch (err) {
        pl.textContent = '✕ ' + err.message;
        pl.style.color = 'var(--red,#ff4d6d)';
        btn.disabled = false; btn.textContent = 'Extract & Transcribe';
      }
    }

    // ═══════════════════════════════════════════════
    //  WHISPER + CLAUDE TRANSCRIPTION ENGINE
    // ═══════════════════════════════════════════════

    const WHISPER_URL = 'http://localhost:5050';
    let whisperOnline = false;
    let uploadMethod = 'whisper'; // 'whisper' | 'claude'

    // ── Whisper server health check ───────────────────────────────────────────────
    async function checkWhisperServer() {
      const pill = document.getElementById('whisperPill');
      const dot = document.getElementById('whisperDot');
      const label = document.getElementById('whisperLabel');
      try {
        const r = await fetch(WHISPER_URL + '/health', { signal: AbortSignal.timeout(2000) });
        const d = await r.json();
        whisperOnline = r.ok;
      } catch (e) { whisperOnline = false; }

      if (pill) {
        pill.className = 'whisper-pill ' + (whisperOnline ? 'online' : 'offline');
        label.textContent = whisperOnline ? 'Whisper ✓' : 'Whisper offline';
      }
      return whisperOnline;
    }

    // Poll every 10 seconds
    setInterval(checkWhisperServer, 10000);
    setTimeout(checkWhisperServer, 800);

    // ── Method toggle ─────────────────────────────────────────────────────────────
    function setMethod(m) {
      uploadMethod = m;
      document.getElementById('methodWhisper').className = 'method-btn' + (m === 'whisper' ? ' active green' : '');
      document.getElementById('methodClaude').className = 'method-btn' + (m === 'claude' ? ' active' : '');
      document.getElementById('whisperNote').style.display = m === 'whisper' ? '' : 'none';
      document.getElementById('claudeNote').style.display = m === 'claude' ? '' : 'none';
      document.getElementById('dropzoneHint').textContent = m === 'whisper'
        ? 'MP3, MP4, WAV, M4A, MOV, WebM — any size, any language'
        : 'MP3, WAV, M4A, WebM — max ~10 MB for best results';
      document.getElementById('uploadBtn').textContent = m === 'whisper'
        ? '🎙️ Transcribe with Whisper'
        : '🤖 Transcribe with Claude AI';
    }

    // ── Main entry: processUploadedFile decides which engine to use ───────────────
    async function processUploadedFile() {
      if (!selFile) { alert('Please select a file first.'); return; }
      const btn = document.getElementById('uploadBtn');
      btn.disabled = true; btn.textContent = 'Processing…';
      const pw = document.getElementById('progressWrap');
      const pb = document.getElementById('progressBar');
      const pl = document.getElementById('progressLabel');
      pw.style.display = 'block'; pl.style.display = 'block';
      pl.style.color = 'var(--t2)';
      pl.textContent = 'Starting…'; pb.style.width = '4%';

      const fileName = selFile.name;
      const title = fileName.replace(/\.[^.]+$/, '');

      const onProgress = (pct, label) => {
        pb.style.width = pct + '%';
        pl.textContent = label;
      };

      try {
        let transcript;
        if (uploadMethod === 'whisper') {
          // Check server is up first
          const up = await checkWhisperServer();
          if (!up) {
            throw new Error(
              'Whisper server is offline.\n\n' +
              'Steps to start it:\n' +
              '1. Open a terminal / command prompt\n' +
              '2. Run:  python server.py\n' +
              '3. Wait for "Model ready ✓" message\n' +
              '4. Then try uploading again.\n\n' +
              'Or switch to "Claude AI" mode above.'
            );
          }
          transcript = await transcribeWithWhisper(selFile, onProgress);
        } else {
          transcript = await transcribeWithClaude(selFile, onProgress);
        }

        pb.style.width = '100%';
        pl.textContent = '✓ Transcription complete!';
        pl.style.color = 'var(--green)';

        setTimeout(() => {
          closeModal('modal-upload');
          addLibraryCard(title, 'video', fileName);
          openSession(title, 'video', fileName);
          setTimeout(() => {
            addTranscriptBlock('video', fileName, transcript);
            setTimeout(() => generateNotes(getAllText()), 900);
          }, 300);
          selFile = null;
          document.getElementById('fileDisplay').style.display = 'none';
          pw.style.display = 'none'; pl.style.display = 'none';
          pb.style.width = '0%';
          btn.disabled = false;
          setMethod(uploadMethod); // restore button label
        }, 800);

      } catch (err) {
        pl.textContent = '✕ ' + err.message.split('\n')[0];
        pl.style.color = '#ff4d6d';
        if (err.message.includes('\n')) alert(err.message);
        btn.disabled = false;
        setMethod(uploadMethod);
      }
    }

    // ── ENGINE 1: Whisper via local Python server ─────────────────────────────────
    // Dual-pass: Pass 1 transcribes original language, Pass 2 translates to English
    async function transcribeWithWhisper(file, onProgress) {
      onProgress(8, 'Uploading file to Whisper server…');

      // Helper: one XHR POST to /transcribe
      function doWhisperXHR(formData, uploadLabel) {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', WHISPER_URL + '/transcribe');
          xhr.upload.onprogress = e => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 35);
              onProgress(8 + pct, `${uploadLabel} ${Math.round(e.loaded / 1024 / 1024 * 10) / 10} MB…`);
            }
          };
          xhr.ontimeout = () => reject(new Error('Whisper server timed out. Large files take longer — try again.'));
          xhr.timeout = 10 * 60 * 1000;
          xhr.onerror = () => reject(new Error('Cannot reach Whisper server at ' + WHISPER_URL + '. Is "python server.py" running?'));
          xhr.onload = () => {
            try {
              const d = JSON.parse(xhr.responseText);
              if (xhr.status !== 200 || d.error) reject(new Error(d.error || 'Server error ' + xhr.status));
              else resolve(d);
            } catch (e) { reject(new Error('Bad server response: ' + xhr.responseText.slice(0, 120))); }
          };
          xhr.send(formData);
        });
      }

      // ── Pass 1: Transcribe (keep original language) ──────────────────────────
      const form1 = new FormData();
      form1.append('file', file, file.name);
      form1.append('task', 'transcribe');

      onProgress(10, 'Pass 1 — transcribing original audio…');
      const original = await doWhisperXHR(form1, 'Uploading for transcription');

      const detectedLang = (original.language || 'en').toLowerCase();
      const isEnglish    = detectedLang === 'en';
      const langName     = LANG_NAMES[detectedLang] || detectedLang.toUpperCase();

      onProgress(55, `Detected: ${langName}${isEnglish ? ' — no translation needed' : ' — translating to English…'}`);

      let translationText = null;

      // ── Pass 2: Translate to English (only if non-English detected) ──────────
      if (!isEnglish) {
        const form2 = new FormData();
        form2.append('file', file, file.name);
        form2.append('task', 'translate');
        onProgress(58, 'Pass 2 — translating to English…');
        try {
          const translated = await doWhisperXHR(form2, 'Uploading for translation');
          translationText  = translated.text || '';
          onProgress(92, 'Translation complete ✓');
        } catch (translErr) {
          console.warn('Translation pass failed:', translErr);
        }
      }

      onProgress(97, 'Building transcript…');

      // ── Assemble final output ────────────────────────────────────────────────
      const dur     = original.duration  ? Math.round(original.duration) + 's' : '';
      const elapsed = original.elapsed_s || '?';

      let output = `[WHISPER EXTRACT: ${file.name}]`;
      output    += `\nLanguage detected: ${langName} (${detectedLang}) · Duration: ${dur} · Transcribed in ${elapsed}s`;
      output    += '\n\n';

      if (!isEnglish && translationText) {
        output += `── Original (${langName}) ──────────────────────\n`;
        output += original.text.trim();
        output += `\n\n── English Translation ──────────────────────\n`;
        output += translationText.trim();
      } else {
        output += original.text.trim();
      }

      return output;
    }

    // Language code → readable name map
    const LANG_NAMES = {
      af:'Afrikaans', ar:'Arabic', hy:'Armenian', az:'Azerbaijani', be:'Belarusian',
      bs:'Bosnian', bg:'Bulgarian', ca:'Catalan', zh:'Chinese', hr:'Croatian',
      cs:'Czech', da:'Danish', nl:'Dutch', en:'English', et:'Estonian',
      fi:'Finnish', fr:'French', gl:'Galician', de:'German', el:'Greek',
      he:'Hebrew', hi:'Hindi', hu:'Hungarian', is:'Icelandic', id:'Indonesian',
      it:'Italian', ja:'Japanese', kn:'Kannada', kk:'Kazakh', ko:'Korean',
      lv:'Latvian', lt:'Lithuanian', mk:'Macedonian', ms:'Malay', mr:'Marathi',
      mi:'Maori', ne:'Nepali', no:'Norwegian', fa:'Persian', pl:'Polish',
      pt:'Portuguese', ro:'Romanian', ru:'Russian', sr:'Serbian', sk:'Slovak',
      sl:'Slovenian', es:'Spanish', sw:'Swahili', sv:'Swedish', tl:'Filipino',
      ta:'Tamil', th:'Thai', tr:'Turkish', uk:'Ukrainian', ur:'Urdu',
      vi:'Vietnamese', cy:'Welsh', yi:'Yiddish'
    };

    // ── ENGINE 2: Gemini AI cloud transcription (free, small files) ──────────────
    async function transcribeWithClaude(file, onProgress) {
      if (!checkApiKey()) throw new Error('No API key set. Cannot transcribe.');

      const isAudio = /\.(mp3|wav|m4a|ogg|flac|aac|opus)$/i.test(file.name);
      const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name);
      if (!isAudio && !isVideo) throw new Error('Unsupported file type.');

      onProgress(10, 'Reading audio data…');

      let audioBlob = file;
      let audioMime = file.type;

      if (isVideo) {
        onProgress(12, 'Extracting audio from video…');
        audioBlob = await extractAudioFromVideo(file, onProgress);
        audioMime = audioBlob.type;
      }

      if (!checkApiKey()) throw new Error('No API key set. Click 🔑 to add your Gemini API key.');
      onProgress(55, 'Encoding audio for Gemini AI…');
      const base64 = await blobToBase64(audioBlob);

      // Normalise MIME for Gemini
      if (!audioMime || audioMime.includes(';')) audioMime = audioMime ? audioMime.split(';')[0] : 'audio/webm';
      const okMimes = ['audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/x-m4a', 'audio/mp4'];
      if (!okMimes.includes(audioMime)) audioMime = 'audio/webm';

      onProgress(65, 'Sending to Gemini AI for transcription…');

      const transcribeBody = {
        contents: [{
          parts: [
            { inline_data: { mime_type: audioMime, data: base64 } },
            { text: 'Transcribe ALL speech from this audio exactly as spoken. Output ONLY the verbatim transcript — no summaries, no headers, no explanations. Use proper punctuation and capitalization.' }
          ]
        }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0 }
      };
      const transcribeUrl = await _resolveGeminiUrl(transcribeBody);
      const res = await fetch(`${transcribeUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transcribeBody)
      });

      onProgress(90, 'Gemini AI processing…');
      const data = await res.json();
      if (data.error) throw new Error('Gemini API: ' + (data.error.message || 'error'));
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
      if (!text) throw new Error('No transcription returned from Gemini.');

      return `[VIDEO EXTRACT: ${file.name}]\n\n${text}`;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────
    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result.split(',')[1]);
        r.onerror = () => reject(new Error('FileReader failed'));
        r.readAsDataURL(blob);
      });
    }

    async function extractAudioFromVideo(file, onProgress) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url; video.muted = false;
        video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
        document.body.appendChild(video);

        video.addEventListener('canplaythrough', () => {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const dest = ctx.createMediaStreamDestination();
            const src = ctx.createMediaElementSource(video);
            src.connect(dest); src.connect(ctx.destination);

            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus' : 'audio/webm';
            const rec = new MediaRecorder(dest.stream, { mimeType: mime });
            const chunks = [];
            rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
            rec.onstop = () => {
              cleanup();
              resolve(new Blob(chunks, { type: mime }));
            };
            rec.start(200);
            video.play();
            video.addEventListener('timeupdate', () => {
              const p = Math.round((video.currentTime / Math.max(video.duration, 1)) * 38);
              onProgress(12 + p, `Extracting audio… ${Math.round(video.currentTime)}s`);
            });
            video.onended = () => setTimeout(() => rec.stop(), 400);
            setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 600000);
          } catch (e) { cleanup(); reject(e); }
        });

        function cleanup() { try { video.pause(); URL.revokeObjectURL(url); video.remove(); } catch (e) { } }
        video.onerror = () => { cleanup(); reject(new Error('Cannot load video file.')); };
        video.load();
      });
    }
    // ═══════════════════════════════════════════════
    //  TRANSCRIPT BLOCK SYSTEM
    // ═══════════════════════════════════════════════
    function addTranscriptBlock(type, source, text) {
      const id = 'blk_' + Date.now();
      transcriptBlocks.push({ id, type, source, text, corrected: null });
      document.getElementById('txPlaceholder').style.display = 'none';
      document.getElementById('fixBtn').disabled = false;
      const container = document.getElementById('txBlocks');
      const block = document.createElement('div');
      block.id = id; block.className = 'tx-block';
      const icon = type === 'video' ? '📹' : '🎙️';
      const now  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Extract metadata sub-line from Whisper header if present
      const lines = text.split('\n');
      let subLine = type === 'video' ? 'Audio extracted' : 'Live recording';
      if (lines.length > 1 && lines[1].startsWith('Language detected:')) {
        subLine = lines[1].trim();
      }

      const renderedText = renderTranscriptText(text);

      block.innerHTML = `
    <div class="tx-source-header">
      <div class="tx-src-icon ${type}">${icon}</div>
      <div class="tx-src-meta">
        <div class="tx-src-name">${escH(source)}</div>
        <div class="tx-src-sub">${now} · ${escH(subLine)}</div>
      </div>
      <div class="tx-src-badge ${type}" id="${id}_badge">${type === 'video' ? 'Video Extract' : 'Live Recording'}</div>
    </div>
    <div class="tx-text" id="${id}_text">${renderedText}</div>`;
      container.appendChild(block);
      document.getElementById('notesScroll').scrollTop = 99999;
      return id;
    }

    // Render transcript: handles plain text AND dual original+translation sections
    function renderTranscriptText(text) {
      const lines  = text.split('\n');
      let bodyStart = 0;
      if (lines[0] && (lines[0].startsWith('[WHISPER') || lines[0].startsWith('[VIDEO'))) bodyStart = 1;
      if (lines[1] && lines[1].startsWith('Language detected:')) bodyStart = 2;
      const body = lines.slice(bodyStart).join('\n').trim();

      // Check for dual sections
      if (/^── Original \(/m.test(body) && /^── English Translation/m.test(body)) {
        const parts    = body.split(/^── (?:Original \([^)]*\)|English Translation)[^\n]*\n/m).filter(p => p.trim());
        const origMatch = body.match(/^── Original \(([^)]+)\)/m);
        const langLabel = origMatch ? origMatch[1] : 'Original';
        const origText  = parts[0] ? parts[0].trim() : '';
        const transText = parts[1] ? parts[1].trim() : '';
        return `<div class="tx-section-label tx-original-label">📝 Original — ${escH(langLabel)}</div>` +
               `<div class="tx-original-text">${escH(origText)}</div>` +
               `<div class="tx-section-label tx-translation-label">🌐 English Translation</div>` +
               `<div class="tx-translation-text">${escH(transText)}</div>`;
      }
      return escH(body);
    }

    // Returns English-only text for Letta AI context (uses translation if available)
    function getEnglishText(fullText) {
      if (!fullText) return '';
      const transMatch = fullText.match(/── English Translation[^\n]*\n([\s\S]*?)(?=── |$)/);
      if (transMatch) return transMatch[1].trim();
      return fullText
        .replace(/\[(?:WHISPER|VIDEO) EXTRACT:[^\]]*\]/g, '')
        .replace(/Language detected:[^\n]*/g, '')
        .replace(/── (?:Original|English Translation)[^\n]*/g, '')
        .trim();
    }

    function getLastBlockId() { return transcriptBlocks.length ? transcriptBlocks[transcriptBlocks.length - 1].id : null; }
    function getAllText() { return transcriptBlocks.map(b => b.corrected || b.text).join('\n\n').trim(); }

    function copyTranscript() {
      const tx = getAllText();
      if (!tx) { showToast('No transcript yet.'); return; }
      navigator.clipboard.writeText(tx).then(() => showToast('Copied to clipboard!')).catch(() => alert(tx));
    }

    function clearTranscript() {
      if (!confirm('Clear all transcript content?')) return;
      transcriptBlocks = []; finalTxStr = ''; notesDone = false;
      document.getElementById('txBlocks').innerHTML = '';
      document.getElementById('txPlaceholder').style.display = 'block';
      document.getElementById('fixBtn').disabled = true;
      stopRec();
    }

    // ═══════════════════════════════════════════════
    //  IMPROVED LIVE SPEECH RECOGNITION
    //  Fixes: continuous restart, word count display,
    //  no-hang approach using chunk-based accumulation
    // ═══════════════════════════════════════════════
    const SR_ENGINE = window.SpeechRecognition || window.webkitSpeechRecognition;

    function toggleRec() { isRec ? stopRec() : startRec(); }

    function startRec() {
      if (!SR_ENGINE) { alert('Use Google Chrome or Edge for live recording.'); return; }
      isRec = true;
      recRestartAttempts = 0;
      finalTxStr = '';
      liveBlockId = null;
      notesDone = false;

      document.getElementById('recBtn').classList.add('on');
      document.getElementById('recBtnTxt').textContent = 'Stop Recording';
      document.getElementById('txPlaceholder').style.display = 'none';
      document.getElementById('fixBtn').disabled = false;
      document.getElementById('recStatusBar').classList.add('visible');
      startWave();

      liveBlockId = addTranscriptBlock('mic', 'Live Recording', '');
      // Change badge to live
      const badge = document.getElementById(liveBlockId + '_badge');
      if (badge) { badge.className = 'tx-src-badge live'; badge.textContent = '🔴 LIVE'; }

      _spawnRecognition();
    }

    function _spawnRecognition() {
      if (!isRec) return;
      clearTimeout(recRestartTimer);

      try { if (recog) { recog.abort(); recog = null; } } catch (e) { }

      recog = new SR_ENGINE();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';
      recog.maxAlternatives = 1;

      recog.onstart = () => { recRestartAttempts = 0; };

      recog.onresult = (e) => {
        if (!e || !e.results) return;
        let interimText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (!r || !r[0]) continue;
          const t = r[0].transcript;
          if (typeof t !== 'string') continue;

          if (r.isFinal) {
            // Append finalized text (add a space between chunks)
            finalTxStr += (finalTxStr && !finalTxStr.endsWith(' ') ? ' ' : '') + t.trim();
            // Update block
            if (liveBlockId) {
              const block = transcriptBlocks.find(b => b.id === liveBlockId);
              const el = document.getElementById(liveBlockId + '_text');
              if (el) el.textContent = finalTxStr;
              if (block) block.text = finalTxStr;
            }
            // Update word count
            const wc = finalTxStr.trim().split(/\s+/).filter(w => w.length > 0).length;
            const wcel = document.getElementById('recWordCount');
            if (wcel) wcel.textContent = wc + ' words';

            // Auto-generate notes after enough words
            if (wc > 30 && !notesDone) {
              notesDone = true;
              setTimeout(() => generateNotes(getAllText()), 1200);
            }
          } else {
            interimText = t;
          }
        }

        // Show interim text with italic styling
        if (liveBlockId && interimText) {
          const el = document.getElementById(liveBlockId + '_text');
          if (el) el.innerHTML = escH(finalTxStr) + `<span style="color:var(--t2);font-style:italic;opacity:.55"> ${escH(interimText)}</span>`;
        }
        document.getElementById('notesScroll').scrollTop = 99999;
      };

      recog.onerror = (e) => {
        const err = e ? e.error : '';
        if (err === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone in browser settings.');
          isRec = false;
          _resetRecUI();
          return;
        }
        if (err === 'no-speech' || err === 'audio-capture' || err === 'network') {
          // These are transient — let onend handle restart
          return;
        }
        console.warn('Speech recognition error:', err);
      };

      recog.onend = () => {
        if (!isRec) return; // Stopped by user
        // Auto-restart to prevent hanging
        recRestartAttempts++;
        const delay = Math.min(300 * recRestartAttempts, 1500); // backoff up to 1.5s
        recRestartTimer = setTimeout(() => {
          if (isRec) _spawnRecognition();
        }, delay);
      };

      try {
        recog.start();
      } catch (ex) {
        console.error('Failed to start recognition:', ex);
        if (isRec) {
          recRestartTimer = setTimeout(() => { if (isRec) _spawnRecognition(); }, 800);
        }
      }
    }

    function stopRec() {
      isRec = false;
      clearTimeout(recRestartTimer);
      try { if (recog) { recog.abort(); recog = null; } } catch (e) { }
      _resetRecUI();

      // Finalize badge
      if (liveBlockId) {
        const badge = document.getElementById(liveBlockId + '_badge');
        if (badge) { badge.className = 'tx-src-badge mic'; badge.textContent = 'Live Recording'; }
      }
    }

    function _resetRecUI() {
      const btn = document.getElementById('recBtn');
      if (btn) btn.classList.remove('on');
      const txt = document.getElementById('recBtnTxt');
      if (txt) txt.textContent = 'Start Recording';
      const bar = document.getElementById('recStatusBar');
      if (bar) bar.classList.remove('visible');
      stopWave();
    }

    // ═══════════════════════════════════════════════
    //  WAVEFORM (canvas-style with RAF for smoothness)
    // ═══════════════════════════════════════════════
    function buildWave() {
      const wf = document.getElementById('waveform');
      wf.innerHTML = '';
      for (let i = 0; i < 28; i++) {
        const b = document.createElement('div');
        b.className = 'wbar';
        wf.appendChild(b);
      }
    }
    function startWave() {
      buildWave();
      document.getElementById('waveform').classList.add('live');
      document.getElementById('audioWait').style.display = 'none';
      document.getElementById('audioLbl').style.display = 'block';
      document.getElementById('audioLbl').textContent = '🎙️ Live microphone';

      let phase = 0;
      function animate() {
        if (!isRec) { stopWave(); return; }
        phase += 0.12;
        document.querySelectorAll('.wbar').forEach((b, i) => {
          const h = 3 + Math.abs(Math.sin(phase + i * 0.35)) * 22 + Math.random() * 4;
          b.style.height = h + 'px';
          b.style.opacity = 0.4 + Math.abs(Math.sin(phase + i * 0.2)) * 0.6;
        });
        waveAnimFrame = requestAnimationFrame(animate);
      }
      if (waveAnimFrame) cancelAnimationFrame(waveAnimFrame);
      animate();
    }
    function stopWave() {
      if (waveAnimFrame) { cancelAnimationFrame(waveAnimFrame); waveAnimFrame = null; }
      clearInterval(waveInt);
      const wf = document.getElementById('waveform');
      if (wf) { wf.classList.remove('live'); wf.innerHTML = ''; }
      const aw = document.getElementById('audioWait');
      if (aw) aw.style.display = 'flex';
      const al = document.getElementById('audioLbl');
      if (al) al.style.display = 'none';
    }

    // ═══════════════════════════════════════════════
    //  GEMINI API  (free — aistudio.google.com/apikey)
    // ═══════════════════════════════════════════════
    // Auto-selects the best available model for your API key.
    // Tries each candidate in order until one succeeds.
    const GEMINI_CANDIDATES = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent',
    ];
    // Cache the working URL so we don't re-probe on every request
    let _geminiUrl = localStorage.getItem('recallme_gemini_url') || null;
    let _geminiModel = localStorage.getItem('recallme_gemini_model') || null;

    function _handleGeminiError(data) {
      const err = data.error;
      const msg = err?.message || 'Gemini API error';
      if (err?.status === 'PERMISSION_DENIED' || msg.includes('API_KEY') || msg.includes('API key not valid') || msg.includes('401')) {
        throw new Error('INVALID_KEY');
      }
      if (msg.includes('not found') || msg.includes('not supported') || msg.includes('deprecated') || err?.status === 'NOT_FOUND') {
        throw new Error('MODEL_NOT_FOUND');
      }
      throw new Error(msg);
    }

    async function _geminiPost(url, body) {
      const res = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return res.json();
    }

    // Find a working model URL, caching result in localStorage
    async function _resolveGeminiUrl(testBody) {
      // Try cached URL first
      if (_geminiUrl) {
        const data = await _geminiPost(_geminiUrl, testBody);
        if (!data.error) return _geminiUrl;
        if (data.error?.status === 'PERMISSION_DENIED' || (data.error?.message || '').includes('API key')) {
          throw new Error('INVALID_KEY');
        }
        // Cached model no longer works — clear and re-probe
        _geminiUrl = null; _geminiModel = null;
        localStorage.removeItem('recallme_gemini_url');
        localStorage.removeItem('recallme_gemini_model');
      }
      // Probe all candidates
      for (const url of GEMINI_CANDIDATES) {
        const data = await _geminiPost(url, testBody);
        if (!data.error) {
          _geminiUrl = url;
          _geminiModel = url.match(/models\/([^:]+)/)?.[1] || 'gemini';
          localStorage.setItem('recallme_gemini_url', url);
          localStorage.setItem('recallme_gemini_model', _geminiModel);
          return url;
        }
        if (data.error?.status === 'PERMISSION_DENIED' || (data.error?.message || '').includes('API key')) {
          throw new Error('INVALID_KEY');
        }
        // else: model not found, try next
      }
      throw new Error('NO_MODEL');
    }

    function _geminiUserError(code) {
      if (code === 'INVALID_KEY') return 'Invalid or expired API key. Click 🔑 in the top bar and paste a fresh key from aistudio.google.com/apikey';
      if (code === 'NO_MODEL') return 'No compatible Gemini model found for your API key. Make sure your key is active at aistudio.google.com/apikey';
      return code;
    }

    // Simple single-turn call — notes, grammar, etc.
    async function callClaude(system, userMsg, maxTokens = 1200) {
      const body = {
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 }
      };
      const url = await _resolveGeminiUrl(body);
      const data = await _geminiPost(url, body);
      if (data.error) _handleGeminiError(data);
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
      if (!text) throw new Error('Empty response from Gemini. Try again.');
      return text;
    }

    // Conversational call WITH Google Search grounding + full chat history
    async function callClaudeWithSearch(system, userMsg, maxTokens = 2000) {
      const contents = [];
      for (const h of hist) {
        contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
      }
      contents.push({ role: 'user', parts: [{ text: userMsg }] });

      const baseBody = {
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
      };

      // Resolve working model URL
      const url = await _resolveGeminiUrl(baseBody);

      // Try with Google Search grounding first
      const bodyWithSearch = {
        ...baseBody,
        tools: [{ google_search_retrieval: { dynamic_retrieval_config: { mode: 'MODE_DYNAMIC', dynamic_threshold: 0.3 } } }]
      };

      let data = await _geminiPost(url, bodyWithSearch);

      // If grounding not supported for this model/region, retry without it
      if (data.error) {
        data = await _geminiPost(url, baseBody);
      }

      if (data.error) _handleGeminiError(data);

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map(p => p.text || '').join('').trim();
      if (!text) throw new Error('Empty response from Gemini. Try again.');
      const usedSearch = !!(candidate?.groundingMetadata?.webSearchQueries?.length);
      return { text, usedSearch };
    }

    // ═══════════════════════════════════════════════
    //  AUTO NOTES GENERATION
    // ═══════════════════════════════════════════════
    async function generateNotes(tx) {
      if (!apiKey) { smartFallback(tx); return; } // no key → use local fallback silently
      hideEmpty();
      const tid = addTyping();
      try {
        const answer = await callClaude(
          `You are Letta, an intelligent AI note-taking assistant inside RecallMe, a lecture transcription app.
Analyze the transcript and produce smart structured study notes.
Respond ONLY with valid JSON, no markdown fences:
{"sections":[{"title":"Section Title","points":["concise paraphrased point max 12 words"]}]}

Rules:
- 3-5 thematic sections based on ACTUAL content
- Each point: max 12 words, must PARAPHRASE (never copy raw text verbatim)
- Ignore grammar errors in transcript — extract the MEANING
- Smart section titles: "Key Concepts", "How It Works", "Platform Features", "Student Questions", "Important Points", "Action Items"
- Do not include [VIDEO EXTRACT:...] header in your analysis`,
          `Analyze this transcript:\n"${getEnglishText(tx)}"`
        );
        removeEl(tid);
        const match = answer.replace(/```json\n?/g, '').replace(/```\n?/g, '').match(/\{[\s\S]*\}/);
        if (match) { try { renderNotes(JSON.parse(match[0]).sections); } catch (e) { smartFallback(tx); } }
        else smartFallback(tx);
      } catch (e) { removeEl(tid); smartFallback(tx); }
    }

    function renderNotes(sections) {
      if (!sections || !sections.length) return;
      const p = document.getElementById('chatScroll');
      const card = document.createElement('div'); card.className = 'letta-card';
      let html = `<div class="letta-tag"><div class="ldot"></div>Auto-Generated Notes</div>`;
      sections.forEach(s => {
        if (!s.points || !s.points.length) return;
        html += `<div class="notes-sec"><div class="nsec-title">${escH(s.title)}</div><ul class="nsec-ul">${s.points.map(pt => `<li>${escH(pt)}</li>`).join('')}</ul></div>`;
      });
      card.innerHTML = html;
      p.appendChild(card); p.scrollTop = 99999;
    }

    function smartFallback(tx) {
      const clean = tx.replace(/\[VIDEO EXTRACT:[^\]]*\]/g, '');
      const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
      const trim = s => { const w = s.split(/\s+/); return w.length > 12 ? w.slice(0, 12).join(' ') + '...' : s; };
      const features = sentences.filter(s => /platform|works|streaming|transcribed|notes|compile|real.?time|recording|audio|video/.test(s.toLowerCase())).slice(0, 3);
      const questions = sentences.filter(s => /what|how|why|where|when|can i|could|should|\?/.test(s.toLowerCase())).slice(0, 3);
      const general = sentences.filter(s => !features.includes(s) && !questions.includes(s)).slice(0, 4);
      const sections = [];
      if (features.length) sections.push({ title: 'Platform Features', points: features.map(trim) });
      if (general.length) sections.push({ title: 'Key Points', points: general.map(trim) });
      if (questions.length) sections.push({ title: 'Questions Raised', points: questions.map(trim) });
      if (!sections.length) sections.push({ title: 'Lecture Notes', points: sentences.slice(0, 5).map(trim) });
      renderNotes(sections);
    }

    // ═══════════════════════════════════════════════
    //  INTELLIGENT CHAT — with web search via Claude
    // ═══════════════════════════════════════════════
    function quickAsk(q) { document.getElementById('chatIn').value = q; sendChat(); }
    // alias kept for any inline onclick refs

    async function sendChat() {
      const inp = document.getElementById('chatIn');
      const q = inp.value.trim(); if (!q || busy) return;
      if (!checkApiKey()) return; // prompt for API key if missing
      hideEmpty(); addMsg('user', q); inp.value = '';
      const tx = getAllText();
      const tid = addTyping(); busy = true;
      document.getElementById('sendBtn').disabled = true;

      const sys = buildLettaSystemPrompt(tx);

      try {
        const result = await callClaudeWithSearch(sys, q, 2000);
        const answer = result.text || '';
        const usedSearch = result.usedSearch || false;
        removeEl(tid);
        addMsg('ai', answer, usedSearch);
        // Store history AFTER successful response
        hist.push({ role: 'user', content: q });
        hist.push({ role: 'assistant', content: answer });
        // Keep history bounded to last 10 exchanges (20 entries)
        if (hist.length > 20) hist.splice(0, hist.length - 20);
      } catch (e) {
        removeEl(tid);
        console.error('Letta API error:', e);
        let errMsg;
        if (e.message === 'INVALID_KEY') {
          errMsg = '**Invalid or expired API key.**\n\nClick 🔑 in the top bar, clear the old key, and paste a new one from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).\n\nMake sure there are no extra spaces when pasting.';
        } else if (e.message === 'NO_MODEL') {
          errMsg = '**No compatible model found.**\n\nYour API key may be restricted. Try generating a fresh key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).';
        } else if (e.message.includes('quota') || e.message.includes('RESOURCE_EXHAUSTED')) {
          errMsg = '**Rate limit reached.**\n\nYou have hit the free tier limit (15 requests/min). Wait a minute and try again.';
        } else if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed')) {
          errMsg = '**Network error.**\n\nCheck your internet connection and try again.';
        } else {
          errMsg = `**Letta could not respond.**\n\n${e.message}`;
        }
        addMsg('ai', `⚠️ ${errMsg}`);
      }

      busy = false;
      document.getElementById('sendBtn').disabled = false;
      document.getElementById('chatIn').focus();
    }

    function buildLettaSystemPrompt(tx) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const cleanTx = tx ? getEnglishText(tx) : '';
      return `You are Letta, an expert AI study assistant inside RecallMe — a real-time lecture transcription and note-taking app. Today's date is ${today}.

${cleanTx
  ? `## CURRENT SESSION TRANSCRIPT (your primary source of truth)
---
${cleanTx.substring(0, 4000)}
---

You MUST base your answers on the transcript above. When the user asks about the lecture content, topics, or recording — always refer to this transcript.`
  : `No transcript yet. Answer from your general knowledge and web search.`}

## YOUR CAPABILITIES
You can do everything the user asks, including:
- **Create structured notes** — organized by topic, with headings, bullet points, and key definitions
- **Summarize** — concise overview of the most important points
- **Explain any topic** — from the transcript or general knowledge, with detailed explanations
- **List topics** — enumerate all subjects covered in the lecture
- **Fix grammar** — clean up speech-to-text errors in the transcript
- **Quiz me** — generate practice questions with answers based on the lecture
- **Key points / takeaways** — highlight the most critical information
- **Deep dive** — provide thorough explanations of any concept mentioned
- **Compare concepts** — relate topics from the lecture to each other or to broader knowledge
- **Answer any question** — about the lecture, about related topics, or general questions

## RESPONSE STYLE
- Use **bold** for key terms and headings
- Use bullet points and numbered lists for clarity
- For notes: use clear sections with ## headings
- For explanations: be thorough and educational
- For summaries: be concise but complete
- For quizzes: provide questions AND answers
- Match response length to the request — detailed for notes/explanations, brief for quick answers
- Be accurate, helpful, and study-focused`;
    }

    // ═══════════════════════════════════════════════
    //  LOCAL FALLBACK ANSWERS (when API is unavailable)
    // ═══════════════════════════════════════════════
    function localAnswer(q, tx) {
      const ql = q.toLowerCase();
      const clean = tx ? tx.replace(/\[VIDEO EXTRACT:[^\]]*\]/g, '') : '';
      const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
      const trim = s => { const w = s.split(/\s+/); return w.length > 10 ? w.slice(0, 10).join(' ') + '...' : s; };

      if (!clean.trim()) return `No transcript yet! Start recording or upload a video — I'll then answer your questions intelligently from the lecture content, and I can also search the web for more information.`;
      if (/grammar|spell|fix|correct/i.test(ql)) {
        const fixed = localGrammarFix(clean);
        const lastId = getLastBlockId();
        if (lastId) {
          const block = transcriptBlocks.find(b => b.id === lastId), el = document.getElementById(lastId + '_text'), badge = document.getElementById(lastId + '_badge');
          if (block && el) { block.corrected = fixed; el.textContent = fixed; }
          if (badge) { badge.className = 'tx-src-badge fixed'; badge.textContent = 'Grammar Fixed ✓'; }
        }
        return `✅ **Grammar fixed!** Applied corrections:\n- Missing apostrophes (don't, I'm, it's)\n- Sentence capitalization\n- Common speech-to-text errors\n- Punctuation`;
      }
      if (/summar|overview|recap/i.test(ql)) return `**Summary:**\n\n${sentences.slice(0, 5).map(s => `- ${trim(s)}`).join('\n')}`;
      if (/note|bullet|key point|important/i.test(ql)) return `**Key notes:**\n\n${sentences.slice(0, 6).map((s, i) => `${i + 1}. ${trim(s)}`).join('\n')}`;
      if (/quiz|question|test|practice/i.test(ql)) return `**Practice questions:**\n\n${sentences.filter(s => s.length > 20).slice(0, 4).map((s, i) => `**Q${i + 1}.** What is meant by: *"${s.substring(0, 50)}..."*`).join('\n\n')}`;

      const stopwords = new Set(['what', 'how', 'the', 'is', 'are', 'was', 'were', 'did', 'a', 'an', 'it', 'this', 'that', 'i', 'my', 'me', 'and', 'or', 'of', 'in', 'to', 'for', 'with', 'about', 'can', 'tell', 'give', 'make', 'please']);
      const keywords = ql.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));
      const relevant = sentences.map(s => ({ s, score: keywords.filter(k => s.toLowerCase().includes(k)).length })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.s);
      if (relevant.length) return `**From your transcript:**\n\n${relevant.map(s => `- ${s}`).join('\n')}`;
      return `I couldn't find "${keywords.slice(0, 2).join(', ')}" in your transcript. Try: **"Summarize"** · **"Create notes"** · **"Fix grammar"** · **"Quiz me"** · **"Search the web for [topic]"**`;
    }

    // ═══════════════════════════════════════════════
    //  GRAMMAR CORRECTION
    // ═══════════════════════════════════════════════
    async function correctGrammar() {
      if (!checkApiKey()) return;
      const btn = document.getElementById('fixBtn');
      btn.disabled = true; btn.textContent = '⏳ Fixing...';
      const tx = getAllText();
      if (!tx || tx.length < 10) { btn.disabled = false; btn.textContent = '✏️ Fix Grammar'; return; }
      try {
        const fixed = await callClaude(
          `You are a grammar and spelling correction specialist.
RULES:
- Fix ALL grammar, spelling, punctuation and capitalization errors
- Fix contractions: im→I'm, dont→don't, cant→can't, its→it's, ive→I've, id→I'd etc.
- Capitalize every sentence start and the word "I"
- Add missing periods, commas, apostrophes
- Do NOT change meaning or rephrase — only fix language errors
- Keep [VIDEO EXTRACT: ...] header lines exactly as-is
- Return ONLY the corrected text, no explanation`,
          `Fix grammar:\n\n${tx}`, 1500
        );
        const lastId = getLastBlockId();
        if (lastId) {
          const block = transcriptBlocks.find(b => b.id === lastId);
          const el = document.getElementById(lastId + '_text');
          const badge = document.getElementById(lastId + '_badge');
          if (block && el) { block.corrected = fixed; el.textContent = fixed; }
          if (badge) { badge.className = 'tx-src-badge fixed'; badge.textContent = 'Grammar Fixed ✓'; }
        }
        hideEmpty();
        addMsg('ai', `✅ **Grammar corrected!**\n\nI fixed:\n- Missing apostrophes (don't, I'm, it's, we're)\n- Sentence capitalization\n- Punctuation and periods\n- Common speech-to-text errors\n\nThe corrected text is now showing in the Notes panel.`);
      } catch (e) {
        const fixed = localGrammarFix(tx);
        const lastId = getLastBlockId();
        if (lastId) {
          const block = transcriptBlocks.find(b => b.id === lastId);
          const el = document.getElementById(lastId + '_text');
          const badge = document.getElementById(lastId + '_badge');
          if (block && el) { block.corrected = fixed; el.textContent = fixed; }
          if (badge) { badge.className = 'tx-src-badge fixed'; badge.textContent = 'Grammar Fixed ✓'; }
        }
        hideEmpty();
        addMsg('ai', '✅ **Grammar fixed locally.** Basic corrections applied — apostrophes, capitalization, and punctuation corrected.');
      }
      btn.disabled = false; btn.textContent = '✏️ Fix Grammar';
    }

    function localGrammarFix(text) {
      let t = text;
      const map = {
        '\\bim\\b': "I'm", '\\bdont\\b': "don't", '\\bcant\\b': "can't", '\\bwont\\b': "won't",
        '\\bive\\b': "I've", '\\bid\\b': "I'd", '\\bill\\b': "I'll", '\\byoure\\b': "you're",
        '\\btheyre\\b': "they're", '\\bcouldnt\\b': "couldn't", '\\bwouldnt\\b': "wouldn't",
        '\\bshouldnt\\b': "shouldn't", '\\bdoesnt\\b': "doesn't", '\\bhasnt\\b': "hasn't",
        '\\bhavent\\b': "haven't", '\\bwasnt\\b': "wasn't", '\\bthats\\b': "that's",
        '\\bwhats\\b': "what's", '\\bheres\\b': "here's", '\\btheres\\b': "there's",
        '\\bits the\\b': "it's the", '\\bits a\\b': "it's a", '\\bits been\\b': "it's been"
      };
      Object.entries(map).forEach(([p, r]) => { t = t.replace(new RegExp(p, 'gi'), r); });
      t = t.replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
      t = t.replace(/\bi\b/g, 'I');
      t = t.trim();
      if (t && !'.!?'.includes(t[t.length - 1])) t += '.';
      return t;
    }

    // ═══════════════════════════════════════════════
    //  LIBRARY CARD
    // ═══════════════════════════════════════════════
    const CARD_EMOJIS = ['🎓', '📘', '🔬', '💡', '🧠', '📡', '🎤', '📽️', '🖥️', '⚗️'];
    function addLibraryCard(title, type, source) {
      const grid = document.getElementById('lectureGrid');
      const c = document.createElement('div');
      c.className = 'lecture-card';
      c.onclick = () => openSession(title, type, source);
      const emoji = CARD_EMOJIS[Math.floor(Math.random() * CARD_EMOJIS.length)];
      const short = title.length > 22 ? title.substring(0, 20) + '…' : title;
      c.innerHTML = `
    <div class="lc-thumb" style="flex-direction:column;gap:6px">
      <div style="font-size:36px">${emoji}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.45);text-align:center;padding:0 8px;line-height:1.3">${short}</div>
      <div class="lc-play">▶</div>
    </div>
    <div class="lc-badge">${type === 'video' ? '📹' : '🎙️'} ${type === 'video' ? 'Video' : 'Audio'}</div>
    <div class="lc-info">
      <div class="lc-title">${title}</div>
      <div class="lc-date">Just added</div>
    </div>`;
      grid.appendChild(c);
      updateLibCount();
    }
    function updateLibCount() {
      const count = document.getElementById('lectureGrid').children.length;
      document.getElementById('libCount').textContent = count + (count === 1 ? ' lecture' : ' lectures');
    }
    function startRecordSession() {
      closeModal('modal-record');
      openSession('Live Recording', 'mic', '');
      setTimeout(startRec, 400);
    }

    // ═══════════════════════════════════════════════
    //  UI HELPERS
    // ═══════════════════════════════════════════════
    function hideEmpty() {
      const e = document.getElementById('chatEmpty');
      if (e) e.style.display = 'none';
    }
    function addMsg(role, text, usedSearch = false) {
      const p = document.getElementById('chatScroll');
      const d = document.createElement('div'); d.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
      const w = document.createElement('div'); w.className = 'msg-who'; w.textContent = role === 'user' ? 'You' : 'Letta';
      const b = document.createElement('div'); b.className = 'msg-b';

      let content = '';
      if (role === 'ai' && usedSearch) {
        content = `<div class="search-badge"><div class="search-dot"></div>Web search used</div>`;
      }
      content += role === 'ai' ? renderMd(text) : escH(text);
      b.innerHTML = content;
      d.appendChild(w); d.appendChild(b); p.appendChild(d); p.scrollTop = 99999;
    }
    function addTyping() {
      const p = document.getElementById('chatScroll');
      const id = 'ty_' + Date.now();
      const d = document.createElement('div'); d.id = id; d.className = 'msg ai';
      const w = document.createElement('div'); w.className = 'msg-who'; w.textContent = 'Letta';
      const t = document.createElement('div'); t.className = 'typing-row';
      t.innerHTML = '<div class="td"></div><div class="td"></div><div class="td"></div>';
      d.appendChild(w); d.appendChild(t); p.appendChild(d); p.scrollTop = 99999;
      return id;
    }
    function removeEl(id) { const e = document.getElementById(id); if (e) e.remove(); }
    function escH(t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function renderMd(t) {
      let s = t;
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>');
      s = s.replace(/\*([^*\n]+?)\*/g, '<em style="color:var(--t2)">$1</em>');
      s = s.replace(new RegExp('\x60([^\x60]+)\x60', 'g'), '<code style="background:rgba(79,163,224,0.12);color:var(--note);padding:1px 5px;border-radius:3px;font-size:11.5px">$1</code>');
      const lines = s.split('\n'); const out = []; let inList = false;
      for (const l of lines) {
        const isBullet = /^[-•*]\s+/.test(l), isNum = /^\d+\.\s+/.test(l);
        if (isBullet || isNum) {
          if (!inList) { out.push('<ul style="list-style:none;padding:0;margin:7px 0">'); inList = true; }
          const c = l.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '');
          out.push(`<li style="padding-left:17px;position:relative;margin-bottom:5px;color:var(--t2)"><span style="position:absolute;left:0;color:var(--note);font-size:9px;top:4px">●</span>${c}</li>`);
        } else {
          if (inList) { out.push('</ul>'); inList = false; }
          if (!l.trim()) out.push('<div style="height:5px"></div>');
          else out.push(`<p style="margin-bottom:5px;line-height:1.7">${l}</p>`);
        }
      }
      if (inList) out.push('</ul>');
      return out.join('');
    }
    function showToast(msg) {
      const t = document.getElementById('_toast');
      t.textContent = msg; t.style.opacity = '1';
      clearTimeout(t._t); t._t = setTimeout(() => t.style.opacity = '0', 2200);
    }
    buildWave();
