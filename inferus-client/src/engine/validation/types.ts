export interface ValidationResult {
  records: Record<
    string,
    Array<{
      type: 'error' | 'warning'
      validator: string
      message: string
    }>
  >
}
