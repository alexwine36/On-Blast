import type { ReactNode, RefObject } from "react";

interface PoseViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  notice?: ReactNode;
}

/**
 * A real `<video>` with a transparent canvas stacked on top.
 *
 * The video is composited by the browser rather than drawn frame-by-frame into
 * a canvas, which is what keeps the picture smooth while inference blocks the
 * main thread. The video letterboxes with `object-fit: contain`; the render
 * loop reproduces that fit so the overlay lines up.
 */
export function PoseView({ videoRef, canvasRef, notice }: PoseViewProps) {
  return (
    <div className="stage">
      <video ref={videoRef} className="stage__video" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="stage__overlay" />
      {notice ? <div className="stage__notice">{notice}</div> : null}
    </div>
  );
}
