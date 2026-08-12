import { ImageIcon } from './icons'
import './ImageSlot.css'

/**
 * Renders an image, or a labelled placeholder when no source is set yet.
 *
 * This replaces the design tool's drag-and-drop `<image-slot>` element. Sources
 * are wired up in `src/site.config.js`; until one is provided the slot shows the
 * hint so unfinished areas of the page are obvious rather than blank.
 */
export default function ImageSlot({ src, alt = '', hint, fit = 'cover', className = '' }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`image-slot__img${className ? ` ${className}` : ''}`}
        style={{ objectFit: fit }}
      />
    )
  }

  return (
    <div className={`image-slot${className ? ` ${className}` : ''}`} role="presentation">
      <ImageIcon />
      {hint && <span className="image-slot__hint">{hint}</span>}
    </div>
  )
}
