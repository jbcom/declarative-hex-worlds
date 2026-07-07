/**
 * `Canvas2dBoardIsland` — a live docs demo of the canvas-2D renderer binding.
 *
 * Renders the examples package's shared game through `declarative-hex-worlds/canvas2d`
 * onto a 2D `<canvas>`, with a procedurally-generated sprite sheet — so it needs ZERO
 * external assets (no GLTFs, no model hosting) and builds/runs anywhere. This is the
 * robust first live binding demo: the documentation *runs* the library, showing the
 * SAME game the three demo draws in 3D, drawn here in 2D. Mounted `client:only="react"`
 * (it touches the DOM canvas API).
 *
 * @module
 */
import { renderCanvas2dExample } from '@declarative-hex-worlds/examples/canvas2d';
import { useEffect, useRef, type ReactElement } from 'react';

/**
 * Draw a tiny procedural sprite sheet (a 4×4 grid of flat-shaded hex-ish tiles) to an
 * offscreen canvas. The example's tileset manifest points every tile at cell (0,0) of
 * one 4×4 sheet, so a single generated sheet is enough to render the whole board with
 * no downloaded art.
 */
function makeProceduralSheet(): HTMLCanvasElement {
  const cell = 64;
  const sheet = document.createElement('canvas');
  sheet.width = cell * 4;
  sheet.height = cell * 4;
  const ctx = sheet.getContext('2d');
  if (!ctx) {
    return sheet;
  }
  const palette = ['#6a994e', '#a7c957', '#386641', '#7f9c6b'];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * cell;
      const y = row * cell;
      ctx.fillStyle = palette[(row + col) % palette.length];
      // A flat-top hexagon inscribed in the cell.
      ctx.beginPath();
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const r = cell * 0.46;
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const px = cx + r * Math.cos(a);
        const py = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  return sheet;
}

/** The live canvas-2D binding board demo. */
export default function Canvas2dBoardIsland(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.fillStyle = '#20251f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sheet = makeProceduralSheet();
    // The example manifest keys its single sheet at '/examples-sheet.png'.
    renderCanvas2dExample(ctx, new Map([['/examples-sheet.png', sheet]]));
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      style={{
        width: '100%',
        height: 'auto',
        borderRadius: '0.5rem',
        background: '#20251f',
      }}
    />
  );
}
