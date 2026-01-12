---
name: Fix PDF Viewer Container Ref Infinite Loop and Loading Issues
overview: ""
todos:
  - id: ec996c3e-a547-466c-b875-b35df82b0661
    content: Update PdfAcroFormViewer to render PDF pages with PDF.js (canvas)
    status: completed
  - id: 2d9a1ae2-29cc-4113-972c-f82c368d2e85
    content: Extract form fields from PDF using pdf-lib
    status: completed
  - id: 03e8a864-3cab-4deb-9f68-7a030e6c142f
    content: Render HTML form inputs matching PDF fields
    status: completed
  - id: 115d371a-d6a7-47d1-81e9-2e4b785e2498
    content: Capture user input from HTML form inputs
    status: completed
  - id: 4f737fc0-3495-4bd2-b193-88e5f31094a9
    content: Fill PDF with captured values on finalize using pdf-lib
    status: completed
---

# Fix PDF Viewer Container Ref Infinite Loop and Loading Issues

## Problem Analysis

The console shows an infinite loop with repeated stack traces (a6, a4 pattern), indicating React re-renders. The root causes are:

1. **Callback ref triggers state updates on every render**: The callback ref `(el) => { setContainerReady(true) }` is called on every render, causing infinite loop
2. **useEffect dependency loop**: `containerReady` in useEffect dependencies causes re-runs when state updates
3. **Container may not be ready when effect runs**: Even after fixing the loop, timing issues can prevent container from being available
4. **No guard against multiple loads**: PDF could be loaded multiple times if effect re-runs

## Solution

Use a robust pattern with refs and guards instead of state:

1. **Remove containerReady state entirely** - eliminate state updates from callback ref
2. **Use standard ref assignment** - `ref={containerRef}` (no callback)
3. **Add loadedKeyRef guard** - track what's been loaded to prevent reloads
4. **Add loadingRef guard** - prevent concurrent load attempts
5. **Use requestAnimationFrame** - ensure layout has settled before loading
6. **Tighten effect dependencies** - only depend on stable values (pdfData, documentId)
7. **Ensure container is always rendered** - check that container div isn't conditionally rendered

## Implementation Steps

### File: `components/pdf/PdfAcroFormViewer.tsx`

1. Remove `containerReady` state variable
2. Replace callback ref with standard ref: `ref={containerRef}`
3. Add refs for loading guards:

- `const loadedKeyRef = useRef<string | null>(null)`
- `const loadingRef = useRef(false)`

4. Add `documentId` prop (or derive from documentTitle) for stable load key
5. Rewrite useEffect to:

- Check if container exists (return early if not)
- Check if pdfData exists (return early if not)
- Create stable load key: `${documentId || documentTitle}:${pdfData.length}`
- Check if already loaded (loadedKeyRef.current === loadKey)
- Check if currently loading (loadingRef.current)
- Set loadingRef.current = true
- Wrap loadPdf in requestAnimationFrame
- Set loadedKeyRef.current = loadKey after success
- Reset loadingRef.current = false in finally

6. Update useEffect dependencies to only `[pdfData, documentId || documentTitle]`
7. Ensure container div is always rendered (not conditionally)

### Changes Summary:

- Remove: `const [containerReady, setContainerReady] = useState(false)`
- Remove: callback ref pattern `ref={(el) => { setContainerReady(true) }}`
- Add: `const loadedKeyRef = useRef<string | null>(null)`
- Add: `const loadingRef = useRef(false)`
- Add: `documentId` prop (or use documentTitle as fallback)
- Change: Standard ref `ref={containerRef}`
- Rewrite: useEffect with guards and requestAnimationFrame
- Update: Effect dependencies to `[pdfData, documentId]`

This approach eliminates the infinite loop and ensures PDF loads reliably when container is ready, even in StrictMode or when container is initially hidden/collapsed.