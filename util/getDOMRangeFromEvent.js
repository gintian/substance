import isNil from './isNil'

export default function getDOMRangeFromEvent (evt) {
  let range
  const x = evt.clientX
  const y = evt.clientY
  // Try the simple IE way first
  if (document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToPoint(x, y)
  } else if (!isNil(document.createRange)) {
    // Try Mozilla's rangeOffset and rangeParent properties,
    // which are exactly what we want
    if (!isNil(evt.rangeParent)) {
      range = document.createRange()
      range.setStart(evt.rangeParent, evt.rangeOffset)
      range.collapse(true)
    // Try the standards-based way next
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y)
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.collapse(true)
    // Try the standards-based way next
    } else if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y)
    }
  }
  return range
}
