/**
 * MI-RA Studio — Annotation Engine (core)
 * Modality-agnostic history, autosave flags, and object lock state.
 */

export type EngineState<T> = T

export class AnnotationEngine<T> {
  private history: T[] = []
  private redoStack: T[] = []
  private autosaveDirty = false
  private lockedObjects = new Set<string>()

  pushHistory(state: T): void {
    this.history.push(structuredClone(state))
    this.redoStack = []
    this.autosaveDirty = true
  }

  undo(): T | null {
    if (!this.history.length) return null
    const current = this.history.pop() as T
    this.redoStack.push(current)
    this.autosaveDirty = true
    return this.history.length ? structuredClone(this.history[this.history.length - 1]) : null
  }

  redo(): T | null {
    if (!this.redoStack.length) return null
    const state = this.redoStack.pop() as T
    this.history.push(state)
    this.autosaveDirty = true
    return structuredClone(state)
  }

  canUndo(): boolean {
    return this.history.length > 1
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  markSaved(): void {
    this.autosaveDirty = false
  }

  get needsSave(): boolean {
    return this.autosaveDirty
  }

  lock(objectId: string): void {
    this.lockedObjects.add(objectId)
  }

  unlock(objectId: string): void {
    this.lockedObjects.delete(objectId)
  }

  isLocked(objectId: string): boolean {
    return this.lockedObjects.has(objectId)
  }
}
