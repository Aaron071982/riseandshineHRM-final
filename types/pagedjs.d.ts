declare module 'pagedjs' {
  export class Previewer {
    constructor(options?: Record<string, unknown>)
    preview(
      content?: HTMLElement | DocumentFragment | string | null,
      stylesheets?: Array<string | object> | null,
      renderTo?: HTMLElement | string | null
    ): Promise<{ total?: number }>
  }
}
