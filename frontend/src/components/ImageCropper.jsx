import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';

export const DEFAULT_FRAME_W = 800;
export const DEFAULT_FRAME_H = 400;
const MAX_CLIENT_BYTES = 2 * 1024 * 1024; // requirement: < 2MB

function createImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = src;
  });
}

async function renderCroppedBlob({
  imageSrc,
  croppedAreaPixels,
  outW,
  outH,
  fileType = 'image/jpeg',
  quality = 0.85,
}) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  // Draw the selected crop area scaled into the fixed output frame.
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outW,
    outH
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      fileType,
      quality
    );
  });
}

function renderCroppedDataUrl({ imageSrc, croppedAreaPixels, outW, outH }) {
  return new Promise(async (resolve) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      outW,
      outH
    );
    resolve(canvas.toDataURL('image/jpeg', 0.85));
  });
}

export default function ImageCropper({ onBlobReady, disabled }) {
  const fileRef = useRef(null);
  const [error, setError] = useState('');

  const [imageSrc, setImageSrc] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [frameW, setFrameW] = useState(DEFAULT_FRAME_W);
  const [frameH, setFrameH] = useState(DEFAULT_FRAME_H);
  const [lockAspect, setLockAspect] = useState(true); // always lock to keep a fixed, non-removable frame

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const cropperWrapRef = useRef(null);
  const [cropSize, setCropSize] = useState(null);
  const [wrapDims, setWrapDims] = useState({ w: 0, h: 0 });
  const resizeRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [finalBlob, setFinalBlob] = useState(null);
  const [editorBusy, setEditorBusy] = useState(false);

  // IMPORTANT: do not force an aspect ratio from frameW/frameH.
  // We want width/height to work independently, so the crop rectangle size is controlled by `cropSize`.
  const aspect = undefined;

  // Compute a fixed crop selection box size.
  // Width and height are clamped independently so resizing one dimension doesn't automatically recompute the other.
  useEffect(() => {
    if (!cropperWrapRef.current) return;
    const update = () => {
      const el = cropperWrapRef.current;
      const cw = el.clientWidth || 800;
      const ch = el.clientHeight || 420;
      setWrapDims({ w: cw, h: ch });
      const maxW = cw * 0.92;
      const maxH = ch * 0.92;

      const minW = 300;
      const minH = 150;
      const w = Math.min(maxW, Math.max(minW, frameW));
      const h = Math.min(maxH, Math.max(minH, frameH));

      // react-easy-crop expects integers for cropSize
      setCropSize({ width: Math.round(w), height: Math.round(h) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [frameW, frameH]);

  const resetAll = useCallback(() => {
    setError('');
    setImageSrc(null);
    setIsEditorOpen(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewUrl(null);
    setFinalBlob(null);
    onBlobReady(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [onBlobReady]);

  const pickCursor = useCallback(
    (clientX, clientY) => {
      const wrap = cropperWrapRef.current;
      if (!wrap || !cropSize) return 'move';

      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Current crop frame bounds (centered inside the wrapper).
      const frameLeft = (rect.width - cropSize.width) / 2;
      const frameRight = frameLeft + cropSize.width;
      const frameTop = (rect.height - cropSize.height) / 2;
      const frameBottom = frameTop + cropSize.height;

      const tol = 10; // pixels from the edge to treat it as "resize edge"

      const nearLeft = Math.abs(x - frameLeft) <= tol;
      const nearRight = Math.abs(x - frameRight) <= tol;
      const nearTop = Math.abs(y - frameTop) <= tol;
      const nearBottom = Math.abs(y - frameBottom) <= tol;

      // Corners first (diagonal cursors)
      if (nearLeft && nearTop) return 'nwse-resize';
      if (nearRight && nearBottom) return 'nwse-resize';
      if (nearRight && nearTop) return 'nesw-resize';
      if (nearLeft && nearBottom) return 'nesw-resize';

      // Edges (vertical/horizontal)
      if (nearLeft || nearRight) return 'ew-resize';
      if (nearTop || nearBottom) return 'ns-resize';

      return 'move';
    },
    [cropSize]
  );

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const startResize = useCallback(
    (handle, e) => {
      if (disabled) return;
      if (!cropperWrapRef.current) return;
      if (!cropSize) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = frameW;
      const startH = frameH;

      resizeRef.current = { handle, startX, startY, startW, startH, pointerId: e.pointerId };
      setIsResizing(true);

      // Capturing pointer prevents Cropper from stealing the drag while resizing.
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [disabled, cropSize, frameW, frameH]
  );

  useEffect(() => {
    function onMove(e) {
      const st = resizeRef.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;

      let nextW = st.startW;
      let nextH = st.startH;

      const minW = 300;
      const maxW = 1600;
      const minH = 150;
      const maxH = 1200;

      const h = st.handle;
      if (h === 'left') nextW = st.startW - dx;
      if (h === 'right') nextW = st.startW + dx;
      if (h === 'top') nextH = st.startH - dy;
      if (h === 'bottom') nextH = st.startH + dy;

      if (h === 'topLeft') {
        nextW = st.startW - dx;
        nextH = st.startH - dy;
      }
      if (h === 'topRight') {
        nextW = st.startW + dx;
        nextH = st.startH - dy;
      }
      if (h === 'bottomLeft') {
        nextW = st.startW - dx;
        nextH = st.startH + dy;
      }
      if (h === 'bottomRight') {
        nextW = st.startW + dx;
        nextH = st.startH + dy;
      }

      nextW = clamp(nextW, minW, maxW);
      nextH = clamp(nextH, minH, maxH);

      setFrameW(nextW);
      setFrameH(nextH);

      // After changing frame size, the crop selection should be regenerated by the user.
      setCroppedAreaPixels(null);
      setPreviewUrl(null);
      setFinalBlob(null);
      onBlobReady(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }

    function onUp() {
      resizeRef.current = null;
      setIsResizing(false);
      // No further action; user will pick crop again.
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handles = (() => {
    if (!cropSize || !wrapDims.w || !wrapDims.h) return null;
    const frameLeft = Math.max(0, (wrapDims.w - cropSize.width) / 2);
    const frameTop = Math.max(0, (wrapDims.h - cropSize.height) / 2);
    const frameRight = frameLeft + cropSize.width;
    const frameBottom = frameTop + cropSize.height;

    const t = 12; // handle thickness

    return {
      frameLeft,
      frameTop,
      frameRight,
      frameBottom,
      t,
    };
  })();

  const onFileSelected = useCallback(
    (file) => {
      setError('');
      onBlobReady(null);
      setFinalBlob(null);
      setPreviewUrl(null);
      setCroppedAreaPixels(null);

      if (!file) return;
      if (!file.type?.startsWith('image/')) {
        setError('Please choose an image file.');
        return;
      }
      if (file.size > MAX_CLIENT_BYTES) {
        setError('Image is too large. Please upload an image smaller than 2MB.');
        return;
      }

      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setIsEditorOpen(true);
    },
    [onBlobReady]
  );

  // Live preview (debounced)
  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels || !previewLoading) {
      // previewLoading is false initially; we still debounce by using a flag below.
    }
    if (!imageSrc || !croppedAreaPixels) return;

    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const dataUrl = await renderCroppedDataUrl({
          imageSrc,
          croppedAreaPixels,
          outW: frameW,
          outH: frameH,
        });
        if (!cancelled) setPreviewUrl(dataUrl);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [imageSrc, croppedAreaPixels, frameW, frameH]);

  const confirm = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) {
      setError('Please complete the crop selection first.');
      return;
    }
    setEditorBusy(true);
    setError('');
    try {
      const blob = await renderCroppedBlob({
        imageSrc,
        croppedAreaPixels,
        outW: frameW,
        outH: frameH,
        fileType: 'image/jpeg',
        quality: 0.85,
      });
      if (!blob) throw new Error('Could not render image');

      // Replace preview with an upload-ready blob URL.
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      const blobUrl = URL.createObjectURL(blob);

      setFinalBlob(blob);
      setPreviewUrl(blobUrl);
      onBlobReady(blob);
      setIsEditorOpen(false);
    } catch (e) {
      setError(e?.message || 'Failed to generate cropped image');
      setFinalBlob(null);
      onBlobReady(null);
    } finally {
      setEditorBusy(false);
    }
  }, [croppedAreaPixels, frameH, frameW, imageSrc, onBlobReady, previewUrl]);

  const resetCropOnly = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewUrl(null);
    setFinalBlob(null);
    onBlobReady(null);
    setError('');
  }, [onBlobReady]);

  return (
    <div className="image-cropper">
      <label className="meta">
        Cover image (crop + resize on the client). Output frame: {frameW}×{frameH}.
      </label>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(e) => onFileSelected(e.target.files?.[0])}
      />

      {error && (
        <p className="alert alert-error" style={{ marginTop: '0.5rem' }}>
          {error}
        </p>
      )}

      {previewUrl && (
        <div className="crop-preview">
          <img src={previewUrl} alt="Cover preview" />
          <p className="meta" style={{ marginTop: '0.5rem' }}>
            {previewLoading ? 'Processing…' : 'Preview ready'} ({frameW}×{frameH})
          </p>
          <div className="row-actions" style={{ paddingTop: 0 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsEditorOpen(true)}>
              Re-edit
            </button>
            <button type="button" className="btn" onClick={resetAll}>
              Reset
            </button>
          </div>
        </div>
      )}

      {isEditorOpen && imageSrc && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                Edit cover image
              </h2>
              <button type="button" className="btn btn-ghost" onClick={() => setIsEditorOpen(false)}>
                Close
              </button>
            </div>

            <div className="modal-body crop-modal-body">
              {error && (
                <div className="alert alert-error" style={{ gridColumn: '1 / -1' }}>
                  {error}
                </div>
              )}
              <div className="crop-editor-pane">
                <div
                  className="cropper-wrap"
                  ref={cropperWrapRef}
                  onMouseMove={(e) => {
                    const c = pickCursor(e.clientX, e.clientY);
                    if (cropperWrapRef.current) cropperWrapRef.current.style.cursor = c;
                  }}
                  onMouseLeave={() => {
                    if (cropperWrapRef.current) cropperWrapRef.current.style.cursor = 'move';
                  }}
                >
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                    cropSize={cropSize || undefined}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_croppedArea, croppedAreaPixelsNext) =>
                      setCroppedAreaPixels(croppedAreaPixelsNext)
                    }
                  />

                  {handles && (
                    <>
                      {/* Side handles */}
                      <div
                        style={{ position: 'absolute', left: handles.frameLeft - handles.t / 2, top: handles.frameTop, width: handles.t, height: handles.frameBottom - handles.frameTop, cursor: 'ew-resize', zIndex: 10 }}
                        onPointerDown={(e) => startResize('left', e)}
                      />
                      <div
                        style={{ position: 'absolute', left: handles.frameRight - handles.t / 2, top: handles.frameTop, width: handles.t, height: handles.frameBottom - handles.frameTop, cursor: 'ew-resize', zIndex: 10 }}
                        onPointerDown={(e) => startResize('right', e)}
                      />
                      <div
                        style={{ position: 'absolute', left: handles.frameLeft, top: handles.frameTop - handles.t / 2, width: handles.frameRight - handles.frameLeft, height: handles.t, cursor: 'ns-resize', zIndex: 10 }}
                        onPointerDown={(e) => startResize('top', e)}
                      />
                      <div
                        style={{ position: 'absolute', left: handles.frameLeft, top: handles.frameBottom - handles.t / 2, width: handles.frameRight - handles.frameLeft, height: handles.t, cursor: 'ns-resize', zIndex: 10 }}
                        onPointerDown={(e) => startResize('bottom', e)}
                      />

                      {/* Corner handles */}
                      <div
                        style={{ position: 'absolute', left: handles.frameLeft - handles.t / 2, top: handles.frameTop - handles.t / 2, width: handles.t, height: handles.t, cursor: 'nwse-resize', zIndex: 11 }}
                        onPointerDown={(e) => startResize('topLeft', e)}
                      />
                      <div
                        style={{ position: 'absolute', left: handles.frameRight - handles.t / 2, top: handles.frameTop - handles.t / 2, width: handles.t, height: handles.t, cursor: 'nesw-resize', zIndex: 11 }}
                        onPointerDown={(e) => startResize('topRight', e)}
                      />
                      <div
                        style={{ position: 'absolute', left: handles.frameLeft - handles.t / 2, top: handles.frameBottom - handles.t / 2, width: handles.t, height: handles.t, cursor: 'nesw-resize', zIndex: 11 }}
                        onPointerDown={(e) => startResize('bottomLeft', e)}
                      />
                      <div
                        style={{ position: 'absolute', left: handles.frameRight - handles.t / 2, top: handles.frameBottom - handles.t / 2, width: handles.t, height: handles.t, cursor: 'nwse-resize', zIndex: 11 }}
                        onPointerDown={(e) => startResize('bottomRight', e)}
                      />
                    </>
                  )}
                </div>

                <div className="crop-controls">
                  <label className="meta">Zoom</label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />

                  <div className="frame-row">
                    <div>
                      <label className="meta">Frame Width (left/right)</label>
                      <div className="frame-stepper">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setFrameW((v) => Math.max(300, v - 50))}
                          disabled={editorBusy}
                        >
                          -
                        </button>
                      <input
                        type="number"
                        min={300}
                        max={1600}
                        value={frameW}
                        onChange={(e) => setFrameW(Math.max(300, Math.min(1600, Number(e.target.value) || DEFAULT_FRAME_W)))}
                      />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setFrameW((v) => Math.min(1600, v + 50))}
                          disabled={editorBusy}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="meta">Frame Height (top/bottom)</label>
                      <div className="frame-stepper">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setFrameH((v) => Math.max(150, v - 50))}
                          disabled={editorBusy}
                        >
                          -
                        </button>
                      <input
                        type="number"
                        min={150}
                        max={1200}
                        value={frameH}
                        onChange={(e) => setFrameH(Math.max(150, Math.min(1200, Number(e.target.value) || DEFAULT_FRAME_H)))}
                      />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setFrameH((v) => Math.min(1200, v + 50))}
                          disabled={editorBusy}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="filter-row" style={{ marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setFrameW(800);
                        setFrameH(400);
                        setLockAspect(true);
                      }}
                    >
                      2:1 (800×400)
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setFrameW(800);
                        setFrameH(450);
                        setLockAspect(true);
                      }}
                    >
                      16:9 (800×450)
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setFrameW(800);
                        setFrameH(600);
                        setLockAspect(true);
                      }}
                    >
                      4:3 (800×600)
                    </button>
                  </div>

                  <p className="meta" style={{ margin: 0 }}>
                    Frame is fixed: crop selection follows your width/height values.
                  </p>
                </div>
              </div>

              <div className="crop-preview-pane">
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Final preview</h3>
                <div className="preview-box">
                  {previewUrl ? <img src={previewUrl} alt="Final preview" /> : <p className="meta">Make a crop selection.</p>}
                </div>
                <p className="meta" style={{ marginTop: '0.75rem' }}>
                  Output size: {frameW}×{frameH}. Cropped image is re-encoded as JPEG for compression.
                </p>

                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={confirm}
                    disabled={editorBusy}
                    title={!croppedAreaPixels ? 'Move the crop/zoom once before confirming.' : 'Generate the final image'}
                  >
                    {editorBusy ? 'Processing…' : 'Done (Use image)'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={resetCropOnly}
                    disabled={editorBusy}
                  >
                    Reset crop
                  </button>
                </div>
              </div>

              {/* Sticky footer to ensure confirmation is always visible even when the modal is scrolled */}
              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirm}
                  disabled={editorBusy}
                  style={{ width: '100%' }}
                >
                  {editorBusy ? 'Processing…' : 'Done (Use image)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
