# Templates Directory

Thư mục này chứa các file template cho ứng dụng AI Image Generator.

## Cấu trúc

```
templates/
├── templates.json          # Metadata của templates
├── poster-classic-bg.png   # Background cho poster cổ điển
├── poster-classic-overlay.png # Overlay cho poster cổ điển
├── poster-classic-preview.jpg # Preview cho poster cổ điển
├── banner-web-bg.png       # Background cho banner web
├── banner-web-overlay.png  # Overlay cho banner web
├── banner-web-preview.jpg  # Preview cho banner web
└── ...                     # Các template khác
```

## Quy tắc đặt tên

- Background: `{template-id}-bg.png`
- Overlay: `{template-id}-overlay.png`
- Preview: `{template-id}-preview.jpg`

## Kích thước khuyến nghị

- **1:1 (Square)**: 1080x1080px
- **4:5 (Portrait)**: 1080x1350px
- **9:16 (Story)**: 1080x1920px

## Định dạng file

- Background: PNG với transparency
- Overlay: PNG với transparency
- Preview: JPG để tối ưu kích thước

## Thêm template mới

1. Tạo các file ảnh theo quy tắc đặt tên
2. Cập nhật `templates.json` với metadata mới
3. Đảm bảo placement coordinates chính xác
4. Test template với các kích thước ảnh khác nhau
