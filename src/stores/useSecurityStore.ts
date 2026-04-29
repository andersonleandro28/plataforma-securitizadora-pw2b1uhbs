import { create } from 'zustand'

interface SecurityState {
  isOpen: boolean
  actionDescription: string
  onSuccess: (() => void) | null
  onCancel: (() => void) | null
  requestClearance: (description: string, onSuccess: () => void, onCancel?: () => void) => void
  close: () => void
}

const useSecurityStore = create<SecurityState>((set) => ({
  isOpen: false,
  actionDescription: '',
  onSuccess: null,
  onCancel: null,
  requestClearance: (description, onSuccess, onCancel) =>
    set({ isOpen: true, actionDescription: description, onSuccess, onCancel }),
  close: () => set({ isOpen: false, actionDescription: '', onSuccess: null, onCancel: null }),
}))

export default useSecurityStore
