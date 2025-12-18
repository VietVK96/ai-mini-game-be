# Share Feature - Share Ảnh lên Facebook

## Tổng quan

Module này cung cấp tính năng upload và share ảnh lên Facebook với Open Graph tags.

## Endpoints

### POST /api/v1/share
Upload ảnh và tạo share.

**Request:**
- Content-Type: `multipart/form-data`
- Field: `file` (JPEG, PNG, WebP)
- Max size: `MAX_UPLOAD_MB` (default 8MB)

**Response:**
```json
{
  "shareId": "uuid",
  "sharePageUrl": "https://.../s/uuid",
  "imageUrl": "https://.../shares/uuid.jpg",
  "expiresAt": "ISO8601"
}
```

### GET /s/:shareId
Trang share với Open Graph tags cho Facebook crawler.

**Response:** HTML với Open Graph meta tags

## Files

- `share.controller.ts` - API endpoints
- `share.service.ts` - Business logic
- `share-cleanup.service.ts` - Auto-cleanup job (chạy mỗi 5 phút)
- `share.module.ts` - Module definition
- `dto/share-response.dto.ts` - Response DTO

## Environment Variables

- `PUBLIC_BASE_URL` - Base URL cho share links (bắt buộc)
- `SHARE_TTL_SECONDS` - TTL cho shares (default: 21600 = 6h)
- `MAX_UPLOAD_MB` - Max upload size (default: 8)
- `FB_APP_ID` - Facebook App ID (optional)

## Storage

Files được lưu trong `public/shares/`:
- `<shareId>.jpg` - Ảnh đã convert về JPEG
- `<shareId>.json` - Metadata (createdAt, expiresAt)

## Auto-Cleanup

Job cleanup chạy tự động mỗi 5 phút để xóa files quá hạn.

