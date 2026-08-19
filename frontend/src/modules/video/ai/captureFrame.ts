/** Capture current video frame as JPEG blob for inference. */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  quality = 0.92,
): Promise<Blob> {
  const w = video.videoWidth || video.width
  const h = video.videoHeight || video.height
  if (!w || !h) throw new Error('Video dimensions not ready')
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(video, 0, 0, w, h)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode frame'))),
      'image/jpeg',
      quality,
    )
  })
}

export async function captureVideoFrameImage(video: HTMLVideoElement): Promise<HTMLImageElement> {
  const blob = await captureVideoFrame(video)
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Seek video, wait for frame, capture — for tracking across frames. */
export async function captureFrameAt(
  video: HTMLVideoElement,
  timeSec: number,
  fps?: number,
): Promise<Blob> {
  const prev = video.currentTime
  video.currentTime = Math.max(0, timeSec)
  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    setTimeout(onSeeked, fps ? 1000 / fps + 50 : 120)
  })
  const blob = await captureVideoFrame(video)
  video.currentTime = prev
  return blob
}
