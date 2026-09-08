// Nguồn dữ liệu DUY NHẤT mô tả các tính năng ở trang admin — dùng chung cho tour hướng dẫn
// (OnboardingTour.tsx, spotlight theo data-tour) VÀ trang wiki (/admin/huong-dan, đọc trực
// tiếp). Sửa nội dung ở đây là đủ để cả 2 nơi cùng cập nhật — mỗi khi thêm/sửa 1 tính năng ở
// trang admin thì cũng nên thêm/sửa mục tương ứng ở đây (gắn thêm data-tour="<target>" vào
// đúng phần tử JSX nếu muốn tour/wiki trỏ tới được).
export type WikiButton = {
  target: string;
  title: string;
  description: string;
};

export type WikiFeature = {
  target: string;
  href: string;
  title: string;
  description: string;
  buttons?: WikiButton[];
};

export type WikiSection = {
  label: string;
  superAdminOnly?: boolean;
  features: WikiFeature[];
};

export const ADMIN_WIKI: WikiSection[] = [
  {
    label: "Sản phẩm",
    features: [
      {
        target: "admin",
        href: "/admin",
        title: "Danh sách sản phẩm",
        description: "Trang chủ quản trị — nơi bạn xem toàn bộ sản phẩm đã đăng và tình trạng bán của từng sản phẩm.",
      },
      {
        target: "products-new",
        href: "/admin/products/new",
        title: "Đăng sản phẩm",
        description: "Thêm sản phẩm mới lên sàn: hình ảnh, giá bán, mô tả, danh mục.",
        buttons: [
          {
            target: "product-form-submit",
            title: "Nút Đăng sản phẩm",
            description: "Điền xong thông tin thì bấm nút này để đăng sản phẩm lên sàn.",
          },
        ],
      },
      {
        target: "products-import",
        href: "/admin/products/import",
        title: "Import Excel",
        description: "Đăng hàng loạt sản phẩm nhanh chóng bằng cách nhập từ file Excel.",
        buttons: [
          {
            target: "import-file",
            title: "Chọn file Excel",
            description: "Chọn file Excel đã điền theo mẫu để chuẩn bị import.",
          },
          {
            target: "import-submit",
            title: "Nút Import",
            description: "Bấm để đăng hàng loạt các sản phẩm trong file đã chọn.",
          },
        ],
      },
      {
        target: "gallery",
        href: "/admin/thu-vien-anh",
        title: "Thư viện ảnh",
        description: "Lưu trữ và tái sử dụng ảnh sản phẩm cho nhiều lần đăng bán khác nhau.",
        buttons: [
          {
            target: "gallery-choose-file",
            title: "Chọn tệp",
            description: "Chọn 1 hoặc nhiều ảnh từ máy để tải lên thư viện.",
          },
          {
            target: "gallery-upload",
            title: "Tải ảnh lên",
            description: "Bấm để tải các ảnh vừa chọn lên thư viện, dùng lại cho nhiều sản phẩm.",
          },
        ],
      },
      {
        target: "orders",
        href: "/admin/orders",
        title: "Quản lý đơn hàng",
        description: "Theo dõi trạng thái giao hàng, xử lý và huỷ đơn hàng của khách.",
      },
      {
        target: "facebook-groups",
        href: "/admin/nhom-facebook",
        title: "Tìm nhóm Facebook",
        description: "Tìm nhóm Facebook phù hợp và soạn sẵn nội dung để đăng bán sản phẩm.",
        buttons: [
          {
            target: "facebook-keywords",
            title: "Ô nhập từ khoá",
            description: "Nhập từ khoá liên quan đến sản phẩm để tìm nhóm Facebook phù hợp.",
          },
          {
            target: "facebook-search",
            title: "Nút Tìm kiếm",
            description: "Bấm để tìm nhóm Facebook theo từ khoá vừa nhập.",
          },
        ],
      },
    ],
  },
  {
    label: "Quản trị sàn",
    superAdminOnly: true,
    features: [
      {
        target: "categories",
        href: "/admin/danh-muc",
        title: "Quản lý danh mục",
        description: "Tạo và sắp xếp danh mục sản phẩm cho toàn sàn.",
      },
      {
        target: "trust",
        href: "/admin/settings",
        title: "Bằng chứng uy tín",
        description: "Quản lý các bằng chứng, đánh giá giúp tăng độ tin cậy của sàn.",
        buttons: [
          {
            target: "trust-save",
            title: "Nút Lưu",
            description: "Bấm để lưu lại nội dung bằng chứng uy tín vừa chỉnh sửa.",
          },
        ],
      },
      {
        target: "chat",
        href: "/admin/chat",
        title: "Chat hỗ trợ",
        description: "Trả lời tin nhắn hỗ trợ từ khách hàng và người bán trên sàn.",
        buttons: [
          {
            target: "chat-input",
            title: "Ô nhập tin nhắn",
            description: "Chọn 1 cuộc trò chuyện ở danh sách bên trái rồi nhập nội dung trả lời ở đây.",
          },
          {
            target: "chat-send",
            title: "Nút Gửi",
            description: "Bấm để gửi tin nhắn trả lời cho khách.",
          },
        ],
      },
    ],
  },
  {
    label: "Tài khoản",
    features: [
      {
        target: "account",
        href: "/admin/account",
        title: "Tài khoản của tôi",
        description: "Cập nhật thông tin tài khoản, nạp credit và xem trang công khai của bạn ở đây.",
        buttons: [
          {
            target: "account-save",
            title: "Nút Lưu thay đổi",
            description: "Bấm để lưu lại thông tin tài khoản vừa chỉnh sửa.",
          },
        ],
      },
    ],
  },
];

export type TourStep = {
  target: string;
  href: string;
  title: string;
  description: string;
};

// Làm phẳng ADMIN_WIKI thành danh sách bước tuần tự cho tour (feature -> từng nút con của nó),
// lọc theo quyền hạn — dùng chung logic hiển thị với sidebar (isSuperAdmin).
export function buildTourSteps(isSuperAdmin: boolean): TourStep[] {
  const steps: TourStep[] = [];
  for (const section of ADMIN_WIKI) {
    if (section.superAdminOnly && !isSuperAdmin) continue;
    for (const feature of section.features) {
      steps.push({ target: feature.target, href: feature.href, title: feature.title, description: feature.description });
      for (const btn of feature.buttons ?? []) {
        steps.push({ target: btn.target, href: feature.href, title: btn.title, description: btn.description });
      }
    }
  }
  return steps;
}
