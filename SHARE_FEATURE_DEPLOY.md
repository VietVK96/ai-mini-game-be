# Hướng dẫn Deploy Tính năng Share Ảnh lên Facebook

## Tổng quan

Tính năng này cho phép người dùng upload ảnh đã chỉnh sửa và chia sẻ lên Facebook với Open Graph tags.

## Cấu trúc

- **POST /api/v1/share** - Upload ảnh và tạo share
- **GET /s/:shareId** - Trang share với Open Graph tags (không có prefix /api/v1)
- **GET /shares/:shareId.jpg** - Static file serving cho ảnh

## Cài đặt Dependencies

```bash
yarn add @nestjs/schedule
# hoặc
npm install @nestjs/schedule
```

## Cấu hình Environment Variables

Thêm vào file `.env`:

```env
# Public base URL (bắt buộc cho production)
PUBLIC_BASE_URL=https://image-ai.ddns.net

# TTL cho share (mặc định 6 giờ = 21600 giây)
SHARE_TTL_SECONDS=21600

# Facebook App ID (optional, để hiển thị trong Open Graph)
FB_APP_ID=your_facebook_app_id

# Max upload size (mặc định 8MB)
MAX_UPLOAD_MB=8
```

## Cấu trúc Thư mục

Đảm bảo thư mục `public/shares/` tồn tại:

```bash
mkdir -p public/shares
```

Thư mục này sẽ chứa:
- `<shareId>.jpg` - Ảnh đã convert về JPEG
- `<shareId>.json` - Metadata (createdAt, expiresAt)

## Chạy Local

1. Cài đặt dependencies:
```bash
yarn install
```

2. Set environment variables trong `.env`:
```env
PUBLIC_BASE_URL=http://localhost:3001
SHARE_TTL_SECONDS=21600
MAX_UPLOAD_MB=8
```

3. Chạy server:
```bash
yarn start
```

4. Test endpoints:

**Upload ảnh:**
```bash
curl -X POST http://localhost:3001/api/v1/share \
  -F "file=@/path/to/image.jpg"
```

**Xem share page:**
```
http://localhost:3001/s/<shareId>
```

**Xem ảnh trực tiếp:**
```
http://localhost:3001/shares/<shareId>.jpg
```

## Deploy Production

### 1. Cấu hình Nginx (Nếu dùng Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name image-ai.ddns.net;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Serve static files từ public directory
    location /shares/ {
        alias /path/to/backend/public/shares/;
        expires 5m;
        add_header Cache-Control "public, max-age=300";
        access_log off;
    }

    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy share page route
    location /s/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve other static files
    location / {
        root /path/to/backend/public;
        try_files $uri $uri/ =404;
    }
}
```

### 2. Cấu hình PM2 (Process Manager)

Tạo file `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'game-ai-backend',
    script: 'dist/main.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      API_PORT: 3001,
      PUBLIC_BASE_URL: 'https://image-ai.ddns.net',
      SHARE_TTL_SECONDS: '21600',
      MAX_UPLOAD_MB: '8',
      FB_APP_ID: 'your_facebook_app_id'
    }
  }]
};
```

Chạy với PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Kiểm tra HTTPS

Đảm bảo `PUBLIC_BASE_URL` sử dụng HTTPS:
```env
PUBLIC_BASE_URL=https://image-ai.ddns.net
```

Facebook crawler yêu cầu HTTPS cho Open Graph images.

### 4. Kiểm tra Static File Serving

Test xem ảnh có được serve đúng không:
```bash
curl -I https://image-ai.ddns.net/shares/<shareId>.jpg
```

Response phải có:
- Status: 200 OK
- Cache-Control: public, max-age=300

### 5. Kiểm tra Share Page

Test share page:
```bash
curl https://image-ai.ddns.net/s/<shareId>
```

Kiểm tra HTML có đầy đủ Open Graph tags:
- `og:title`
- `og:type`
- `og:url`
- `og:image`
- `og:description`
- `fb:app_id` (nếu có)

### 6. Test Facebook Sharing

1. Dùng [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
2. Nhập URL: `https://image-ai.ddns.net/s/<shareId>`
3. Click "Scrape Again" để test
4. Kiểm tra preview image và metadata

## Auto-Cleanup Job

Job cleanup chạy tự động mỗi 5 phút để xóa files quá hạn:
- Quét thư mục `public/shares/`
- Xóa file `.json` và `.jpg` có `expiresAt` đã qua
- Chỉ xóa files có tên theo format UUID

Logs sẽ hiển thị:
```
[ShareCleanupService] Starting share cleanup job...
[ShareCleanupService] Cleananed up 3 expired share(s)
```

## Troubleshooting

### 1. Route /s/:shareId không hoạt động

Kiểm tra:
- Route không bị prefix `/api/v1`
- Controller `SharePageController` được import đúng
- Static file serving được cấu hình

### 2. Ảnh không hiển thị trên Facebook

Kiểm tra:
- `PUBLIC_BASE_URL` dùng HTTPS
- Ảnh có thể truy cập công khai (không cần auth)
- Open Graph tags đúng format
- Dùng Facebook Sharing Debugger để test

### 3. Files không được xóa tự động

Kiểm tra:
- `@nestjs/schedule` đã được install
- `ScheduleModule` được import trong `ShareModule`
- `ShareCleanupService` được register trong providers
- Logs để xem job có chạy không

### 4. Upload bị lỗi "File size exceeds"

Kiểm tra:
- `MAX_UPLOAD_MB` trong env
- Multer limits trong controller
- Nginx `client_max_body_size` (nếu dùng Nginx)

## API Examples

### Upload ảnh

```bash
curl -X POST https://image-ai.ddns.net/api/v1/share \
  -H "Content-Type: multipart/form-data" \
  -F "file=@image.jpg"
```

Response:
```json
{
  "shareId": "550e8400-e29b-41d4-a716-446655440000",
  "sharePageUrl": "https://image-ai.ddns.net/s/550e8400-e29b-41d4-a716-446655440000",
  "imageUrl": "https://image-ai.ddns.net/shares/550e8400-e29b-41d4-a716-446655440000.jpg",
  "expiresAt": "2025-12-09T12:00:00.000Z"
}
```

### Xem share page

```
https://image-ai.ddns.net/s/550e8400-e29b-41d4-a716-446655440000
```

### Xem ảnh trực tiếp

```
https://image-ai.ddns.net/shares/550e8400-e29b-41d4-a716-446655440000.jpg
```

## Security Notes

1. **File Upload Validation**: Chỉ chấp nhận JPEG, PNG, WebP
2. **Size Limit**: Mặc định 8MB, có thể config
3. **UUID Validation**: Chỉ xóa files có tên theo format UUID
4. **TTL**: Files tự động xóa sau TTL (mặc định 6 giờ)
5. **HTTPS**: Bắt buộc cho production để Facebook crawler hoạt động

## Monitoring

Theo dõi:
- Số lượng files trong `public/shares/`
- Disk usage
- Cleanup job logs
- Facebook sharing debugger errors

