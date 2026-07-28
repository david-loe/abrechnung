# Bundled PP-OCRv6 models

These pinned PaddleOCR model archives are shipped with the frontend so receipt OCR does not depend on a third-party request at build time or in the browser.

| File | SHA-256 |
| --- | --- |
| `PP-OCRv6_small_det_onnx_infer.tar` | `d218f6fbf0f1c23d2161bd6ac7f5eaa6104fa89955c09290497e31008e2618e4` |
| `PP-OCRv6_small_rec_onnx_infer.tar` | `d267ab077a44a0eedb1ea8f8c542d263f211de8e9d7a029bf9fcfff7e5a88fb1` |

The files are the official `PP-OCRv6_small` ONNX inference archives published by PaddlePaddle. `npm run check:ocr-assets` verifies them before development and production builds.
