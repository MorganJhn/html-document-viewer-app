import type { ElementEdit } from '../types'

export function mergeEdits(
  existing: ElementEdit | undefined,
  incoming: ElementEdit,
): ElementEdit {
  return {
    targetPath: incoming.targetPath,
    styles: { ...(existing?.styles || {}), ...(incoming.styles || {}) },
    attributes: {
      ...(existing?.attributes || {}),
      ...(incoming.attributes || {}),
    },
    textContent: incoming.textContent ?? existing?.textContent,
  };
}
